// Weighted overall scoring + GO/NO-GO verdict. Preserves the n8n "Master
// Calculator & Scorer" logic exactly (weights, bands, strengths/issues,
// conditions, next steps) — but reads each dimension's score by NAME from
// validated structured data instead of positionally from a 6-way merge, so a
// single failed/reordered branch can never shift scores onto the wrong axis.

import type {
  CategoryScores,
  FinancialCalculations,
  OverallAssessment,
  RiskScoring,
  StageName,
  StageResults,
} from "./types";

export const WEIGHTS: Record<keyof CategoryScores, number> = {
  market: 0.18,
  financial: 0.25,
  technical: 0.12,
  competitive: 0.1,
  location: 0.08,
  operational: 0.1,
  legal: 0.12,
  risk: 0.05,
};

/** Score used only when a stage genuinely failed after retries. */
const FAILED_STAGE_SCORE = 50;

export function computeCategoryScores(
  stages: StageResults,
  financials: FinancialCalculations,
  risk: RiskScoring
): { scores: CategoryScores; missing: StageName[] } {
  const missing: StageName[] = [];
  const pick = (name: StageName, value: number | undefined): number => {
    if (value === undefined || Number.isNaN(value)) {
      missing.push(name);
      return FAILED_STAGE_SCORE;
    }
    return value;
  };

  const scores: CategoryScores = {
    market: pick("market", stages.market?.market_feasibility_score),
    financial: financials.financial_feasibility_score,
    technical: pick("technical", stages.technical?.technical_feasibility_score),
    competitive: pick("competitive", stages.competitive?.competitive_feasibility_score),
    location: pick("location", stages.location?.location_feasibility_score),
    operational: pick("operational", stages.operational?.operational_feasibility_score),
    legal: pick("legal", stages.legal?.legal_feasibility_score),
    risk: risk.riskFeasibilityScore,
  };
  return { scores, missing };
}

export function overallAssessment(scores: CategoryScores): OverallAssessment {
  const overall_score = Math.round(
    scores.market * WEIGHTS.market +
      scores.financial * WEIGHTS.financial +
      scores.technical * WEIGHTS.technical +
      scores.competitive * WEIGHTS.competitive +
      scores.location * WEIGHTS.location +
      scores.operational * WEIGHTS.operational +
      scores.legal * WEIGHTS.legal +
      scores.risk * WEIGHTS.risk
  );

  if (overall_score >= 80)
    return { overall_score, rating: "HIGHLY FEASIBLE", recommendation: "GO", emoji: "✅" };
  if (overall_score >= 60)
    return {
      overall_score,
      rating: "FEASIBLE",
      recommendation: "GO (with conditions)",
      emoji: "⚠️",
    };
  if (overall_score >= 40)
    return {
      overall_score,
      rating: "MARGINALLY FEASIBLE",
      recommendation: "CONDITIONAL (major improvements needed)",
      emoji: "⚠️",
    };
  return { overall_score, rating: "NOT FEASIBLE", recommendation: "NO-GO", emoji: "❌" };
}

const LABELS: Record<keyof CategoryScores, { critical: string; strength: string; condition: string }> = {
  market: {
    critical: "Market Feasibility",
    strength: "Strong Market Opportunity",
    condition: "Validate market demand through customer research",
  },
  financial: {
    critical: "Financial Viability",
    strength: "Solid Financial Projections",
    condition: "Improve financial projections and reduce costs",
  },
  technical: {
    critical: "Technical Execution",
    strength: "Feasible Technical Execution",
    condition: "Address technical execution challenges",
  },
  competitive: {
    critical: "Competitive Position",
    strength: "Good Competitive Position",
    condition: "Strengthen competitive differentiation",
  },
  location: {
    critical: "Location Suitability",
    strength: "Suitable Location",
    condition: "Reconsider location or adapt business model",
  },
  operational: {
    critical: "Operational Feasibility",
    strength: "Sound Operational Plan",
    condition: "Strengthen staffing, supply chain or process design",
  },
  legal: {
    critical: "Legal & Regulatory Exposure",
    strength: "Manageable Legal Position",
    condition: "Resolve licensing, compliance or liability gaps",
  },
  risk: {
    critical: "Risk Level Too High",
    strength: "Manageable Risk Profile",
    condition: "Develop comprehensive risk mitigation plan",
  },
};

const KEYS = Object.keys(LABELS) as (keyof CategoryScores)[];

export function summarize(scores: CategoryScores, overall: OverallAssessment) {
  const criticalIssues = KEYS.filter((k) => scores[k] < 40).map((k) => LABELS[k].critical);
  const strengths = KEYS.filter((k) => scores[k] >= 75).map((k) => LABELS[k].strength);

  const isConditional =
    overall.recommendation.includes("conditions") || overall.recommendation.includes("CONDITIONAL");
  const conditions = isConditional
    ? KEYS.filter((k) => scores[k] < 60).map((k) => LABELS[k].condition)
    : [];

  const nextSteps =
    overall.overall_score >= 60
      ? [
          "Develop detailed business plan",
          "Create financial model with monthly projections",
          "Conduct customer validation interviews",
          "Research legal requirements and obtain licenses",
          "Build minimum viable product (MVP)",
        ]
      : [
          "Address critical issues identified in analysis",
          "Revise business model based on findings",
          "Conduct additional market research",
          "Reassess financial assumptions",
          "Consider pivoting or adjusting approach",
        ];

  return {
    criticalIssues: criticalIssues.length ? criticalIssues : ["None identified"],
    strengths: strengths.length ? strengths : ["Review needed"],
    conditions,
    nextSteps,
  };
}
