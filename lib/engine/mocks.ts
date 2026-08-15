// Deterministic mock outputs for each specialist, shaped to satisfy the zod
// schemas exactly. These let the ENTIRE pipeline (extract → 6 specialists →
// deterministic scoring → report) run with no API keys and no cost, so the
// orchestration + math can be tested in isolation. A couple of scores are
// nudged by the input so mock runs don't all look identical.

import type {
  BusinessInput,
  CompetitiveAnalysis,
  FinancialJudgment,
  LocationAnalysis,
  MarketAnalysis,
  RiskAnalysis,
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
    legal_regulatory: {
      complexity: "Medium",
      required_licenses: ["Business registration"],
      estimated_time_to_comply: "4-8 weeks",
      legal_risks: ["Standard compliance overhead (mock)."],
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
