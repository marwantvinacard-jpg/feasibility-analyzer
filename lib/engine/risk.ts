// Deterministic risk scoring. This is the biggest correctness fix from the
// port: in n8n the Risk agent emitted a *markdown table*, so the scorer's
// regex `extractScore(riskData, 'overall_risk_score')` never matched and the
// risk score was ALWAYS the 50 fallback. Here the specialist returns
// structured rows and we compute everything the prompt described, in code.

import type { RiskAnalysis, RiskRow, RiskScoring } from "./types";

export function scoreRisks(analysis: RiskAnalysis): RiskScoring {
  const withPriority: RiskRow[] = analysis.risks.map((r) => ({
    ...r,
    priority: round1((r.impact * r.probability) / 100),
  }));

  const rankedRisks = [...withPriority].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // Overall risk = average of the top-5 risk priorities.
  const top = rankedRisks.slice(0, 5);
  const overallRiskScore =
    top.length > 0
      ? Math.round(top.reduce((sum, r) => sum + (r.priority ?? 0), 0) / top.length)
      : 0;

  const riskLevel: RiskScoring["riskLevel"] =
    overallRiskScore <= 25
      ? "Low"
      : overallRiskScore <= 50
        ? "Medium"
        : overallRiskScore <= 75
          ? "High"
          : "Critical";

  // Feeds the weighted score: higher = safer, so invert.
  const riskFeasibilityScore = 100 - overallRiskScore;

  return { rankedRisks, overallRiskScore, riskLevel, riskFeasibilityScore };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
