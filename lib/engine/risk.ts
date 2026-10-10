// Deterministic risk scoring. This is the biggest correctness fix from the
// port: in n8n the Risk agent emitted a *markdown table*, so the scorer's
// regex `extractScore(riskData, 'overall_risk_score')` never matched and the
// risk score was ALWAYS the 50 fallback. Here the specialist returns
// structured rows and we compute everything the prompt described, in code.

import type { RiskAnalysis, RiskRow, RiskScoring } from "./types";

/**
 * Used when there is no risk register to score. An empty register used to
 * score as ZERO risk — 100/100 "Low" — so a failed risk specialist made a
 * business look safe. No register means "not assessed", scored neutrally like
 * any other failed section (see FAILED_STAGE_SCORE in scorer.ts).
 */
export const UNASSESSED_RISK_SCORE = 50;

export function scoreRisks(analysis: RiskAnalysis): RiskScoring {
  if (analysis.risks.length === 0) {
    return {
      rankedRisks: [],
      overallRiskScore: UNASSESSED_RISK_SCORE,
      riskLevel: "Medium",
      riskFeasibilityScore: 100 - UNASSESSED_RISK_SCORE,
      assessed: false,
    };
  }
  const withPriority: RiskRow[] = analysis.risks.map((r) => ({
    ...r,
    priority: round1((r.impact * r.probability) / 100),
  }));

  const rankedRisks = [...withPriority].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // Overall risk = average of the top-5 risk priorities.
  const top = rankedRisks.slice(0, 5);
  const overallRiskScore =
    Math.round(top.reduce((sum, r) => sum + (r.priority ?? 0), 0) / top.length);

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

  return { rankedRisks, overallRiskScore, riskLevel, riskFeasibilityScore, assessed: true };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
