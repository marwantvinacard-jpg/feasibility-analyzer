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
import { createLlm } from "@/lib/engine/factory";
import { SerpApiProvider } from "@/lib/engine/search";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError, type Caller } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";
import { withTrainingLog, type TrainingEntry } from "@/lib/engine/trainingLog";
import { SIX_STAGES, type BusinessInput, type StageName, type StageStatus } from "@/lib/engine/types";

export const runtime = "nodejs";
export const maxDuration = 120;

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

  const { input } = (await req.json()) as { input: BusinessInput };
  if (!input?.business_idea) return json({ error: "Missing business input." }, 400);

  const db = adminDb();
  const userRef = db.collection("users").doc(caller.uid);

  // --- approval + credit gate (atomic) ---
  let charged = false;
  try {
    charged = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new HttpError(403, "Account not found.");
      const u = snap.data() as { status?: string; credits?: number };
      if (u.status !== "approved") throw new HttpError(403, "Your account isn't approved yet.");
      const credits = u.credits ?? 0;
      if (credits < 1) throw new HttpError(402, "You're out of credits. Ask an admin to add more.");
      tx.update(userRef, { credits: credits - 1 });
      return true;
    });
  } catch (err) {
    const e = err as HttpError;
    return json({ error: e.message ?? "Not allowed" }, e.status ?? 403);
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
    reviewStatus: "unreviewed",
  });
  await logAudit({ uid: caller.uid, email: caller.email, action: "analysis.run", target: id, meta: { business_idea: input.business_idea } });

  const baseLlm = createLlm();
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
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("start", { analysisId: id, stages: SIX_STAGES });
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
        await saveTrainingData();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        await Promise.allSettled([
          ref.update({ status: "failed", error: message }),
          charged ? userRef.update({ credits: FieldValue.increment(1) }) : Promise.resolve(),
          saveTrainingData(),
          logError("analyze.run", err, { analysisId: id, uid: caller.uid }),
        ]);
        send("error", { message });
      } finally {
        controller.close();
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
