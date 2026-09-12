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

test("scoreRisks: empty risk list doesn't crash and scores as zero risk", () => {
  const result = scoreRisks({ risks: [], dealbreaker_risks: [] });
  assert.equal(result.overallRiskScore, 0);
  assert.equal(result.riskLevel, "Low");
});
