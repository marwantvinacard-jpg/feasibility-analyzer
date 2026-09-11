// Deterministic mock outputs for each specialist, shaped to satisfy the zod
// schemas exactly. These let the ENTIRE pipeline (extract → 6 specialists →
// deterministic scoring → report) run with no API keys and no cost, so the
// orchestration + math can be tested in isolation. A couple of scores are
// nudged by the input so mock runs don't all look identical.

import type { FinancialModel } from "./financialModel";
import type {
  BusinessInput,
  CompetitiveAnalysis,
  FinancialJudgment,
  LegalAnalysis,
  LocationAnalysis,
  MarketAnalysis,
  OperationalAnalysis,
  RiskAnalysis,
  StakeholderAnalysis,
  TechnicalAnalysis,
} from "./types";

export function mockMarket(input: BusinessInput): MarketAnalysis {
  return {
    market_size: {
      tam: `~$5B TAM (mock) for ${input.business_idea}`,
      sam: "~$500M SAM (mock)",
      som: "~$25M SOM (mock)",
    },
    customer_validation: {
      clarity_score: 8,
      problem_impact_score: 7,
      willingness_to_pay_score: 7,
      total_score: 22,
      reasoning: `Target customer "${input.target_customer}" is reasonably specific and the problem is real (mock).`,
    },
    market_timing: { trend: "Growing", timing_assessment: "Favorable entry window (mock)." },
    market_access: {
      difficulty: "Medium",
      channels: ["Direct sales", "Online / SEO", "Partnerships"],
      reasoning: "Reachable via digital channels (mock).",
    },
    market_feasibility_score: 74,
    red_flags: ["Market size is an estimate and needs validation (mock)."],
    opportunities: ["Underserved segment in the stated location (mock)."],
    research_sources: ["https://example.com/market"],
  };
}

export function mockFinancialJudgment(_input: BusinessInput): FinancialJudgment {
  return {
    revenue_certainty: "Moderate",
    revenue_certainty_reasoning: "Revenue depends on unproven acquisition assumptions (mock).",
    concerns: ["Revenue projection is optimistic for year one (mock)."],
    strengths: ["Positive contribution margin at stated pricing (mock)."],
    recommendations: ["Validate pricing with 10 design-partner customers (mock)."],
  };
}

/**
 * Mock model reconciled to the user's own monthly cost/revenue, so a demo study
 * doesn't contradict the demo feasibility report sitting next to it.
 */
export function mockFinancialModel(input: BusinessInput): FinancialModel {
  const cost = Number(input.monthly_cost) || 10000;
  const revenue = Number(input.monthly_revenue) || 15000;
  const capex = cost * 4;
  const price = 100;

  // The stated monthly cost is TOTAL cost, so it has to be split between direct
  // cost and OpEx — adding COGS on top of it would double-count and make the
  // study contradict the feasibility scorecard sitting next to it.
  const COGS_SHARE = 0.4;
  const opexPool = cost * (1 - COGS_SHARE);

  const capexLine = (category: string, item: string, share: number, depreciable: boolean) => ({
    category,
    item,
    amount: Math.round(capex * share),
    basis: "Benchmark share of total setup cost (mock).",
    depreciable,
  });
  const opexLine = (category: string, item: string, share: number, variable: boolean) => ({
    category,
    item,
    monthly_amount: Math.round(opexPool * share),
    basis: "Share of the stated monthly operating cost (mock).",
    variable_with_revenue: variable,
  });

  return {
    currency: input.currency ?? "USD",
    capex: [
      capexLine("Fit-out", "Premises fit-out and build", 0.4, true),
      capexLine("Equipment", "Core operating equipment", 0.3, true),
      capexLine("Licensing & permits", "Registration and trade licences", 0.05, false),
      capexLine("Deposits", "Lease and utility deposits", 0.1, false),
      capexLine("Pre-opening", "Hiring, training and launch marketing", 0.1, false),
      capexLine("Contingency", "Contingency reserve", 0.05, false),
    ],
    opex: [
      opexLine("Staffing", "Salaries and benefits", 0.45, false),
      opexLine("Rent", "Premises rent", 0.2, false),
      opexLine("Utilities", "Power, water, connectivity", 0.06, false),
      opexLine("Marketing", "Customer acquisition", 0.12, true),
      opexLine("Maintenance", "Upkeep and repairs", 0.05, false),
      opexLine("Insurance", "Liability and asset cover", 0.04, false),
      opexLine("Admin", "Accounting, software, sundries", 0.08, false),
    ],
    revenue_streams: [
      {
        name: input.product_service || "Primary offering",
        unit_label: "orders/month",
        units_per_month: Math.round(revenue / price),
        price_per_unit: price,
        utilization_percent: 100,
        cogs_percent: revenue > 0 ? Math.round(((cost * COGS_SHARE) / revenue) * 1000) / 10 : 30,
        ramp_months: 6,
        basis: "Derived from the stated expected monthly revenue (mock).",
      },
    ],
    pricing_benchmarks: [
      { reference: "Incumbent A", price_point: "$95-$110", note: "Comparable offering (mock)." },
    ],
    assumptions: {
      projection_years: 5,
      revenue_growth_percent_by_year: [12, 10, 8, 6],
      cost_inflation_percent: 4,
      seasonality_index: Array(12).fill(1),
      discount_rate_percent: 15,
      tax_rate_percent: 20,
      depreciation_years: 7,
      working_capital_months: 3,
    },
    assumption_notes: [
      {
        area: "Revenue",
        assumption: "Mature volume is reached six months after opening",
        value: "6-month linear ramp",
        basis: "Typical ramp for a new entrant (mock).",
        confidence: "Medium",
      },
      {
        area: "Costs",
        assumption: "Operating cost matches the figure supplied in the brief",
        value: `${Math.round(cost)} per month`,
        basis: "Stated by the applicant (mock).",
        confidence: "Medium",
      },
      {
        area: "Macro",
        assumption: "Cost inflation applies to fixed operating costs from year 2",
        value: "4% per year",
        basis: "Recent headline inflation (mock).",
        confidence: "Medium",
      },
    ],
    funding: {
      equity_percent: 40,
      debt_percent: 30,
      owner_capital_percent: 30,
      debt_interest_percent: 8,
      debt_term_years: 5,
      structure_rationale: "Balanced mix keeps debt service affordable pre-break-even (mock).",
    },
    exclusions: [
      "No terminal or exit value is included in the return metrics (mock).",
      "Owner drawings and financing fees are excluded (mock).",
    ],
  };
}

