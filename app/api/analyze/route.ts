// POST /api/analyze — the server-authoritative run:
//   1. verify the caller,
//   2. enforce approval + credits (atomic decrement, unless out),
//   3. create the analyses/{id} doc,
//   4. run the engine, streaming SSE progress AND persisting to Firestore,
//   5. on failure, mark failed + refund the credit.
// The client watches Firestore for the record, so reports persist across
// devices; SSE is just for the live progress bar during the run.

import { FieldValue } from "firebase-admin/firestore";
import { runFeasibility } from "@/lib/engine/runFeasibility";
import { createLlm, isMockExplicit, isProductionEnv } from "@/lib/engine/factory";
import { OpenAIProvider } from "@/lib/engine/provider";
import { SerpApiProvider } from "@/lib/engine/search";
import { getByokKey } from "@/lib/firebase/byokKey";
import { getOrgLlmKey } from "@/lib/firebase/orgLlmKey";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError, type Caller } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { withTrainingLog, type TrainingEntry } from "@/lib/engine/trainingLog";
import { SIX_STAGES, capBusinessInput, type BusinessInput, type StageName, type StageStatus } from "@/lib/engine/types";
import { checkRateLimit } from "@/lib/rateLimit";
import { captureServerEvent } from "@/lib/posthog/server";

export const runtime = "nodejs";
// Worst-case latency: one stage's serial search calls (up to 4 * 12s) plus its
// own LLM call (2 attempts * 30s), then the report/study pair after all stages
// finish (another 2 attempts * 30s, run in parallel with each other) — roughly
// 48 + 60 + 60 = 168s. 240s leaves real margin so the platform-level kill stays
// well behind the in-code catch/refund logic, not ahead of it.
export const maxDuration = 240;

// Burst protection on top of the per-run credit cost (see lib/rateLimit.ts).
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 60_000;

