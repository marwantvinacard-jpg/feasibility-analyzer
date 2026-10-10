// How an analysis run ends — exactly once. Server-only.
//
// An analysis doc starts as status "running". Several things can end it: the
// pipeline finishing, the pipeline failing, the run's own time budget running
// out, or a sweep that finds a run whose server was killed (time limit, crash,
// deploy). Each of those goes through completeRun/failRun, which only act while
// the doc is STILL "running" — so the first one wins, a late finish can't
// overwrite a timeout, and a charged credit is refunded at most once.

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { RUN_BUDGET_MS, isStale } from "./runLimits";
export { RUN_BUDGET_MS, RUN_MAX_DURATION_S, STALE_RUN_MS, isStale } from "./runLimits";

export const TIMED_OUT_MESSAGE =
  "The analysis took too long and was stopped. Your credit has been refunded — please try again.";
export const INTERRUPTED_MESSAGE =
  "The analysis was interrupted before it could finish. Your credit has been refunded — please try again.";

/** Marks a running analysis failed and refunds its credit, once. Returns false if it had already ended. */
export async function failRun(db: Firestore, analysisId: string, message: string): Promise<boolean> {
  const ref = db.collection("analyses").doc(analysisId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.data();
    if (!snap.exists || d?.status !== "running") return false;
    const refund = d.charged === true && d.refunded !== true && typeof d.uid === "string";
    tx.update(ref, { status: "failed", error: message, endedAt: Date.now(), ...(refund ? { refunded: true } : {}) });
    if (refund) tx.update(db.collection("users").doc(d.uid), { credits: FieldValue.increment(1) });
    return true;
  });
}

/** Stores the finished result — only if the run is still "running" (not timed out / swept meanwhile). */
export async function completeRun(db: Firestore, analysisId: string, fields: Record<string, unknown>): Promise<boolean> {
  const ref = db.collection("analyses").doc(analysisId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.status !== "running") return false;
    tx.update(ref, { ...fields, status: "complete", endedAt: Date.now() });
    return true;
  });
}

/**
 * Fails + refunds every run that's still "running" long after its function
 * must have died. Scoped to one user when `uid` is given (cheap enough to run
 * whenever they open their dashboard or a report). Equality-only filters, so
 * no composite index is needed; running docs are few, so the age filter is
 * done in memory.
 */
export async function sweepStaleRuns(db: Firestore, opts: { uid?: string } = {}): Promise<number> {
  let q = db.collection("analyses").where("status", "==", "running");
  if (opts.uid) q = q.where("uid", "==", opts.uid);
  const snap = await q.select("createdAt").get();
  const now = Date.now();
  let swept = 0;
  for (const d of snap.docs) {
    if (isStale(d.data().createdAt, now) && (await failRun(db, d.id, INTERRUPTED_MESSAGE))) swept++;
  }
  return swept;
}

export class RunTimeoutError extends Error {
  constructor() {
    super(TIMED_OUT_MESSAGE);
  }
}

/**
 * The run's time budget. FEASIBILITY_RUN_BUDGET_MS can lower it — e.g. on a
 * hosting plan with a shorter function limit (keep it ~25 s under that limit).
 */
export function runBudgetMs(): number {
  const n = Number(process.env.FEASIBILITY_RUN_BUDGET_MS);
  return Number.isFinite(n) && n > 0 ? Math.min(n, RUN_BUDGET_MS) : RUN_BUDGET_MS;
}

/** Resolves with `work`, or rejects with RunTimeoutError after `ms`. The timer is cleared as soon as `work` settles. */
export function withTimeBudget<T>(work: Promise<T>, ms: number = runBudgetMs()): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RunTimeoutError()), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
