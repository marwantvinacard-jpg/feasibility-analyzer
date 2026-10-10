// POST /api/analyze — starts an analysis:
//   1. verify the caller and validate the input,
//   2. enforce approval, and pick who pays: the caller's own AI key (BYOK),
//      their organization's shared key, or one platform credit (atomic),
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
import { createLlm } from "@/lib/engine/factory";
import { ByokError, decryptSecret, verifyProviderKey, type EncryptedSecret } from "@/lib/byok";
import type { ByokProvider } from "@/lib/byokProviders";
import { decryptOrgLlmKey, type StoredOrgKey } from "@/lib/firebase/orgLlmKey";
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
// Must be a literal for Next.js; keep in sync with RUN_MAX_DURATION_S (lib/runLimits.ts).
// The background run counts against this limit.
export const maxDuration = 300;

// Burst protection on top of the per-run credit cost (see lib/rateLimit.ts).
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 60_000;

const initialStages = () =>
  Object.fromEntries(SIX_STAGES.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;

type PersonalKey = EncryptedSecret & { provider: ByokProvider };

/** Who pays for this run. */
type Payer =
  | { mode: "byok"; secret: PersonalKey }
  | { mode: "org"; orgId: string; secret: StoredOrgKey }
  | { mode: "platform" };

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

  // --- approval + who pays (atomic) ---
  // A run on the caller's own AI key, or on their organization's shared key,
  // costs no credit. A member's personal key wins over the org's (their
  // explicit choice beats the org default); everyone else spends one credit.
  let charged = false;
  let payer: Payer = { mode: "platform" };
  let orgId: string | undefined;
  try {
    ({ charged, payer, orgId } = await db.runTransaction<{ charged: boolean; payer: Payer; orgId?: string }>(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new HttpError(403, "Account not found.");
      const u = snap.data() as { status?: string; credits?: number; keyMode?: string; orgId?: string };
      if (u.status !== "approved") throw new HttpError(403, "Your account isn't approved yet.");

      if (u.keyMode === "byok") {
        const secret = await tx.get(userRef.collection("secrets").doc("llm"));
        if (!secret.exists) {
          throw new HttpError(400, "Add your AI key in Settings, or switch back to platform credits.");
        }
        return { charged: false, payer: { mode: "byok", secret: secret.data() as PersonalKey }, orgId: u.orgId };
      }

      if (u.orgId) {
        // Only a current member of an approved org runs on its key — checked
        // against the member roster, not just the orgId on the profile.
        const orgRef = db.collection("organizations").doc(u.orgId);
        const [org, member, orgKey] = await tx.getAll(
          orgRef,
          orgRef.collection("members").doc(caller.uid),
          orgRef.collection("secrets").doc("llmKey")
        );
        if (org.data()?.status === "approved" && member.exists && orgKey.exists) {
          return { charged: false, payer: { mode: "org", orgId: u.orgId, secret: orgKey.data() as StoredOrgKey }, orgId: u.orgId };
        }
      }

      const credits = u.credits ?? 0;
      if (credits < 1) throw new HttpError(402, "You're out of credits. Ask an admin to add more.");
      tx.update(userRef, { credits: credits - 1 });
      return { charged: true, payer: { mode: "platform" }, orgId: u.orgId };
    }));
  } catch (err) {
    const e = err as HttpError;
    return json({ error: e.message ?? "Not allowed" }, e.status ?? 403);
  }

  // A saved key is decrypted only here, for this run, and re-checked with the
  // provider first — a key revoked since it was saved fails now, clearly,
  // instead of every section failing one by one. No credit was taken above.
  if (payer.mode !== "platform") {
    const whose = payer.mode === "byok" ? "Your saved AI key" : "Your organization's shared AI key";
    const fixIt = payer.mode === "byok" ? "Settings → AI engine" : "ask the organization's owner to update it";
    let key: string;
    try {
      key = payer.mode === "byok" ? decryptSecret(payer.secret, caller.uid) : decryptOrgLlmKey(payer.orgId, payer.secret);
    } catch {
      return json({ error: `${whose} can't be read any more. Please save it again (${fixIt}).` }, 400);
    }
    try {
      await verifyProviderKey(payer.secret.provider, key);
    } catch (err) {
      const e = err as ByokError;
      return json({ error: `${e.message} (${fixIt})` }, e.status ?? 400);
    }
  }

  // Checked before the analysis record exists: if the server has no AI
  // provider configured, stop here (refunded) rather than produce mock
  // "reports" or leave a record stuck "running". The run itself builds its own
  // client later (lib/analysisRunner.ts).
  if (payer.mode === "platform") {
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
  await ref.set({
    id,
    uid: caller.uid,
    ...(orgId ? { orgId } : {}),
    createdAt: Date.now(),
    status: "running",
    input,
    stageStatus: initialStages(),
    charged,
    keyMode: payer.mode,
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
