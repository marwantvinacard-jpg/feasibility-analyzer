import { test } from "node:test";
import assert from "node:assert/strict";
import { isStale, RUN_BUDGET_MS, RUN_MAX_DURATION_S, STALE_RUN_MS } from "@/lib/runLimits";
import { RunTimeoutError, runBudgetMs, withTimeBudget } from "@/lib/runLifecycle";

test("#5: the run stops itself before the platform limit, and 'stale' only means truly dead", () => {
  assert.ok(RUN_BUDGET_MS < RUN_MAX_DURATION_S * 1000, "budget must end before the function is killed");
  assert.ok(STALE_RUN_MS > RUN_MAX_DURATION_S * 1000, "a run can't be swept while it could still be alive");
  assert.equal(isStale(Date.now() - STALE_RUN_MS - 1000), true);
  assert.equal(isStale(Date.now() - 60_000), false);
  assert.equal(isStale(undefined), false);
});

test("#5: withTimeBudget passes a result through, and times out slow work", async () => {
  assert.equal(await withTimeBudget(Promise.resolve(42), 1000), 42);
  await assert.rejects(withTimeBudget(new Promise(() => {}), 20), RunTimeoutError);
});

test("#5: FEASIBILITY_RUN_BUDGET_MS can lower the budget but never raise it past the limit", () => {
  const before = process.env.FEASIBILITY_RUN_BUDGET_MS;
  try {
    process.env.FEASIBILITY_RUN_BUDGET_MS = "30000";
    assert.equal(runBudgetMs(), 30_000);
    process.env.FEASIBILITY_RUN_BUDGET_MS = "9999999";
    assert.equal(runBudgetMs(), RUN_BUDGET_MS);
    process.env.FEASIBILITY_RUN_BUDGET_MS = "nonsense";
    assert.equal(runBudgetMs(), RUN_BUDGET_MS);
  } finally {
    if (before === undefined) delete process.env.FEASIBILITY_RUN_BUDGET_MS;
    else process.env.FEASIBILITY_RUN_BUDGET_MS = before;
  }
});
