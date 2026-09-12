import { test } from "node:test";
import assert from "node:assert/strict";
import { WEIGHTS, computeCategoryScores, overallAssessment, summarize } from "@/lib/engine/scorer";
import type { CategoryScores, FinancialCalculations, RiskScoring, StageResults } from "@/lib/engine/types";

test("scorer: WEIGHTS sum to exactly 1.0", () => {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights summed to ${sum}, expected 1`);
});

test("scorer: verdict bands match the documented thresholds", () => {
  const at = (score: number): CategoryScores => ({
    market: score, financial: score, technical: score, competitive: score,
    location: score, operational: score, legal: score, risk: score,
  });
  assert.equal(overallAssessment(at(80)).recommendation, "GO");
  assert.equal(overallAssessment(at(60)).recommendation, "GO (with conditions)");
  assert.equal(overallAssessment(at(40)).recommendation, "CONDITIONAL (major improvements needed)");
  assert.equal(overallAssessment(at(0)).recommendation, "NO-GO");
  assert.equal(overallAssessment(at(79)).rating, "FEASIBLE"); // just under the GO band
});

test("scorer: a missing stage falls back to 50, not zero or undefined", () => {
  const financials = { financial_feasibility_score: 70 } as FinancialCalculations;
  const risk: RiskScoring = { rankedRisks: [], overallRiskScore: 20, riskLevel: "Low", riskFeasibilityScore: 80 };
  const { scores, missing } = computeCategoryScores({} as StageResults, financials, risk);
  assert.equal(scores.market, 50);
  assert.equal(scores.technical, 50);
  assert.equal(scores.financial, 70); // financial always comes from computed financials, never "missing"
  assert.deepEqual(missing.sort(), ["competitive", "legal", "location", "market", "operational", "technical"].sort());
});

test("scorer: summarize flags critical issues below 40 and strengths at/above 75", () => {
  const scores: CategoryScores = {
    market: 30, financial: 90, technical: 50, competitive: 76,
    location: 50, operational: 50, legal: 50, risk: 50,
  };
  const overall = overallAssessment(scores);
  const { criticalIssues, strengths } = summarize(scores, overall);
  assert.ok(criticalIssues.some((s) => s.toLowerCase().includes("market")));
  assert.ok(strengths.some((s) => s.toLowerCase().includes("financial")));
});
