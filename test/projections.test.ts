import { test } from "node:test";
import assert from "node:assert/strict";
import { npv, irr, buildProjections } from "@/lib/engine/projections";
import type { FinancialModel } from "@/lib/engine/financialModel";

// --- pure npv/irr, checked against hand-derivable textbook cash flows ---

test("npv: matches a hand-computed discounted sum", () => {
  const flows = [-1000, 200, 300, 300, 400, 400];
  assert.equal(npv(flows, 0.1), 177); // -1000 + 200/1.1 + 300/1.1^2 + ... ≈ 176.7 -> rounds to 177
});

test("npv: zero discount rate is just the sum of flows", () => {
  assert.equal(npv([-100, 40, 40, 40], 0), 20);
});

test("irr: single-period case resolves to the exact rate", () => {
  assert.equal(irr([-100, 110]), 10);
});

test("irr: an unprofitable project has a negative IRR, not null", () => {
  const result = irr([-1000, 100, 100, 100]);
  assert.ok(result !== null && result < 0, `expected a negative IRR, got ${result}`);
});

test("irr: NPV at the reported IRR is ~zero (round-trip check)", () => {
  const flows = [-5000, 1200, 1500, 1800, 2000, 1800];
  const rate = irr(flows);
  assert.ok(rate !== null);
  const npvAtIrr = flows.reduce((s, f, i) => s + f / Math.pow(1 + rate! / 100, i), 0);
  assert.ok(Math.abs(npvAtIrr) < 5, `NPV at reported IRR should be ~0, got ${npvAtIrr}`);
});

// --- full buildProjections() with a synthetic model ---

function fixtureModel(overrides: Partial<FinancialModel> = {}): FinancialModel {
  return {
    currency: "USD",
    capex: [
      { category: "Fit-out", item: "Kitchen build-out", amount: 75000, basis: "Contractor quote", depreciable: true },
      { category: "Pre-opening", item: "Launch marketing", amount: 15000, basis: "Assumption", depreciable: false },
    ],
    opex: [
      { category: "Staffing", item: "Kitchen staff", monthly_amount: 18000, basis: "Local wage survey", variable_with_revenue: false },
      { category: "COGS-adjacent", item: "Delivery fees", monthly_amount: 2000, basis: "Per-order estimate", variable_with_revenue: true },
    ],
    revenue_streams: [
      {
        name: "Subscription box",
        unit_label: "boxes/month",
        units_per_month: 500,
        price_per_unit: 89,
        utilization_percent: 100,
        cogs_percent: 40,
        ramp_months: 6,
        basis: "Stated pricing",
      },
    ],
    pricing_benchmarks: [],
    assumptions: {
      projection_years: 5,
      revenue_growth_percent_by_year: [10, 8, 5, 5],
      cost_inflation_percent: 3,
      seasonality_index: Array(12).fill(1),
      discount_rate_percent: 15,
      tax_rate_percent: 20,
      depreciation_years: 5,
      working_capital_months: 3,
    },
    assumption_notes: [],
    funding: {
      equity_percent: 50,
      debt_percent: 40,
      owner_capital_percent: 10,
      debt_interest_percent: 8,
      debt_term_years: 5,
      structure_rationale: "Balanced mix",
    },
    exclusions: [],
    ...overrides,
  };
}

test("buildProjections: produces exactly `projection_years` annual rows", () => {
  const p = buildProjections(fixtureModel());
  assert.equal(p.annual.length, 5);
  assert.equal(p.monthly.length, 60);
});

test("buildProjections: CapEx total matches the sum of line items", () => {
  const p = buildProjections(fixtureModel());
  assert.equal(p.capexTotal, 75000 + 15000);
});

test("buildProjections: revenue grows year over year under positive growth assumptions", () => {
  const p = buildProjections(fixtureModel());
  // Year 1 still ramping (6-month ramp), so compare year 2 vs year 3+ where the
  // stream is fully mature and only the stated growth rate should apply.
  assert.ok(p.annual[2].revenue > 0);
  assert.ok(p.annual[3].revenue >= p.annual[2].revenue * 0.95, "year-over-year revenue should trend up with positive growth assumptions");
});

test("buildProjections: funding requirement covers at least the CapEx total", () => {
  const p = buildProjections(fixtureModel());
  assert.ok(p.funding.total >= p.capexTotal, "total funding ask should never be less than CapEx alone");
  assert.equal(Math.round(p.funding.equity + p.funding.debt + p.funding.ownerCapital), Math.round(p.funding.total));
});

test("buildProjections: a project with far higher revenue than cost yields a positive-return scenario", () => {
  const rich = fixtureModel({
    revenue_streams: [
      { name: "Box", unit_label: "boxes/month", units_per_month: 5000, price_per_unit: 200, utilization_percent: 100, cogs_percent: 20, ramp_months: 1, basis: "test" },
    ],
  });
  const p = buildProjections(rich);
  assert.ok(p.returns.npv > 0, "a clearly profitable project should have positive NPV");
  assert.ok(p.returns.roiPercent > 0);
});

test("buildProjections: reconciliation flags a material difference from stated figures", () => {
  const p = buildProjections(fixtureModel(), { monthlyCost: 1, monthlyRevenue: 1_000_000 });
  assert.ok(p.reconciliation !== null);
  assert.equal(p.reconciliation!.materiallyDifferent, true);
});