export function mockTechnical(input: BusinessInput): TechnicalAnalysis {
  return {
    execution_complexity: {
      score: 4,
      level: "Medium",
      required_skills: ["Product", "Engineering"],
      required_resources: ["Cloud hosting", "Small dev team"],
      challenges: ["Integration effort (mock)."],
    },
    unique_advantage: {
      score: 6,
      strength: "Moderate",
      defensibility: "Medium",
      analysis: `"${input.unique_advantage}" is a real edge but partially copyable (mock).`,
      can_competitors_copy: "Partially",
    },
    scalability: {
      score: 8,
      level: "High",
      scaling_factors: ["Software margins"],
      bottlenecks: ["Support load (mock)."],
    },
    time_to_market: { estimated_months: 5, category: "Moderate", breakdown: "MVP in ~5 months (mock)." },
    required_capabilities: {
      technical_skills: ["Full-stack development"],
      certifications: [],
      equipment: ["Laptops", "Cloud accounts"],
      partnerships: ["Payment processor"],
      minimum_team_size: 3,
    },
    technical_risks: [
      { risk: "Key-person dependency", severity: "Medium", mitigation: "Document + cross-train (mock)." },
    ],
    technical_feasibility_score: 71,
    overall_assessment: "Executable by a small competent team (mock).",
  };
}

export function mockCompetitive(input: BusinessInput): CompetitiveAnalysis {
  return {
    competitive_research: [
      {
        competitor_name: "Incumbent A",
        description: "Established player (mock).",
        strengths: ["Brand", "Scale"],
        weaknesses: ["Slow", "Expensive"],
        pricing: "$$$",
        website: "https://example.com/incumbent-a",
      },
    ],
    competitive_intensity: { score: 6, level: "Moderate", analysis: "Several players, room to differentiate (mock)." },
    differentiation: {
      score: 6,
      level: "Moderate",
      differentiation_factors: [input.unique_advantage || "Speed"],
      analysis: "Differentiated on execution (mock).",
    },
    entry_barriers: { score: 5, level: "Low", barriers: ["Brand trust"] },
    positioning_recommendation: {
      price_position: "Mid-range",
      quality_position: "Standard",
      target_segment: input.target_customer || "SMBs",
      strategic_approach: "Flanking — win an underserved niche first (mock).",
      rationale: "Avoid head-on with incumbents (mock).",
    },
    competitive_threats: [
      { threat: "Incumbent price cut", severity: "Medium", mitigation: "Compete on service (mock)." },
    ],
    competitive_advantages: ["Faster onboarding (mock)."],
    competitive_feasibility_score: 68,
    research_sources: ["https://example.com/competitors"],
    overall_assessment: "Defensible niche entry is viable (mock).",
  };
}

export function mockLocation(input: BusinessInput): LocationAnalysis {
  const [city = input.location, country = ""] = (input.location || "").split(",").map((s) => s.trim());
  return {
    location_analysis: {
      city,
      country,
      suitability_score: 8,
      suitability_assessment: "Good fit for the target market (mock).",
      target_market_size: "Sizeable local demand (mock).",
    },
    economic_environment: {
      economic_trend: "Growing",
      purchasing_power: "Adequate for the price point (mock).",
      economic_assessment: "Favorable",
    },
    infrastructure: { score: 8, assessment: "Strong digital + logistics infrastructure (mock).", gaps: [] },
    location_risks: [
      { risk: "Regulatory change", severity: "Low", mitigation: "Monitor policy (mock)." },
    ],
    location_feasibility_score: 76,
    location_advantages: ["Good talent pool (mock)."],
    location_challenges: ["Moderate compliance cost (mock)."],
    research_sources: ["https://example.com/location"],
    recommendations: ["Register early to avoid delays (mock)."],
  };
}

