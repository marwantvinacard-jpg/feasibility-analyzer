import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreRisks } from "@/lib/engine/risk";
import type { RiskRow } from "@/lib/engine/types";

const row = (impact: number, probability: number, category = "Market"): RiskRow => ({
  category, description: `${category} risk`, impact, probability, mitigation: "mitigate", contingency: "contingency",
});

test("scoreRisks: priority is impact * probability / 100, ranked descending", () => {
  const result = scoreRisks({ risks: [row(80, 50), row(20, 10), row(90, 90)], dealbreaker_risks: [] });
  assert.equal(result.rankedRisks[0].priority, 81); // 90*90/100
  assert.equal(result.rankedRisks[1].priority, 40); // 80*50/100
  assert.equal(result.rankedRisks[2].priority, 2); // 20*10/100
});

test("scoreRisks: overall score is the average of the top 5 priorities, capped even with more rows", () => {
  const rows = Array.from({ length: 8 }, (_, i) => row(50, 50)); // all priority 25
  const result = scoreRisks({ risks: rows, dealbreaker_risks: [] });
  assert.equal(result.overallRiskScore, 25);
});

test("scoreRisks: risk level bands", () => {
  const at = (p: number) => scoreRisks({ risks: [row(p, 100)], dealbreaker_risks: [] });
  assert.equal(at(25).riskLevel, "Low");
  assert.equal(at(50).riskLevel, "Medium");
  assert.equal(at(75).riskLevel, "High");
  assert.equal(at(100).riskLevel, "Critical");
});

test("scoreRisks: riskFeasibilityScore is the inverse (higher = safer)", () => {
  const result = scoreRisks({ risks: [row(40, 100)], dealbreaker_risks: [] });
  assert.equal(result.riskFeasibilityScore, 100 - result.overallRiskScore);
});

test("scoreRisks: an empty register is 'not assessed' and scores a neutral 50, never 100/100 'Low'", () => {
  const result = scoreRisks({ risks: [], dealbreaker_risks: [] });
  assert.equal(result.assessed, false);
  assert.equal(result.overallRiskScore, 50);
  assert.equal(result.riskFeasibilityScore, 50);
  assert.notEqual(result.riskLevel, "Low");
});

test("scoreRisks: a real register is marked assessed", () => {
  const result = scoreRisks({
    risks: [{ category: "Market", description: "d", impact: 40, probability: 50, mitigation: "m", contingency: "c" }],
    dealbreaker_risks: [],
  });
  assert.equal(result.assessed, true);
  assert.equal(result.overallRiskScore, 20);
});
