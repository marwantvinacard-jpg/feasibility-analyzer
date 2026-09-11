// Core domain types for the FeasibilityAI engine.
// Ported from the n8n "Miss Sophie" workflow; the 10 data points, the six
// feasibility dimensions, the weighted scoring, and the GO/NO-GO bands are
// preserved exactly. See lib/engine/scorer.ts for the weights and bands.

/** The 10 business data points the whole analysis is built on. */
export interface BusinessInput {
  business_idea: string;
  target_customer: string;
  location: string;
  problem_solved: string;
  product_service: string;
  revenue_model: string;
  competitors: string;
  monthly_cost: number;
  monthly_revenue: number;
  unique_advantage: string;
  /** ISO currency code for display, e.g. "USD". Defaults to USD. */
  currency?: string;

  // --- Optional inputs for the financial feasibility study. All have sensible
  // defaults, so the original 10-field flow is unchanged when they are absent.

  /** Length of the financial projection, 3-5 years. Defaults to 5. */
  projection_years?: number;
  /** Known setup budget, when the applicant has one. Anchors the CapEx model. */
  capex_budget?: number;
  /** Preferred funding mix in the applicant's own words, e.g. "60% equity, 40% bank loan". */
  funding_preference?: string;

  /** Free-text extracted from documents the applicant uploaded (optional extra context). */
  knowledge_base?: string;

  /** Industry vertical key (see lib/engine/verticals.ts) — steers CapEx/OpEx/revenue-unit guidance. */
  business_type?: string;
}

export const REQUIRED_TEXT_FIELDS = [
  "business_idea",
  "target_customer",
  "location",
  "problem_solved",
  "product_service",
  "revenue_model",
  "competitors",
  "unique_advantage",
] as const;

export const REQUIRED_NUMERIC_FIELDS = ["monthly_cost", "monthly_revenue"] as const;

export const ALL_FIELDS = [
  ...REQUIRED_TEXT_FIELDS.slice(0, 7),
  "monthly_cost",
  "monthly_revenue",
  "unique_advantage",
] as const;

export type FieldKey = keyof BusinessInput;

export const FIELD_LABELS: Record<string, string> = {
  business_idea: "Business Idea",
  target_customer: "Target Customer",
  location: "Location (City, Country)",
  problem_solved: "Problem Being Solved",
  product_service: "Product/Service Description",
  revenue_model: "Revenue Model",
  competitors: "Main Competitors",
  monthly_cost: "Monthly Operating Costs",
  monthly_revenue: "Expected Monthly Revenue",
  unique_advantage: "Unique Advantage/Differentiation",
};

/**
 * Result of extracting + validating the 10 fields from free text.
 * Mirrors the n8n "Data Validator" node output, minus the debug cruft.
 */
export interface ExtractionResult {
  data: Partial<BusinessInput>;
  completeness: number; // 0-100, % of the 10 fields satisfactorily filled
  missingFields: string[]; // machine keys
  missingFieldsReadable: string[]; // human labels
  isComplete: boolean; // completeness >= COMPLETENESS_THRESHOLD
}

export const SIX_STAGES = [
  "market",
  "financial",
  "technical",
  "competitive",
  "location",
  "risk",
] as const;
export type StageName = (typeof SIX_STAGES)[number];

export type StageStatus = "pending" | "running" | "done" | "failed";

/** A cited source surfaced by a specialist during web research. */
export interface Source {
  title?: string;
  url: string;
}

// --- Structured outputs from each specialist (post-LLM, validated) ---

export interface MarketAnalysis {
  market_size: { tam: string; sam: string; som: string };
  customer_validation: {
    clarity_score: number;
    problem_impact_score: number;
    willingness_to_pay_score: number;
    total_score: number;
    reasoning: string;
  };
  market_timing: { trend: "Growing" | "Stable" | "Declining"; timing_assessment: string };
  market_access: { difficulty: "Easy" | "Medium" | "Hard"; channels: string[]; reasoning: string };
  market_feasibility_score: number;
  red_flags: string[];
  opportunities: string[];
  research_sources: string[];
}

/** The LLM's *judgment* half of the financial analysis. The math is in code. */
export interface FinancialJudgment {
  revenue_certainty: "High" | "Moderate" | "Low";
  revenue_certainty_reasoning: string;
  concerns: string[];
  strengths: string[];
  recommendations: string[];
}