export function mockRisk(_input: BusinessInput): RiskAnalysis {
  return {
    risks: [
      {
        category: "Market",
        description: "Customer adoption slower than projected",
        impact: 70,
        probability: 55,
        mitigation: "Design-partner program",
        contingency: "Extend runway, cut burn",
      },
      {
        category: "Financial",
        description: "Cash flow gap before break-even",
        impact: 80,
        probability: 45,
        mitigation: "Raise 12-month runway",
        contingency: "Bridge financing",
      },
      {
        category: "Competitive",
        description: "Incumbent responds aggressively",
        impact: 60,
        probability: 40,
        mitigation: "Focus on niche",
        contingency: "Reposition",
      },
      {
        category: "Operational",
        description: "Key-person dependency",
        impact: 55,
        probability: 50,
        mitigation: "Cross-train, document",
        contingency: "Contractor backfill",
      },
      {
        category: "External",
        description: "Regulatory change raises compliance cost",
        impact: 50,
        probability: 30,
        mitigation: "Monitor policy",
        contingency: "Budget reserve",
      },
    ],
    dealbreaker_risks: [],
  };
}

export function mockOperational(input: BusinessInput): OperationalAnalysis {
  return {
    staffing_plan: {
      assessment: "Headcount implied by the stated volume looks broadly adequate (mock).",
      headcount_adequacy: "Adequate",
      key_roles_at_risk: ["Shift supervisor"],
    },
    supply_chain: {
      dependency_level: "Medium",
      key_suppliers_needed: ["Primary supplier (mock)"],
      single_points_of_failure: [],
    },
    process_complexity: { score: 4, assessment: "Moderate — a handful of handoffs, no exotic steps (mock)." },
    capacity_vs_demand: { assessment: "Planned capacity covers stated demand with modest headroom (mock).", bottlenecks: [] },
    operational_risks: [
      { risk: "Peak-demand staffing gap", severity: "Medium", mitigation: "Cross-train + on-call roster (mock)." },
    ],
    operational_feasibility_score: 72,
    operational_strengths: ["Simple core process (mock)."],
    operational_challenges: ["Peak-hour staffing (mock)."],
    research_sources: [],
    recommendations: ["Build a cross-training plan before launch (mock)."],
  };
}

export function mockLegal(input: BusinessInput): LegalAnalysis {
  return {
    required_licenses_permits: [
      { name: "Business registration", issuing_authority: "Local commerce authority", estimated_time: "2-4 weeks", estimated_cost: "$200-500 (mock)" },
    ],
    regulatory_compliance: [
      { area: "Health & safety", requirement: "Standard workplace compliance", complexity: "Low" },
    ],
    contracts_and_ip: {
      assessment: "Standard contract set needed before opening (mock).",
      ip_protection_needed: ["Trademark the brand name"],
      key_contracts_needed: ["Lease", "Supplier agreement", "Employment contracts"],
    },
    liability_exposure: { level: "Medium", assessment: "Typical exposure for this business type (mock).", insurance_recommended: ["General liability"] },
    employment_law_considerations: ["Standard minimum-wage and classification rules apply (mock)."],
    data_privacy_considerations: ["Basic customer data handling — no special regime triggered (mock)."],
    legal_risks: [
      { risk: "Delayed permit approval", severity: "Medium", mitigation: "Apply early, budget a buffer (mock)." },
    ],
    legal_feasibility_score: 74,
    research_sources: [],
    recommendations: ["Start the licensing process before committing to a lease date (mock)."],
  };
}

export function mockStakeholders(input: BusinessInput): StakeholderAnalysis {
  return {
    stakeholders: [
      { group: "Customers", interest: "Reliable, good-value product/service", influence: "High", impact: "High", engagement_strategy: "Early feedback loop, transparent pricing (mock)." },
      { group: "Employees", interest: "Stable work, fair pay", influence: "Medium", impact: "High", engagement_strategy: "Clear roles, training, growth path (mock)." },
      { group: "Investors/Funders", interest: "Return on capital, risk visibility", influence: "High", impact: "Medium", engagement_strategy: "Regular reporting against this study's assumptions (mock)." },
      { group: "Regulators", interest: "Compliance", influence: "Medium", impact: "Low", engagement_strategy: "Proactive licensing, documented compliance (mock)." },
      { group: "Suppliers/Partners", interest: "Reliable, on-time payment", influence: "Medium", impact: "Medium", engagement_strategy: "Clear terms, backup suppliers (mock)." },
    ],
    key_concerns: ["Funding runway before break-even", "Staffing reliability at peak demand"],
    summary: "The customer and employee relationships matter most in the first 6 months — get onboarding and staffing right before scaling marketing spend (mock).",
  };
}
