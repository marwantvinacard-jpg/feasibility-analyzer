// Time limits for an analysis run. Browser-safe (no server imports), so the
// report page can tell a run that's merely slow from one that's dead.

/** Route maxDuration for analysis runs, in seconds (the routes' literal exports must match). */
export const RUN_MAX_DURATION_S = 300;

/** The pipeline gives up (and refunds) this long into a run — before the platform kills the function. */
export const RUN_BUDGET_MS = (RUN_MAX_DURATION_S - 25) * 1000;

/** A "running" analysis older than this can't still be alive: its function has been killed. */
export const STALE_RUN_MS = (RUN_MAX_DURATION_S + 60) * 1000;

export const isStale = (createdAt: unknown, now = Date.now()) =>
  typeof createdAt === "number" && now - createdAt > STALE_RUN_MS;