const initialStages = () =>
  Object.fromEntries(SIX_STAGES.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;

export async function POST(req: Request) {
  let caller: Caller;
  try {
    caller = await requireUser(req);
  } catch (err) {
    const e = err as HttpError;
    return json({ error: e.message ?? "Unauthorized" }, e.status ?? 401);
  }

  const rl = await checkRateLimit(caller.uid, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return json(
      { error: `Too many analyses started at once. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
      429
    );
  }

  const { input: rawInput } = (await req.json()) as { input: BusinessInput };
  if (!rawInput?.business_idea) return json({ error: "Missing business input." }, 400);
  const input = capBusinessInput(rawInput);

  const db = adminDb();
  const userRef = db.collection("users").doc(caller.uid);

  // --- approval check + BYOK detection ---
  const preSnap = await userRef.get();
  if (!preSnap.exists) return json({ error: "Account not found." }, 403);
  const preData = preSnap.data() as { status?: string; keyMode?: string; orgId?: string };
  if (preData.status !== "approved") return json({ error: "Your account isn't approved yet." }, 403);

  const isByok = preData.keyMode === "byok";
  let byokApiKey: string | null = null;
  if (isByok) {
    byokApiKey = await getByokKey(caller.uid);
    if (!byokApiKey) {
      return json({ error: "Add your API key in Settings before running an analysis in BYOK mode." }, 400);
    }
  }

  // --- org shared key (owner-provided) — only considered when the caller
  // hasn't set a personal BYOK key of their own; a member's explicit choice
  // always wins over the org default. Only usable once the org is approved,
  // matching the same gate applied to org API keys / billing. ---
  let orgApiKey: string | null = null;
  if (!isByok && preData.orgId) {
    const orgSnap = await db.collection("organizations").doc(preData.orgId).get();
    if (orgSnap.exists && orgSnap.data()?.status === "approved") {
      orgApiKey = await getOrgLlmKey(preData.orgId);
    }
  }
  const usesOrgKey = !isByok && !!orgApiKey;

  // --- credit gate (atomic) — skipped entirely in BYOK/org-key mode, which
  // runs on a key that never touches the platform's credit balance ---
  let charged = false;
  if (!isByok && !usesOrgKey) {
    try {
      charged = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const u = snap.data() as { credits?: number };
        const credits = u.credits ?? 0;
        if (credits < 1) throw new HttpError(402, "You're out of credits. Ask an admin to add more.");
        tx.update(userRef, { credits: credits - 1 });
        return true;
      });
    } catch (err) {
      const e = err as HttpError;
      return json({ error: e.message ?? "Not allowed" }, e.status ?? 403);
    }
  }

  // --- create the analysis record ---
  const ref = db.collection("analyses").doc();
  const id = ref.id;
  const callerDoc = await userRef.get();
  const orgId = callerDoc.data()?.orgId as string | undefined;
  const trainingOptOut = callerDoc.data()?.trainingOptOut === true;
  await ref.set({
    id,
    uid: caller.uid,
    ...(orgId ? { orgId } : {}),
    createdAt: Date.now(),
    status: "running",
    input,
    stageStatus: initialStages(),
    charged,
    billedVia: isByok ? "byok" : usesOrgKey ? "org" : "credit",
    reviewStatus: "unreviewed",
  });
  await logAudit({ uid: caller.uid, email: caller.email, action: "analysis.run", target: id, meta: { business_idea: input.business_idea } });

  const baseLlm =
    isByok && byokApiKey ? new OpenAIProvider({ apiKey: byokApiKey }) :
    usesOrgKey && orgApiKey ? new OpenAIProvider({ apiKey: orgApiKey }) :
    createLlm();
  if (baseLlm.mock && !isMockExplicit() && isProductionEnv()) {
    // Every AI-provider env var is simply absent in production — this run is
    // about to charge a real credit for fabricated output with nothing but a
    // small in-report banner to show for it. Never block the run (mock mode
    // must keep working as a deliberate demo path elsewhere) — just make sure
    // this doesn't happen invisibly.
    logError("analyze.accidentalMock", new Error("No AI provider configured in production — serving mock output"), {
      uid: caller.uid,
    }).catch(() => {});
  }
  const trainingEntries: TrainingEntry[] = [];
  // Every raw prompt->completion pair the model produces for this run, captured
  // so a later fine-tune (e.g. onto a small local model) has real input/output
  // pairs to train on — not just the final structured result.
  const llm = withTrainingLog(baseLlm, (e) => trainingEntries.push(e));
  const search = new SerpApiProvider({ mock: llm.mock || !process.env.SERPAPI_API_KEY });
  const encoder = new TextEncoder();

  async function saveTrainingData() {
    if (trainingEntries.length === 0 || trainingOptOut) return;
    try {
      const batch = db.batch();
      for (const entry of trainingEntries) {
        const doc = db.collection("trainingData").doc();
        batch.set(doc, { analysisId: id, uid: caller.uid, ...entry });
      }
      await batch.commit();
    } catch {
      /* training data capture is best-effort — never fails the analysis */
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      // If the client disconnects (tab closed, hard navigation), a later
      // enqueue on this controller throws — and without this guard, that
      // throw propagates into the try/catch below indistinguishably from a
      // real engine failure, marking a run "failed" and refunding a credit
      // for a run that may have completed successfully server-side. Losing
      // the ability to stream progress to a gone client is fine; treating
      // that as an analysis failure is not.
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* client is gone — the run continues and still writes its real result to Firestore */
        }
      };

      send("start", { analysisId: id, stages: SIX_STAGES });
      captureServerEvent(caller.uid, "analysis_started", { analysisId: id });
      const stageStatus = initialStages();

      try {
        const result = await runFeasibility(input, {
          llm,
          search,
          onProgress: (stage, status) => {
            stageStatus[stage] = status;
            send("progress", { stage, status });
            ref.update({ [`stageStatus.${stage}`]: status }).catch(() => {});
          },
        });
        await ref.update({ status: "complete", result, stageStatus });
        send("done", { analysisId: id });
        captureServerEvent(caller.uid, "analysis_completed", { analysisId: id });
        await saveTrainingData();
        if (caller.email) {
          sendAnalysisReadyEmail(caller.email, callerDoc.data()?.name ?? "", id, input.business_idea).catch(() => {});
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        await Promise.allSettled([
          ref.update({ status: "failed", error: message }),
          charged ? userRef.update({ credits: FieldValue.increment(1) }) : Promise.resolve(),
          saveTrainingData(),
          logError("analyze.run", err, { analysisId: id, uid: caller.uid }),
        ]);
        captureServerEvent(caller.uid, "analysis_failed", { analysisId: id, message });
        send("error", { message });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed by the client disconnecting — nothing to do */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
