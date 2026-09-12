// The Financial Feasibility Study — the 15-section deliverable.
//
// Assembly only lives here. The three inputs come from elsewhere and each has a
// single owner:
//   model       ← the LLM (financialModel.ts)  — drivers and assumptions
//   projections ← code    (projections.ts)     — every number a reader acts on
//   narrative   ← the LLM (below)              — prose, written against the
//                                                already-computed projections
//
// The narrative call is given the finished projections precisely so it can cite
// real figures instead of producing its own; the prompt forbids recomputation.

import { z } from "zod";
import type { LlmProvider } from "./provider";
import { languageBlock } from "./specialists";
import type { FinancialModel } from "./financialModel";
import { buildProjections, type Projections } from "./projections";
import type { BusinessInput, RiskScoring, StageResults } from "./types";

export const StudyNarrativeSchema = z
  .object({
    /** §1 */
    executive_summary: z.string(),
    investment_ask: z.string(),
    verdict: z.enum(["Viable", "Viable with conditions", "Not viable"]),
    /** §2 */
    project_overview: z.string(),
    /** §3 — the demand and pricing evidence the revenue assumptions rest on. */
    market_basis: z.string(),
    /** §4-§7 */
    capex_commentary: z.string(),
    opex_commentary: z.string(),
    revenue_commentary: z.string(),
    assumptions_commentary: z.string(),
    /** §8-§10 */
    pl_commentary: z.string(),
    cashflow_commentary: z.string(),
    breakeven_commentary: z.string(),
    /** §11-§12 */
    funding_commentary: z.string(),
    returns_commentary: z.string(),
    /** §13 */
    risk_commentary: z.string(),
    financial_risks: z.array(
      z
        .object({
          category: z.enum(["Market", "Operational", "Regulatory", "Currency", "Financial"]),
          risk: z.string(),
          mitigation: z.string(),
        })
        .strict()
    ),
    /** §14-§15 */
    sensitivity_commentary: z.string(),
    conclusion: z.string(),
    conditions: z.array(z.string()),
  })
  .strict();

export type StudyNarrative = z.infer<typeof StudyNarrativeSchema>;

export interface FinancialStudy {
  model: FinancialModel;
  projections: Projections;
  narrative: StudyNarrative;
  /** Set once a user hand-edits the model after generation — see /api/analysis/model. */
  modelEditedAt?: number;
  modelEditedBy?: string; // email
  /** Set when the narrative was (re)generated — lets the UI detect a stale narrative after an edit. */
  narrativeGeneratedAt?: number;
}

const STUDY_PROMPT = `You are a financial feasibility consultant writing the narrative of an investor-grade Financial Feasibility Study.

The full financial model and its COMPUTED projections are given to you: the P&L, the cash flow, the break-even, the funding requirement, the return metrics and the scenario table are already calculated. Your job is the prose that explains them.

ABSOLUTE RULE — never compute, restate differently, or contradict a number. Cite the figures you are given, exactly as given. If a figure you want does not appear in the data, do not invent it; write around it.

Write each section as tight, professional prose an investment committee would read:
- executive_summary: 2-3 short paragraphs — what the project is, what it needs, what it returns, and the conclusion.
- investment_ask: one sentence stating the total capital required and what it buys.
- verdict: "Viable", "Viable with conditions", or "Not viable" — driven by the return metrics, the break-even timing and the funding gap. This must agree with your conclusion.
- project_overview: the concept, positioning, target market and location, written so the numbers that follow make sense.
- market_basis: the demand indicators, customer segments, competitive landscape and pricing benchmarks that justify the revenue assumptions.
- capex_commentary / opex_commentary / revenue_commentary: explain the shape of each — what dominates, what is uncertain, what is sourced vs assumed.
- assumptions_commentary: which assumptions the result is most exposed to, and which a reader should challenge first. If the RECONCILIATION block shows the modelled economics differ materially from the figures the applicant supplied, say so plainly here — state both numbers and why your model differs, because the reader is also looking at a scorecard built from their figures.
- pl_commentary / cashflow_commentary / breakeven_commentary: read the trajectory — when margin turns, where the cash trough is, what break-even demands in volume terms.
- funding_commentary: the requirement, the proposed structure, and whether the plan is adequately funded (say so plainly if the minimum cash balance is negative).
- returns_commentary: interpret ROI, payback, IRR and NPV for a decision-maker. Note that these exclude any terminal or exit value.
- risk_commentary + financial_risks: the risks that actually move these numbers. Cover market, operational, regulatory and — where the project spans currencies or imports priced in another currency — currency risk explicitly, each with a concrete mitigation.
- sensitivity_commentary: what the best/worst cases and the one-way sensitivities reveal about which variable the project is most fragile to.
- conclusion: the final recommendation, tied back to the executive summary.
- conditions: if the verdict carries conditions, the specific things that must be true or fixed for a "go". Empty array if unconditional.

Return JSON matching the provided response schema.`;

