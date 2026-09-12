import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFinancials } from "@/lib/engine/financial";
import type { BusinessInput } from "@/lib/engine/types";

const base: BusinessInput = {
  business_idea: "test",
  target_customer: "test",
  location: "test",
  problem_solved: "test",
  product_service: "test",
  revenue_model: "test",
  competitors: "test",
  monthly_cost: 0,
  monthly_revenue: 0,
  unique_advantage: "test",
};

test("computeFinancials: healthy business — profit, margin, break-even all correct", () => {
  const r = computeFinancials({ ...base, monthly_revenue: 68000, monthly_cost: 42000 });
  assert.equal(r.monthly_profit, 26000);
  assert.equal(r.annual_revenue, 68000 * 12);
  assert.equal(r.annual_profit, 26000 * 12);
  assert.equal(r.profit_margin_percent, Math.round((26000 / 68000) * 1000) / 10);
  assert.equal(r.revenue_to_cost_ratio, Math.round((68000 / 42000) * 100) / 100);
  assert.equal(r.cash_flow_status, "Positive");
  // startup costs assumed 3x monthly cost; break-even = ceil(startupCosts / monthly_profit)
  assert.equal(r.break_even_months, Math.ceil((42000 * 3) / 26000));
  assert.equal(r.startup_capital_needed, 42000 * 6);
  assert.equal(r.working_capital_needed, 42000 * 3);
});

test("computeFinancials: loss-making business never breaks even", () => {
  const r = computeFinancials({ ...base, monthly_revenue: 10000, monthly_cost: 20000 });
  assert.equal(r.monthly_profit, -10000);
  assert.equal(r.break_even_months, null);
  assert.equal(r.cash_flow_status, "Negative");
});

test("computeFinancials: exact break-even (profit = 0)", () => {
  const r = computeFinancials({ ...base, monthly_revenue: 10000, monthly_cost: 10000 });
  assert.equal(r.monthly_profit, 0);
  assert.equal(r.cash_flow_status, "Break-even");
  assert.equal(r.break_even_months, null); // non-positive profit never resolves a finite break-even
});

test("computeFinancials: zero revenue doesn't divide by zero", () => {
  const r = computeFinancials({ ...base, monthly_revenue: 0, monthly_cost: 5000 });
  assert.equal(r.profit_margin_percent, 0);
  assert.equal(Number.isFinite(r.revenue_to_cost_ratio), true);
});

test("computeFinancials: financial_feasibility_score is always within 0-100", () => {
  const cases = [
    { monthly_revenue: 100000, monthly_cost: 10000 }, // best case
    { monthly_revenue: 0, monthly_cost: 50000 }, // worst case
    { monthly_revenue: 51000, monthly_cost: 50000 }, // marginal
  ];
  for (const c of cases) {
    const r = computeFinancials({ ...base, ...c });
    assert.ok(r.financial_feasibility_score >= 0 && r.financial_feasibility_score <= 100, `score ${r.financial_feasibility_score} out of range for ${JSON.stringify(c)}`);
  }
});
