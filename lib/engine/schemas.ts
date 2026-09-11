// Zod schemas for every structured LLM step. These serve two jobs:
//  1. Runtime validation of whatever the model returns (never trust prose).
//  2. Source for the JSON Schema we hand OpenAI via `response_format`
//     (structured outputs, strict) — so the model is *forced* to return
//     parseable JSON and the old regex-scraping-with-silent-50-fallback bug
//     (n8n "Master Calculator") can't happen.

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const score10 = z.number().min(0).max(10);
const score100 = z.number().min(0).max(100);
const pct = z.number().min(0).max(100);

// --- Extraction (the 10 fields) ---
// Numbers may be unknown at extraction time, so they are string-or-number and
// normalized later; text fields fall back to the sentinel "DATA_NEEDED".
export const ExtractionSchema = z
  .object({
    business_idea: z.string(),
    target_customer: z.string(),
    location: z.string(),
    problem_solved: z.string(),
    product_service: z.string(),
    revenue_model: z.string(),
    competitors: z.string(),
    monthly_cost: z.union([z.number(), z.string()]),
    monthly_revenue: z.union([z.number(), z.string()]),
    unique_advantage: z.string(),
  })
  .strict();

export const MarketSchema = z
  .object({
    market_size: z.object({ tam: z.string(), sam: z.string(), som: z.string() }).strict(),
    customer_validation: z
      .object({
        clarity_score: score10,
        problem_impact_score: score10,
        willingness_to_pay_score: score10,
        total_score: z.number().min(0).max(30),
        reasoning: z.string(),
      })
      .strict(),
    market_timing: z
      .object({
        trend: z.enum(["Growing", "Stable", "Declining"]),
        timing_assessment: z.string(),
      })
      .strict(),
    market_access: z
      .object({
        difficulty: z.enum(["Easy", "Medium", "Hard"]),
        channels: z.array(z.string()),
        reasoning: z.string(),
      })
      .strict(),
    market_feasibility_score: score100,
    red_flags: z.array(z.string()),
    opportunities: z.array(z.string()),
    research_sources: z.array(z.string()),
  })
  .strict();

export const FinancialJudgmentSchema = z
  .object({
    revenue_certainty: z.enum(["High", "Moderate", "Low"]),
    revenue_certainty_reasoning: z.string(),
    concerns: z.array(z.string()),
    strengths: z.array(z.string()),
    recommendations: z.array(z.string()),
  })
  .strict();

export const TechnicalSchema = z
  .object({
    execution_complexity: z
      .object({
        score: score10,
        level: z.enum(["Low", "Medium", "High"]),
        required_skills: z.array(z.string()),
        required_resources: z.array(z.string()),
        challenges: z.array(z.string()),
      })
      .strict(),
    unique_advantage: z
      .object({
        score: score10,
        strength: z.enum(["Strong", "Moderate", "Weak", "None"]),
        defensibility: z.enum(["High", "Medium", "Low"]),
        analysis: z.string(),
        can_competitors_copy: z.enum(["Yes", "No", "Partially"]),
      })
      .strict(),
    scalability: z
      .object({
        score: score10,
        level: z.string(),
        scaling_factors: z.array(z.string()),
        bottlenecks: z.array(z.string()),
      })
      .strict(),
    time_to_market: z
      .object({ estimated_months: z.number(), category: z.string(), breakdown: z.string() })
      .strict(),
    required_capabilities: z
      .object({
        technical_skills: z.array(z.string()),
        certifications: z.array(z.string()),
        equipment: z.array(z.string()),
        partnerships: z.array(z.string()),
        minimum_team_size: z.number(),
      })
      .strict(),
    technical_risks: z.array(
      z.object({ risk: z.string(), severity: z.string(), mitigation: z.string() }).strict()
    ),
    technical_feasibility_score: score100,
    overall_assessment: z.string(),
  })
  .strict();

export const CompetitiveSchema = z
  .object({
    competitive_research: z.array(
      z
        .object({
          competitor_name: z.string(),
          description: z.string(),
          strengths: z.array(z.string()),
          weaknesses: z.array(z.string()),
          pricing: z.string(),
          website: z.string(),
        })
        .strict()
    ),
    competitive_intensity: z.object({ score: score10, level: z.string(), analysis: z.string() }).strict(),
    differentiation: z
      .object({
        score: score10,
        level: z.string(),
        differentiation_factors: z.array(z.string()),
        analysis: z.string(),
      })
      .strict(),
    entry_barriers: z.object({ score: score10, level: z.string(), barriers: z.array(z.string()) }).strict(),
    positioning_recommendation: z
      .object({
        price_position: z.string(),
        quality_position: z.string(),
        target_segment: z.string(),
        strategic_approach: z.string(),
        rationale: z.string(),
      })
      .strict(),
    competitive_threats: z.array(
      z.object({ threat: z.string(), severity: z.string(), mitigation: z.string() }).strict()
    ),
    competitive_advantages: z.array(z.string()),
    competitive_feasibility_score: score100,
    research_sources: z.array(z.string()),
    overall_assessment: z.string(),
  })
  .strict();

