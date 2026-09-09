// The financial MODEL — the inputs a financial feasibility study is built from.
//
// Division of labour, same as financial.ts: the LLM supplies *estimates and
// assumptions* (what a CapEx line costs, how many covers per day, what the
// staffing ratio is) grounded in the business and its research; every
// projection, ratio and return metric derived from them is computed in code
// (projections.ts). The model never contains a result — only drivers.
//
// Every line carries a `basis` string so section 7 (Assumptions & Basis of
// Estimates) can list what each number rests on and a reader can challenge it.

import { z } from "zod";

const pct = z.number().min(0).max(100);
const money = z.number().min(0);

export const CapexItemSchema = z
  .object({
    /** Fit-out, Equipment, Licensing & permits, Deposits, Pre-opening, Technology, Contingency. */
    category: z.string(),
    item: z.string(),
    amount: money,
    /** Where the figure came from: a quote, a benchmark, or a stated assumption. */
    basis: z.string(),
    /** True for physical assets that depreciate; false for deposits/pre-opening spend. */
    depreciable: z.boolean(),
  })
  .strict();

export const OpexItemSchema = z
  .object({
    /** Staffing, Rent, Utilities, Marketing, Maintenance, Insurance, Admin, Other. */
    category: z.string(),
    item: z.string(),
    /** Monthly cost once the business is at maturity, in the model currency. */
    monthly_amount: money,
    basis: z.string(),
    /** True if the cost scales with revenue (commissions, delivery); false if fixed (rent). */
    variable_with_revenue: z.boolean(),
  })
  .strict();

export const RevenueStreamSchema = z
  .object({
    name: z.string(),
    /** The volume unit, stated explicitly: "covers/day", "subscriptions", "room-nights". */
    unit_label: z.string(),
    /** Volume per month at maturity, expressed in `unit_label` units. */
    units_per_month: z.number().min(0),
    /** Average realised price per unit. */
    price_per_unit: z.number().min(0),
    /** Utilisation/occupancy applied to the volume above, 0-100. Use 100 if not applicable. */
    utilization_percent: pct,
    /** Direct cost of delivering one unit, as a % of its price. */
    cogs_percent: pct,
    /** Months from opening to reach the mature volume above. 0 = immediate. */
    ramp_months: z.number().min(0).max(60),
    basis: z.string(),
  })
  .strict();

export const PricingBenchmarkSchema = z
  .object({
    /** Competitor or published source the benchmark came from. */
    reference: z.string(),
    price_point: z.string(),
    note: z.string(),
  })
  .strict();

export const AssumptionNoteSchema = z
  .object({
    /** Revenue, Costs, Staffing, Growth, Macro, Funding, Timing. */
    area: z.string(),
    assumption: z.string(),
    /** The value as stated, e.g. "6% per year", "1 server per 20 covers". */
    value: z.string(),
    basis: z.string(),
    confidence: z.enum(["High", "Medium", "Low"]),
  })
  .strict();

export const ModelAssumptionsSchema = z
  .object({
    /** Length of the projection, 3-5 years. */
    projection_years: z.number().min(3).max(5),
    /**
     * Real revenue growth applied to years 2..N, one entry per year after the
     * first. Growth on top of the ramp already modelled in each stream.
     */
    revenue_growth_percent_by_year: z.array(z.number().min(-50).max(200)),
    /** Annual cost inflation applied to OpEx from year 2 onward. */
    cost_inflation_percent: z.number().min(0).max(100),
    /**
     * 12 monthly multipliers (Jan..Dec) averaging ~1.0, capturing seasonality.
     * Use twelve 1.0 values for a business with no meaningful seasonality.
     */
    seasonality_index: z.array(z.number().min(0).max(3)),
    /** Discount rate for NPV — the investor's required return. */
    discount_rate_percent: z.number().min(0).max(100),
    /** Corporate tax rate in the operating jurisdiction. */
    tax_rate_percent: pct,
    /** Straight-line depreciation life for depreciable CapEx. */
    depreciation_years: z.number().min(1).max(30),
    /** Months of OpEx held as a working-capital buffer in the funding ask. */
    working_capital_months: z.number().min(0).max(24),
  })
  .strict();

export const FundingPlanSchema = z
  .object({
    equity_percent: pct,
    debt_percent: pct,
    owner_capital_percent: pct,
    debt_interest_percent: z.number().min(0).max(100),
    debt_term_years: z.number().min(0).max(30),
    structure_rationale: z.string(),
  })
  .strict();

export const FinancialModelSchema = z
  .object({
    /** ISO currency the whole model is denominated in, e.g. "SAR", "TND", "USD". */
    currency: z.string(),
    capex: z.array(CapexItemSchema),
    opex: z.array(OpexItemSchema),
    revenue_streams: z.array(RevenueStreamSchema),
    pricing_benchmarks: z.array(PricingBenchmarkSchema),
    assumptions: ModelAssumptionsSchema,
    assumption_notes: z.array(AssumptionNoteSchema),
    funding: FundingPlanSchema,
    /** Anything the model deliberately excludes, so the reader knows the edges. */
    exclusions: z.array(z.string()),
  })
  .strict();

export type CapexItem = z.infer<typeof CapexItemSchema>;
export type OpexItem = z.infer<typeof OpexItemSchema>;
export type RevenueStream = z.infer<typeof RevenueStreamSchema>;
export type PricingBenchmark = z.infer<typeof PricingBenchmarkSchema>;
export type AssumptionNote = z.infer<typeof AssumptionNoteSchema>;
export type ModelAssumptions = z.infer<typeof ModelAssumptionsSchema>;
export type FundingPlan = z.infer<typeof FundingPlanSchema>;
export type FinancialModel = z.infer<typeof FinancialModelSchema>;

/** Mature monthly revenue for one stream, before ramp, seasonality and growth. */
export function matureMonthlyRevenue(s: RevenueStream): number {
  return s.units_per_month * s.price_per_unit * (s.utilization_percent / 100);
}