export async function generateStudy(
  llm: LlmProvider,
  ctx: {
    input: BusinessInput;
    model: FinancialModel;
    stages: StageResults;
    riskScoring: RiskScoring;
  }
): Promise<{ study: FinancialStudy; tokensIn: number; tokensOut: number }> {
  const projections = buildProjections(ctx.model, {
    monthlyCost: Number(ctx.input.monthly_cost) || 0,
    monthlyRevenue: Number(ctx.input.monthly_revenue) || 0,
  });

  const user =
    `BUSINESS: ${JSON.stringify(ctx.input)}\n\n` +
    `FINANCIAL MODEL (drivers and assumptions): ${JSON.stringify(ctx.model)}\n\n` +
    `COMPUTED PROJECTIONS — use these figures verbatim:\n${JSON.stringify(
      summarizeForPrompt(projections)
    )}\n\n` +
    `MARKET FINDINGS: ${JSON.stringify(ctx.stages.market ?? {})}\n` +
    `COMPETITIVE FINDINGS: ${JSON.stringify(ctx.stages.competitive ?? {})}\n` +
    `LOCATION & LEGAL FINDINGS: ${JSON.stringify(ctx.stages.location ?? {})}\n` +
    `RISK REGISTER: ${JSON.stringify(ctx.riskScoring.rankedRisks.slice(0, 8))}` +
    languageBlock(ctx.input);

  const { data, tokensIn, tokensOut } = await llm.structured<StudyNarrative>({
    system: STUDY_PROMPT,
    user,
    schema: StudyNarrativeSchema,
    schemaName: "financial_study",
    mockValue: mockNarrative(ctx.input, projections),
  });

  return {
    study: { model: ctx.model, projections, narrative: data, narrativeGeneratedAt: Date.now() },
    tokensIn,
    tokensOut,
  };
}

/**
 * Monthly rows past year one add little for the narrative and a lot of tokens,
 * so the prompt gets year-one monthly detail plus the annual roll-up.
 */
function summarizeForPrompt(p: Projections) {
  const round = (n: number) => Math.round(n);
  return {
    currency: p.currency,
    projectionYears: p.projectionYears,
    reconciliation: p.reconciliation,
    year1Monthly: p.monthly.slice(0, 12).map((m) => ({
      label: m.label,
      revenue: round(m.revenue),
      ebitda: round(m.ebitda),
      cashBalance: round(m.cashBalance),
    })),
    annual: p.annual.map((y) => ({
      year: y.year,
      revenue: round(y.revenue),
      grossMarginPercent: y.grossMarginPercent,
      opex: round(y.opex),
      ebitda: round(y.ebitda),
      ebitdaMarginPercent: y.ebitdaMarginPercent,
      netProfit: round(y.netProfit),
    })),
    breakEven: p.breakEven,
    funding: p.funding,
    returns: { ...p.returns, cashFlows: p.returns.cashFlows.map(round) },
    scenarios: p.scenarios,
    sensitivity: p.sensitivity,
    capexTotal: round(p.capexTotal),
    capexByCategory: p.capexByCategory,
    opexByCategory: p.opexByCategory,
  };
}