export interface TechnicalAnalysis {
  execution_complexity: {
    score: number; // 0-10, lower = easier
    level: "Low" | "Medium" | "High";
    required_skills: string[];
    required_resources: string[];
    challenges: string[];
  };
  unique_advantage: {
    score: number; // 0-10
    strength: "Strong" | "Moderate" | "Weak" | "None";
    defensibility: "High" | "Medium" | "Low";
    analysis: string;
    can_competitors_copy: "Yes" | "No" | "Partially";
  };
  scalability: { score: number; level: string; scaling_factors: string[]; bottlenecks: string[] };
  time_to_market: { estimated_months: number; category: string; breakdown: string };
  required_capabilities: {
    technical_skills: string[];
    certifications: string[];
    equipment: string[];
    partnerships: string[];
    minimum_team_size: number;
  };
  technical_risks: { risk: string; severity: string; mitigation: string }[];
  technical_feasibility_score: number;
  overall_assessment: string;
}

export interface Competitor {
  competitor_name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  pricing: string;
  website: string;
}

export interface CompetitiveAnalysis {
  competitive_research: Competitor[];
  competitive_intensity: { score: number; level: string; analysis: string };
  differentiation: { score: number; level: string; differentiation_factors: string[]; analysis: string };
  entry_barriers: { score: number; level: string; barriers: string[] };
  positioning_recommendation: {
    price_position: string;
    quality_position: string;
    target_segment: string;
    strategic_approach: string;
    rationale: string;
  };
  competitive_threats: { threat: string; severity: string; mitigation: string }[];
  competitive_advantages: string[];
  competitive_feasibility_score: number;
  research_sources: string[];
  overall_assessment: string;
}

export interface LocationAnalysis {
  location_analysis: {
    city: string;
    country: string;
    suitability_score: number;
    suitability_assessment: string;
    target_market_size: string;
  };
  legal_regulatory: {
    complexity: "Low" | "Medium" | "High" | "Very High";
    required_licenses: string[];
    estimated_time_to_comply: string;
    legal_risks: string[];
  };
  economic_environment: {
    economic_trend: "Growing" | "Stable" | "Declining";
    purchasing_power: string;
    economic_assessment: "Favorable" | "Neutral" | "Unfavorable";
  };
  infrastructure: { score: number; assessment: string; gaps: string[] };
  location_risks: { risk: string; severity: string; mitigation: string }[];
  location_feasibility_score: number;
  location_advantages: string[];
  location_challenges: string[];
  research_sources: string[];
  recommendations: string[];
}

/** One row of the risk register — impact & probability drive scoring in code. */
export interface RiskRow {
  category: string;
  description: string;
  impact: number; // 0-100
  probability: number; // 0-100
  mitigation: string;
  contingency: string;
  priority?: number; // computed in code = impact * probability / 100
}

export interface RiskAnalysis {
  risks: RiskRow[];
  dealbreaker_risks: string[];
}

// --- Computed (deterministic) results ---

export interface FinancialCalculations {
  monthly_revenue: number;
  monthly_cost: number;
  monthly_profit: number;
  profit_margin_percent: number;
  annual_revenue: number;
  annual_profit: number;
  break_even_months: number | null; // null = never breaks even (non-positive profit)
  revenue_to_cost_ratio: number;
  startup_capital_needed: number;
  working_capital_needed: number;
  cash_flow_status: "Positive" | "Negative" | "Break-even";
  financial_feasibility_score: number;
}

export interface RiskScoring {
  rankedRisks: RiskRow[]; // sorted by priority desc
  overallRiskScore: number; // 0-100, higher = riskier (avg of top 5 priorities)
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  riskFeasibilityScore: number; // 100 - overallRiskScore, feeds the weighted score
}

export interface CategoryScores {
  market: number;
  financial: number;
  technical: number;
  competitive: number;
  location: number;
  risk: number; // already inverted (higher = safer)
}

export interface OverallAssessment {
  overall_score: number;
  rating: string;
  recommendation: string;
  emoji: string;
}

/** Everything a stage can produce, keyed by name (no merge-by-index). */
export interface StageResults {
  market?: MarketAnalysis;
  financial?: FinancialJudgment;
  technical?: TechnicalAnalysis;
  competitive?: CompetitiveAnalysis;
  location?: LocationAnalysis;
  risk?: RiskAnalysis;
}

export interface FeasibilityResult {
  input: BusinessInput;
  stages: StageResults;
  stageStatus: Record<StageName, StageStatus>;
  financials: FinancialCalculations;
  riskScoring: RiskScoring;
  categoryScores: CategoryScores;
  overall: OverallAssessment;
  criticalIssues: string[];
  strengths: string[];
  conditions: string[];
  nextSteps: string[];
  sources: Source[];
  usage: { model: string; mock: boolean; tokensIn: number; tokensOut: number; costCents: number };
}