export const LocationSchema = z
  .object({
    location_analysis: z
      .object({
        city: z.string(),
        country: z.string(),
        suitability_score: score10,
        suitability_assessment: z.string(),
        target_market_size: z.string(),
      })
      .strict(),
    economic_environment: z
      .object({
        economic_trend: z.enum(["Growing", "Stable", "Declining"]),
        purchasing_power: z.string(),
        economic_assessment: z.enum(["Favorable", "Neutral", "Unfavorable"]),
      })
      .strict(),
    infrastructure: z.object({ score: score10, assessment: z.string(), gaps: z.array(z.string()) }).strict(),
    location_risks: z.array(
      z.object({ risk: z.string(), severity: z.string(), mitigation: z.string() }).strict()
    ),
    location_feasibility_score: score100,
    location_advantages: z.array(z.string()),
    location_challenges: z.array(z.string()),
    research_sources: z.array(z.string()),
    recommendations: z.array(z.string()),
  })
  .strict();

export const OperationalSchema = z
  .object({
    staffing_plan: z
      .object({
        assessment: z.string(),
        headcount_adequacy: z.enum(["Adequate", "Tight", "Insufficient"]),
        key_roles_at_risk: z.array(z.string()),
      })
      .strict(),
    supply_chain: z
      .object({
        dependency_level: z.enum(["Low", "Medium", "High"]),
        key_suppliers_needed: z.array(z.string()),
        single_points_of_failure: z.array(z.string()),
      })
      .strict(),
    process_complexity: z.object({ score: score10, assessment: z.string() }).strict(),
    capacity_vs_demand: z.object({ assessment: z.string(), bottlenecks: z.array(z.string()) }).strict(),
    operational_risks: z.array(
      z.object({ risk: z.string(), severity: z.enum(["Low", "Medium", "High"]), mitigation: z.string() }).strict()
    ),
    operational_feasibility_score: score100,
    operational_strengths: z.array(z.string()),
    operational_challenges: z.array(z.string()),
    research_sources: z.array(z.string()),
    recommendations: z.array(z.string()),
  })
  .strict();

export const LegalSchema = z
  .object({
    required_licenses_permits: z.array(
      z
        .object({
          name: z.string(),
          issuing_authority: z.string(),
          estimated_time: z.string(),
          estimated_cost: z.string(),
        })
        .strict()
    ),
    regulatory_compliance: z.array(
      z
        .object({ area: z.string(), requirement: z.string(), complexity: z.enum(["Low", "Medium", "High", "Very High"]) })
        .strict()
    ),
    contracts_and_ip: z
      .object({
        assessment: z.string(),
        ip_protection_needed: z.array(z.string()),
        key_contracts_needed: z.array(z.string()),
      })
      .strict(),
    liability_exposure: z
      .object({ level: z.enum(["Low", "Medium", "High"]), assessment: z.string(), insurance_recommended: z.array(z.string()) })
      .strict(),
    employment_law_considerations: z.array(z.string()),
    data_privacy_considerations: z.array(z.string()),
    legal_risks: z.array(
      z.object({ risk: z.string(), severity: z.enum(["Low", "Medium", "High"]), mitigation: z.string() }).strict()
    ),
    legal_feasibility_score: score100,
    research_sources: z.array(z.string()),
    recommendations: z.array(z.string()),
  })
  .strict();

export const StakeholderSchema = z
  .object({
    stakeholders: z.array(
      z
        .object({
          group: z.string(),
          interest: z.string(),
          influence: z.enum(["Low", "Medium", "High"]),
          impact: z.enum(["Low", "Medium", "High"]),
          engagement_strategy: z.string(),
        })
        .strict()
    ),
    key_concerns: z.array(z.string()),
    summary: z.string(),
  })
  .strict();

export const RiskSchema = z
  .object({
    risks: z.array(
      z
        .object({
          category: z.string(),
          description: z.string(),
          impact: pct,
          probability: pct,
          mitigation: z.string(),
          contingency: z.string(),
        })
        .strict()
    ),
    dealbreaker_risks: z.array(z.string()),
  })
  .strict();

/**
 * Build the JSON Schema for structured outputs. Must be fully INLINED — no
 * top-level `$ref`/`definitions` and no `$schema` — because Gemini's OpenAI-compat
 * endpoint rejects those ("reference to undefined schema"). Passing a `name` to
 * zodToJsonSchema is what created the `$ref` wrapper, so we omit it and set the
 * response_format name separately.
 */
export function jsonSchemaFor(name: string, schema: z.ZodTypeAny) {
  const js = zodToJsonSchema(schema, { target: "openAi", $refStrategy: "none" }) as Record<string, unknown>;
  delete js.$schema;
  delete js.definitions;
  return { name, strict: true, schema: js };
}