function mockNarrative(input: BusinessInput, p: Projections): StudyNarrative {
  const cur = p.currency;
  const fmt = (n: number) => `${cur} ${Math.round(n).toLocaleString()}`;
  const verdict: StudyNarrative["verdict"] =
    p.returns.npv > 0 && p.returns.paybackMonths !== null
      ? "Viable with conditions"
      : "Not viable";

  return {
    executive_summary: `"${input.business_idea}" requires ${fmt(
      p.funding.total
    )} of total capital and reaches ${fmt(p.annual[0]?.revenue ?? 0)} of revenue in year one, growing to ${fmt(
      p.annual[p.annual.length - 1]?.revenue ?? 0
    )} by year ${p.projectionYears}. NPV is ${fmt(p.returns.npv)} at a ${
      p.returns.discountRatePercent
    }% discount rate. (mock study content)`,
    investment_ask: `${fmt(p.funding.total)} covering ${fmt(
      p.funding.totalCapex
    )} of capital expenditure and the working capital needed to reach break-even. (mock)`,
    verdict,
    project_overview: `${input.business_idea} serving ${input.target_customer} in ${input.location}. (mock)`,
    market_basis: `Revenue assumptions rest on the pricing benchmarks in the model and the demand indicators from the market analysis. (mock)`,
    capex_commentary: `Capital expenditure totals ${fmt(
      p.capexTotal
    )}, dominated by ${p.capexByCategory[0]?.category ?? "fit-out"}. (mock)`,
    opex_commentary: `Operating cost runs at ${fmt(p.opexMonthlyTotal)} per month at maturity. (mock)`,
    revenue_commentary: `Revenue builds through the modelled ramp before settling at the mature run rate. (mock)`,
    assumptions_commentary: `The result is most exposed to the volume and pricing assumptions. (mock)`,
    pl_commentary: `Gross margin holds near ${p.annual[0]?.grossMarginPercent ?? 0}% with EBITDA turning as the ramp completes. (mock)`,
    cashflow_commentary: `The cash trough reaches ${fmt(
      p.funding.minimumCashBalance
    )} before operations self-fund. (mock)`,
    breakeven_commentary: `Break-even requires ${fmt(
      p.breakEven.monthlyRevenue
    )} of monthly revenue at a ${p.breakEven.contributionMarginPercent}% contribution margin. (mock)`,
    funding_commentary: `The ${fmt(p.funding.total)} requirement is split across equity, debt and owner capital as modelled. (mock)`,
    returns_commentary: `ROI is ${p.returns.roiPercent}% over the horizon with an IRR of ${
      p.returns.irrPercent ?? "n/a"
    }%, excluding terminal value. (mock)`,
    risk_commentary: `The plan is most exposed to demand shortfall and cost inflation. (mock)`,
    financial_risks: [
      {
        category: "Market",
        risk: "Volume ramps slower than modelled",
        mitigation: "Pre-open bookings and a staged cost base (mock).",
      },
      {
        category: "Currency",
        risk: "Imported equipment priced in a foreign currency",
        mitigation: "Fix supplier pricing at order (mock).",
      },
      {
        category: "Regulatory",
        risk: "Licensing takes longer than assumed",
        mitigation: "Start permitting before the lease commits (mock).",
      },
    ],
    sensitivity_commentary: `The worst case pushes NPV to ${fmt(
      p.scenarios.find((s) => s.name === "Worst case")?.npv ?? 0
    )}; price is the most sensitive variable. (mock)`,
    conclusion: `On the base case the project is ${verdict.toLowerCase()}. (mock)`,
    conditions: [
      "Confirm CapEx against at least two supplier quotes (mock).",
      "Validate the pricing benchmark with pre-launch demand (mock).",
    ],
  };
}
