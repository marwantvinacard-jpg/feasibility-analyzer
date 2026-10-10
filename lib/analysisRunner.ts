// Runs one analysis from its record — the single place a run happens, however
// it was started (a Cloud Tasks job on Firebase App Hosting, or the in-process
// background fallback). Server-only.
//
// Everything it needs is read from the analysis record and its owner's
// account, so the route that created the record can reply immediately. It
// CLAIMS the record first, so a job delivered twice can never run twice, and it
// ends the run exactly once via completeRun/failRun (lib/runLifecycle.ts).

import { adminAuth, adminDb } from "./firebase/admin";
import { logError } from "./firebase/errorLog";
import { sendAnalysisReadyEmail } from "./email";
import { captureServerEvent } from "./posthog/server";
import { runFeasibility } from "./engine/runFeasibility";
import { createLlm, createLlmForKey } from "./engine/factory";
import { SerpApiProvider } from "./engine/search";
import { withTrainingLog, type TrainingEntry } from "./engine/trainingLog";
import { ALL_STAGES, type BusinessInput, type StageName, type StageStatus } from "./engine/types";
import { decryptSecret, type EncryptedSecret } from "./byok";
import type { ByokProvider } from "./byokProviders";
import { readOrgLlmKey } from "./firebase/orgLlmKey";
import { trainingAllowed } from "./trainingConsent";
import { completeRun, failRun, RunTimeoutError, withTimeBudget } from "./runLifecycle";

export type RunOutcome = "completed" | "failed" | "already-claimed" | "not-found";

const initialStages = () => Object.fromEntries(ALL_STAGES.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;

export async function executeAnalysis(analysisId: string): Promise<RunOutcome> {
  const db = adminDb();
  const ref = db.collection("analyses").doc(analysisId);

  // Claim: only a still-running, never-started record may run.
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return "not-found" as const;
    const d = snap.data()!;
    if (d.status !== "running" || d.runStartedAt) return "already-claimed" as const;
    tx.update(ref, { runStartedAt: Date.now() });
    return d;
  });
  if (claimed === "not-found" || claimed === "already-claimed") return claimed;

  const uid = claimed.uid as string;
  const input = claimed.input as BusinessInput;
  // Who pays was decided when the run was created (app/api/analyze/route.ts).
  const keyMode = (claimed.keyMode as "platform" | "byok" | "org" | undefined) ?? "platform";
  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.data() ?? {};

  let llm;
  try {
    if (keyMode === "byok") {
      const secret = (await db.collection("users").doc(uid).collection("secrets").doc("llm").get()).data() as
        | (EncryptedSecret & { provider: ByokProvider })
        | undefined;
      if (!secret) throw new Error("Your saved AI key was removed before the analysis started.");
      llm = createLlmForKey(secret.provider, decryptSecret(secret, uid));
    } else if (keyMode === "org") {
      const orgKey = await readOrgLlmKey(claimed.orgId as string);
      if (!orgKey) throw new Error("Your organization's shared AI key was removed before the analysis started.");
      llm = createLlmForKey(orgKey.provider, orgKey.apiKey);
    } else {
      llm = createLlm();
    }
  } catch (err) {
    await Promise.allSettled([
      failRun(db, analysisId, err instanceof Error ? err.message : "The analysis couldn't start."),
      logError("analyze.config", err, { analysisId }),
    ]);
    return "failed";
  }

  // Opt-in only, and never for runs on a customer's own key (personal or their org's).
  const keepTraining = trainingAllowed(user) && keyMode === "platform";
  const trainingEntries: TrainingEntry[] = [];
  const tracked = withTrainingLog(llm, (e) => trainingEntries.push(e));
  // No mock search for real runs — see lib/engine/search.ts.
  const search = new SerpApiProvider({ mock: tracked.mock });

  async function saveTrainingData() {
    if (!keepTraining || trainingEntries.length === 0) return;
    try {
      const batch = db.batch();
      for (const entry of trainingEntries) batch.set(db.collection("trainingData").doc(), { analysisId, uid, ...entry });
      await batch.commit();
    } catch {
      /* best-effort — never fails the analysis */
    }
  }

  captureServerEvent(uid, "analysis_started", { analysisId });
  const stageStatus = initialStages();
  try {
    const result = await withTimeBudget(
      runFeasibility(input, {
        llm: tracked,
        search,
        onProgress: (stage, status) => {
          stageStatus[stage] = status;
          ref.update({ [`stageStatus.${stage}`]: status }).catch(() => {});
        },
      })
    );
    if (!(await completeRun(db, analysisId, { result, stageStatus }))) return "failed"; // timed out / swept meanwhile

    if (result.research?.failed) {
      logError("analyze.research", new Error(`${result.research.failed}/${result.research.queries} web searches failed`), {
        analysisId,
        stagesWithoutResearch: result.research.stagesWithoutResearch,
        sampleError: result.research.sampleError ?? null,
      }).catch(() => {});
    }
    if (result.suspiciousInput) {
      logError("analyze.suspiciousInput", new Error("Submitted text looked like instructions to the AI"), { analysisId }).catch(() => {});
    }
    if (result.failedStages?.length) {
      logError("analyze.stages", new Error(`${result.failedStages.length} section(s) failed`), {
        analysisId,
        failedStages: result.failedStages,
      }).catch(() => {});
    }
    captureServerEvent(uid, "analysis_completed", { analysisId });
    await saveTrainingData();
    const email = (await adminAuth().getUser(uid).catch(() => null))?.email;
    if (email) await sendAnalysisReadyEmail(email, (user.name as string) ?? "", analysisId, input.business_idea).catch(() => {});
    return "completed";
  } catch (err) {
    const timedOut = err instanceof RunTimeoutError;
    const message = err instanceof Error ? err.message : "Analysis failed";
    await Promise.allSettled([
      failRun(db, analysisId, message), // marks failed + refunds the credit, exactly once
      saveTrainingData(),
      logError(timedOut ? "analyze.timeout" : "analyze.run", err, { analysisId, uid }),
    ]);
    captureServerEvent(uid, "analysis_failed", { analysisId, message });
    return "failed";
  }
}
