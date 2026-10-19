// POST /api/v1/analyze — the public API, authenticated by an org API key
// (Authorization: Bearer <key>) instead of a Firebase session. Synchronous:
// it runs the full engine and returns the finished result as JSON. Costs one
// credit from the org owner's balance, same as a run from the app itself.
//
// This is what lets a feasibility company wire FeasibilityAI into their own
// pipeline instead of using the web UI.

import { FieldValue } from "firebase-admin/firestore";
import { runFeasibility } from "@/lib/engine/runFeasibility";
import { createLlm } from "@/lib/engine/factory";
import type { LlmProvider } from "@/lib/engine/provider";
import { createSearchProvider } from "@/lib/engine/search";
import { adminDb } from "@/lib/firebase/admin";
import { requireApiKey } from "@/lib/firebase/apiKeyAuth";
import { HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";
import { withTrainingLog, type TrainingEntry } from "@/lib/engine/trainingLog";
import type { BusinessInput } from "@/lib/engine/types";
import { checkRateLimit } from "@/lib/rateLimit";
import { trainingAllowed } from "@/lib/trainingConsent";
import { readJsonBody, validateBusinessInput } from "@/lib/engine/validateInput";
import { completeRun, failRun, RunTimeoutError, withTimeBudget } from "@/lib/runLifecycle";

export const runtime = "nodejs";
// Must be a literal for Next.js; keep in sync with RUN_MAX_DURATION_S (lib/runLimits.ts).
export const maxDuration = 300;

// Each call already costs a credit, which caps total exposure — this bounds
// *burst rate* on top of that, per instance (see lib/rateLimit.ts).
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  let apiCaller;
  try {
    apiCaller = await requireApiKey(req);
  } catch (err) {
    const e = err as HttpError;
    return json({ error: e.message ?? "Unauthorized" }, e.status ?? 401);
  }

  // Per organization, not per key: creating more API keys used to multiply the limit.
  const rl = await checkRateLimit(`v1:${apiCaller.orgId}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return json(
      { error: `Rate limit exceeded (${RATE_LIMIT} requests/minute per organization). Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
      429
    );
  }

  // Size + shape checks happen before any credit is taken or model called.
  const body = await readJsonBody(req);
  if (!body.ok) return json({ error: body.error }, body.status);
  if (!body.body?.input?.business_idea) return json({ error: "Missing 'input.business_idea'." }, 400);
  const checked = validateBusinessInput(body.body.input);
  if (!checked.ok) return json({ error: checked.error }, checked.status);
  const input: BusinessInput = checked.input;

  const db = adminDb();
  const ownerRef = db.collection("users").doc(apiCaller.ownerUid);

  let charged = false;
  let trainingOptOut = false;
  try {
    ({ charged, trainingOptOut } = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ownerRef);
      const credits = (snap.data()?.credits as number) ?? 0;
      if (credits < 1) throw new HttpError(402, "The organization is out of credits.");
      tx.update(ownerRef, { credits: credits - 1 });
      return { charged: true, trainingOptOut: !trainingAllowed(snap.data()) }; // opt-in only
    }));
  } catch (err) {
    const e = err as HttpError;
    return json({ error: e.message ?? "Not allowed" }, e.status ?? 403);
  }

  // Built before the record exists: a server with no AI provider stops here,
  // refunded, instead of returning mock "reports".
  let baseLlm: LlmProvider;
  try {
    baseLlm = createLlm();
  } catch (err) {
    await Promise.allSettled([
      charged ? ownerRef.update({ credits: FieldValue.increment(1) }) : Promise.resolve(),
      logError("v1.analyze.config", err, { orgId: apiCaller.orgId }),
    ]);
    return json({ error: "The analysis service isn't available right now. You haven't been charged." }, 503);
  }

  const ref = db.collection("analyses").doc();
  const id = ref.id;
  await ref.set({
    id,
    uid: apiCaller.ownerUid,
    orgId: apiCaller.orgId,
    source: "api",
    createdAt: Date.now(),
    status: "running",
    input,
    charged,
    reviewStatus: "unreviewed",
  });
  await logAudit({
    uid: apiCaller.ownerUid,
    email: `api-key:${apiCaller.keyId}`,
    action: "analysis.run.api",
    target: id,
    meta: { business_idea: input.business_idea },
  });

  const trainingEntries: TrainingEntry[] = [];
  const llm = withTrainingLog(baseLlm, (e) => trainingEntries.push(e));
  // No mock fallback when the key is missing — see app/api/analyze/route.ts.
  const search = createSearchProvider({ mock: llm.mock });

  try {
    // Stops itself (refunded) before the platform time limit; a hard kill is
    // cleaned up by the stale-run sweep (lib/runLifecycle.ts).
    const result = await withTimeBudget(runFeasibility(input, { llm, search }));
    if (!(await completeRun(db, id, { result }))) {
      return json({ error: "The analysis was stopped before it finished. The credit has been refunded." }, 504);
    }
    if (result.research?.failed) {
      logError("v1.analyze.research", new Error(`${result.research.failed}/${result.research.queries} web searches failed`), {
        analysisId: id,
        stagesWithoutResearch: result.research.stagesWithoutResearch,
        sampleError: result.research.sampleError ?? null,
      }).catch(() => {});
    }
    if (result.suspiciousInput) {
      logError("v1.analyze.suspiciousInput", new Error("Submitted text looked like instructions to the AI"), { analysisId: id }).catch(() => {});
    }
    if (result.failedStages?.length) {
      // Sections that still failed after retries (rate limits, bad model output).
      logError("v1.analyze.stages", new Error(`${result.failedStages.length} section(s) failed`), {
        analysisId: id,
        failedStages: result.failedStages,
      }).catch(() => {});
    }
    if (trainingEntries.length > 0 && !trainingOptOut) {
      const batch = db.batch();
      for (const entry of trainingEntries) {
        batch.set(db.collection("trainingData").doc(), { analysisId: id, uid: apiCaller.ownerUid, ...entry });
      }
      await batch.commit().catch(() => {});
    }
    return json({ analysisId: id, result }, 200);
  } catch (err) {
    const timedOut = err instanceof RunTimeoutError;
    const message = err instanceof Error ? err.message : "Analysis failed";
    await Promise.allSettled([
      failRun(db, id, message), // marks failed + refunds the credit, exactly once
      logError(timedOut ? "v1.analyze.timeout" : "v1.analyze", err, { analysisId: id, orgId: apiCaller.orgId }),
    ]);
    return json({ analysisId: id, error: message }, timedOut ? 504 : 500);
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
