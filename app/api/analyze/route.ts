// POST /api/analyze — starts an analysis:
//   1. verify the caller and validate the input,
//   2. enforce approval + credits (atomic decrement, unless BYOK),
//   3. create the analyses/{id} doc and reply at once with { analysisId },
//   4. hand the run to the background (lib/runDispatch.ts → lib/analysisRunner.ts),
//      which writes progress and the result to the doc; the report page shows
//      it live from Firestore.
//
// The run used to live inside a streamed response: closing the tab (or a
// phone going to sleep) cancelled it, and a run cut off by the time limit was
// left "running" forever with the credit gone. Now it doesn't depend on the
// browser at all, stops itself (refunded) before the time limit, and anything
// still "running" after a hard crash is failed + refunded by the stale-run
// sweep (lib/runLifecycle.ts).

import { FieldValue } from "firebase-admin/firestore";
import { createLlm, type HostedProviderName } from "@/lib/engine/factory";
import { ByokError, decryptSecret, verifyProviderKey, type EncryptedSecret } from "@/lib/byok";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError, type Caller } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";
import { SIX_STAGES, type BusinessInput, type StageName, type StageStatus } from "@/lib/engine/types";
import { checkRateLimit } from "@/lib/rateLimit";
import { readJsonBody, validateBusinessInput } from "@/lib/engine/validateInput";
import { dispatchAnalysisRun } from "@/lib/runDispatch";
import { failRun } from "@/lib/runLifecycle";

export const runtime = "nodejs";
// Must be a literal for Next.js; keep in sync with RUN_MAX_DURATION_S (lib/runLifecycle.ts).
// The background run counts against this limit.
export const maxDuration = 300;

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

  const rl = await checkRateLimit(`analyze:${caller.uid}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return json(
      { error: `Too many analyses started at once. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
      429
    );
  }

  // Size + shape checks happen before any credit is taken or model called.
  const body = await readJsonBody(req);
  if (!body.ok) return json({ error: body.error }, body.status);
  if (!body.body?.input) return json({ error: "Missing business input." }, 400);
  const checked = validateBusinessInput(body.body.input);
  if (!checked.ok) return json({ error: checked.error }, checked.status);
  const input: BusinessInput = checked.input;

  const db = adminDb();
  const userRef = db.collection("users").doc(caller.uid);

  // --- approval + credit gate (atomic) ---
  // Bring-your-own-key accounts run on their own AI key and are not charged a
  // credit; everyone else spends one credit per run.
  type StoredKey = EncryptedSecret & { provider: HostedProviderName };
  let charged = false;
  let byokSecret: StoredKey | null = null;
  try {
    ({ charged, byokSecret } = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new HttpError(403, "Account not found.");
      const u = snap.data() as { status?: string; credits?: number; keyMode?: string };
      if (u.status !== "approved") throw new HttpError(403, "Your account isn't approved yet.");
      if (u.keyMode === "byok") {
        const secret = await tx.get(userRef.collection("secrets").doc("llm"));
        if (!secret.exists) {
          throw new HttpError(400, "Add your AI key in Settings, or switch back to platform credits.");
        }
        return { charged: false, byokSecret: secret.data() as StoredKey };
      }
      const credits = u.credits ?? 0;
      if (credits < 1) throw new HttpError(402, "You're out of credits. Ask an admin to add more.");
      tx.update(userRef, { credits: credits - 1 });
      return { charged: true, byokSecret: null };
    }));
  } catch (err) {
    const e = err as HttpError;
    return json({ error: e.message ?? "Not allowed" }, e.status ?? 403);
  }

  // A BYOK key is decrypted only here, for this run, and re-checked with the
  // provider first — a key revoked since it was saved fails now, clearly,
  // instead of every section failing one by one. No credit was taken above.
  let byokKey: string | null = null;
  if (byokSecret) {
    try {
      byokKey = decryptSecret(byokSecret, caller.uid);
    } catch {
      return json({ error: "Your saved AI key can't be read any more. Please save it again in Settings." }, 400);
    }
    try {
      await verifyProviderKey(byokSecret.provider, byokKey);
    } catch (err) {
      const e = err as ByokError;
      return json({ error: `${e.message} (Settings → AI engine)` }, e.status ?? 400);
    }
  }

  // Checked before the analysis record exists: if the server has no AI
  // provider configured, stop here (refunded) rather than produce mock
  // "reports" or leave a record stuck "running". The run itself builds its own
  // client later (lib/analysisRunner.ts).
  if (!byokSecret) {
    try {
      createLlm();
    } catch (err) {
      await Promise.allSettled([
        charged ? userRef.update({ credits: FieldValue.increment(1) }) : Promise.resolve(),
        logError("analyze.config", err, { uid: caller.uid }),
      ]);
      return json({ error: "The analysis service isn't available right now. You haven't been charged." }, 503);
    }
  }

  // --- create the analysis record ---
  const ref = db.collection("analyses").doc();
  const id = ref.id;
  const orgId = (await userRef.get()).data()?.orgId as string | undefined;
  await ref.set({
    id,
    uid: caller.uid,
    ...(orgId ? { orgId } : {}),
    createdAt: Date.now(),
    status: "running",
    input,
    stageStatus: initialStages(),
    charged,
    keyMode: byokSecret ? "byok" : "platform",
    reviewStatus: "unreviewed",
  });
  await logAudit({ uid: caller.uid, email: caller.email, action: "analysis.run", target: id, meta: { business_idea: input.business_idea } });

  // Hand the run to the background (Cloud Tasks on Firebase App Hosting, or
  // after() elsewhere) and reply at once; the report page follows it live.
  try {
    await dispatchAnalysisRun(id);
  } catch (err) {
    await Promise.allSettled([
      failRun(db, id, "The analysis couldn't be started. Your credit has been refunded — please try again."),
      logError("analyze.dispatch", err, { analysisId: id }),
    ]);
    return json({ error: "The analysis couldn't be started. You haven't been charged — please try again." }, 503);
  }
  return json({ analysisId: id }, 202);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
