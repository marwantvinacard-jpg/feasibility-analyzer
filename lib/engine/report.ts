// Report content generation. Unlike the n8n "Final Report Generator" — which
// made the LLM emit a whole ~6k-token HTML document (and baked in a hard-coded
// $5,000 monthly cost + `monthly_profit + 5000` fake revenue) — we ask the LLM
// only for structured narrative CONTENT. The app renders that content into the
// web view and the PDF from one template, so numbers are always the real
// computed ones and branding is consistent. Cuts ~40% of the token cost too.

import { z } from "zod";
import type { LlmProvider } from "./provider";
import { languageBlock } from "./specialists";
import { retryIfRateLimited } from "./concurrency";
import { fence } from "./untrusted";
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
    /** Sections whose web research failed entirely — analysed from general knowledge. */
    stagesWithoutResearch?: string[];
    /** Scored sections whose AI call failed — their score is the neutral placeholder. */
    failedStages?: string[];
  }
): Promise<{ content: ReportContent; tokensIn: number; tokensOut: number }> {
  const noResearch = ctx.stagesWithoutResearch ?? [];
  const failed = ctx.failedStages ?? [];
  const user =
    `VERDICT: ${ctx.overall.overall_score}/100 — ${ctx.overall.rating} (${ctx.overall.recommendation})\n` +
    `CATEGORY SCORES: ${JSON.stringify(ctx.scores)}\n` +
    `FINANCIALS: ${JSON.stringify(ctx.financials)}\n` +
    (ctx.riskScoring.assessed === false
      ? `RISK: NOT ASSESSED — no risk register was produced; the risk score is a neutral placeholder, not a finding.\n`
      : `RISK: level ${ctx.riskScoring.riskLevel}, overall ${ctx.riskScoring.overallRiskScore}/100, top risks ${JSON.stringify(
          ctx.riskScoring.rankedRisks.slice(0, 3)
        )}\n`) +
    `INPUT:\n${fence("business data", JSON.stringify(ctx.input))}\n` +
    `STAGE FINDINGS: ${JSON.stringify(ctx.stages)}` +
    (noResearch.length > 0
      ? `\nNOTE: live web research was unavailable for these sections: ${noResearch.join(", ")}. ` +
        `Their findings rest on general knowledge, not current market data — say so where it matters, ` +
        `and do not present their figures as researched facts.`
      : "") +
    (failed.length > 0
      ? `\nNOTE: these sections could not be analysed this run: ${failed.join(", ")}. Their category score is a ` +
        `neutral placeholder (50), not a finding — do not describe them as assessed, and say they need a re-run.`
      : "") +
    languageBlock(ctx.input);

  const { data, tokensIn, tokensOut } = await retryIfRateLimited(() =>
    llm.structured<ReportContent>({
      system: REPORT_PROMPT,
      user,
      schema: ReportSchema,
      schemaName: "report",
      mockValue: mockReport(ctx),
    })
  );
  return { content: data, tokensIn, tokensOut };
}

const DIMENSION_NAMES: Record<keyof ReportContent["dimension_narratives"], string> = {
  market: "Market",
  financial: "Financial",
  technical: "Technical",
  competitive: "Competitive",
  location: "Location",
  operational: "Operational",
  legal: "Legal",
  risk: "Risk",
};

/**
 * Deterministic report content, used when the AI report writer fails twice.
 * Built only from the real scores, verdict, financials, risk register and the
 * scorer's own summary lists — so the user still gets their paid report
 * instead of a failed run, and nothing in it is invented. Written in English
 * regardless of report language (the structured sections stay localized).
 */
export function fallbackReport(ctx: {
  input: BusinessInput;
  overall: OverallAssessment;
  scores: CategoryScores;
  riskScoring: RiskScoring;
  financials: FinancialCalculations;
  strengths: string[];
  criticalIssues: string[];
  conditions: string[];
  nextSteps: string[];
}): ReportContent {
  const { overall, scores, input, financials: f, riskScoring } = ctx;
  const dims = Object.keys(DIMENSION_NAMES) as (keyof typeof DIMENSION_NAMES)[];
  const ranked = [...dims].sort((a, b) => scores[b] - scores[a]);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const cur = input.currency ?? "USD";
  const breakEven =
    f.break_even_months === null ? "does not reach break-even on current figures" : `breaks even in about ${f.break_even_months} months`;

  const risks =
    riskScoring.assessed === false
      ? ["The risk analysis could not be completed for this run — review risks before deciding."]
      : riskScoring.rankedRisks.slice(0, 3).map((r) => `${r.category}: ${r.description}`);

  return {
    executive_summary:
      `"${input.business_idea}" scores ${overall.overall_score}/100 overall — ${overall.rating}. ` +
      `The recommendation is ${overall.recommendation}.\n\n` +
      `Its strongest area is ${DIMENSION_NAMES[best].toLowerCase()} (${scores[best]}/100) and its weakest is ` +
      `${DIMENSION_NAMES[worst].toLowerCase()} (${scores[worst]}/100). On the stated figures the business makes ` +
      `${f.monthly_profit} ${cur} a month (${f.profit_margin_percent}% margin) and ${breakEven}.`,
    key_findings: [
      `Overall feasibility ${overall.overall_score}/100 (${overall.rating}).`,
      `Monthly profit of ${f.monthly_profit} ${cur} at a ${f.profit_margin_percent}% margin.`,
      ...ctx.strengths,
      ...ctx.criticalIssues,
    ].slice(0, 5),
    critical_success_factors: (ctx.conditions.length > 0 ? ctx.conditions : ctx.nextSteps).slice(0, 5),
    major_risks: risks,
    dimension_narratives: Object.fromEntries(
      dims.map((d) => [d, `${DIMENSION_NAMES[d]} scored ${scores[d]}/100. See the detailed section below for the specialist's findings.`])
    ) as ReportContent["dimension_narratives"],
    conclusion:
      `Based on a ${overall.overall_score}/100 assessment, the recommendation is ${overall.recommendation}. ` +
      `This summary was generated automatically from the scores because the written narrative could not be produced for this run; ` +
      `the scores, financials and detailed findings are unaffected.`,
  };
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
