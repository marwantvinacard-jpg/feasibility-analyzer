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
import { SerpApiProvider } from "@/lib/engine/search";
import { adminDb } from "@/lib/firebase/admin";
import { requireApiKey } from "@/lib/firebase/apiKeyAuth";
import { HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { withTrainingLog, type TrainingEntry } from "@/lib/engine/trainingLog";
import type { BusinessInput } from "@/lib/engine/types";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

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

  const rl = checkRateLimit(apiCaller.keyId, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return json(
      { error: `Rate limit exceeded (${RATE_LIMIT} requests/minute per key). Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
      429
    );
  }

  const { input } = (await req.json().catch(() => ({}))) as { input?: BusinessInput };
  if (!input?.business_idea) return json({ error: "Missing 'input.business_idea'." }, 400);

  const db = adminDb();
  const ownerRef = db.collection("users").doc(apiCaller.ownerUid);

  let charged = false;
  try {
    charged = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ownerRef);
      const credits = (snap.data()?.credits as number) ?? 0;
      if (credits < 1) throw new HttpError(402, "The organization is out of credits.");
      tx.update(ownerRef, { credits: credits - 1 });
      return true;
    });
  } catch (err) {
    const e = err as HttpError;
    return json({ error: e.message ?? "Not allowed" }, e.status ?? 403);
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

  const baseLlm = createLlm();
  const trainingEntries: TrainingEntry[] = [];
  const llm = withTrainingLog(baseLlm, (e) => trainingEntries.push(e));
  const search = new SerpApiProvider({ mock: llm.mock || !process.env.SERPAPI_API_KEY });

  try {
    const result = await runFeasibility(input, { llm, search });
    await ref.update({ status: "complete", result });
    if (trainingEntries.length > 0) {
      const batch = db.batch();
      for (const entry of trainingEntries) {
        batch.set(db.collection("trainingData").doc(), { analysisId: id, uid: apiCaller.ownerUid, ...entry });
      }
      await batch.commit().catch(() => {});
    }
    return json({ analysisId: id, result }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    await Promise.allSettled([
      ref.update({ status: "failed", error: message }),
      charged ? ownerRef.update({ credits: FieldValue.increment(1) }) : Promise.resolve(),
    ]);
    return json({ error: message }, 500);
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
