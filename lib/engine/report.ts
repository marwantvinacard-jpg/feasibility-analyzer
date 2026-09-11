// Report content generation. Unlike the n8n "Final Report Generator" — which
// made the LLM emit a whole ~6k-token HTML document (and baked in a hard-coded
// $5,000 monthly cost + `monthly_profit + 5000` fake revenue) — we ask the LLM
// only for structured narrative CONTENT. The app renders that content into the
// web view and the PDF from one template, so numbers are always the real
// computed ones and branding is consistent. Cuts ~40% of the token cost too.

import { z } from "zod";
import type { LlmProvider } from "./provider";
import type {
  BusinessInput,
  CategoryScores,
  FinancialCalculations,
  OverallAssessment,
  RiskScoring,
  StageResults,
} from "./types";

export const ReportSchema = z
  .object({
    executive_summary: z.string(),
    key_findings: z.array(z.string()),
    critical_success_factors: z.array(z.string()),
    major_risks: z.array(z.string()),
    dimension_narratives: z
      .object({
        market: z.string(),
        financial: z.string(),
        technical: z.string(),
        competitive: z.string(),
        location: z.string(),
        operational: z.string(),
        legal: z.string(),
        risk: z.string(),
      })
      .strict(),
    conclusion: z.string(),
  })
  .strict();

export type ReportContent = z.infer<typeof ReportSchema>;

const REPORT_PROMPT = `You are an executive report writer producing a professional business feasibility report.

You are given the final scores, the verdict, the computed financials, and each specialist's findings. Write concise, specific narrative CONTENT (no HTML, no markdown headings) that a template will render.

- executive_summary: 2-3 short paragraphs on overall feasibility and the recommendation.
- key_findings: 3-5 crisp bullet strings drawn from the analyses.
- critical_success_factors: 3-5 things that must go right.
- major_risks: the top 3 risks in plain language.
- dimension_narratives: one short paragraph per dimension (market, financial, technical, competitive, location, operational, legal, risk) summarizing that specialist's findings and score.
- conclusion: a final 1-2 paragraph recommendation with a confidence note.

Use ONLY the provided data. Never invent numbers. Return JSON matching the schema.`;

export async function generateReport(
  llm: LlmProvider,
  ctx: {
    input: BusinessInput;
    stages: StageResults;
    financials: FinancialCalculations;
    riskScoring: RiskScoring;
    scores: CategoryScores;
    overall: OverallAssessment;
  }
): Promise<{ content: ReportContent; tokensIn: number; tokensOut: number }> {
  const user =
    `VERDICT: ${ctx.overall.overall_score}/100 — ${ctx.overall.rating} (${ctx.overall.recommendation})\n` +
    `CATEGORY SCORES: ${JSON.stringify(ctx.scores)}\n` +
    `FINANCIALS: ${JSON.stringify(ctx.financials)}\n` +
    `RISK: level ${ctx.riskScoring.riskLevel}, overall ${ctx.riskScoring.overallRiskScore}/100, top risks ${JSON.stringify(
      ctx.riskScoring.rankedRisks.slice(0, 3)
    )}\n` +
    `INPUT: ${JSON.stringify(ctx.input)}\n` +
    `STAGE FINDINGS: ${JSON.stringify(ctx.stages)}`;

  const { data, tokensIn, tokensOut } = await llm.structured<ReportContent>({
    system: REPORT_PROMPT,
    user,
    schema: ReportSchema,
    schemaName: "report",
    mockValue: mockReport(ctx),
  });
  return { content: data, tokensIn, tokensOut };
}

function mockReport(ctx: {
  input: BusinessInput;
  overall: OverallAssessment;
  scores: CategoryScores;
  riskScoring: RiskScoring;
  financials: FinancialCalculations;
}): ReportContent {
  const { overall, scores, input, financials, riskScoring } = ctx;
  return {
    executive_summary: `"${input.business_idea}" scores ${overall.overall_score}/100 — ${overall.rating}. Recommendation: ${overall.recommendation}. (mock report content)`,
    key_findings: [
      `Overall feasibility ${overall.overall_score}/100 (${overall.rating}).`,
      `Monthly profit ${financials.monthly_profit} at ${financials.profit_margin_percent}% margin.`,
      `Strongest dimension scored ${Math.max(...Object.values(scores))}/100.`,
    ],
    critical_success_factors: [
      "Validate demand with early customers.",
      "Hit the projected revenue ramp.",
      "Control burn until break-even.",
    ],
    major_risks: riskScoring.rankedRisks.slice(0, 3).map((r) => `${r.category}: ${r.description}`),
    dimension_narratives: {
      market: `Market scored ${scores.market}/100 (mock).`,
      financial: `Financial scored ${scores.financial}/100; break-even in ${
        financials.break_even_months ?? "N/A"
      } months (mock).`,
      technical: `Technical scored ${scores.technical}/100 (mock).`,
      competitive: `Competitive scored ${scores.competitive}/100 (mock).`,
      location: `Location scored ${scores.location}/100 (mock).`,
      operational: `Operational scored ${scores.operational}/100 (mock).`,
      legal: `Legal scored ${scores.legal}/100 (mock).`,
      risk: `Risk level ${riskScoring.riskLevel}; risk-adjusted score ${scores.risk}/100 (mock).`,
    },
    conclusion: `Based on a ${overall.overall_score}/100 assessment, the recommendation is ${overall.recommendation}. (mock)`,
  };
}
