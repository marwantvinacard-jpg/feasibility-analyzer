// Independent second-opinion pass. Runs as its own LLM call, in parallel with
// the report/study narrative (no added latency — see runFeasibility.ts), with
// no access to how confident the first pass sounded, only the same underlying
// data every specialist and the report writer already saw. Its job is to be
// skeptical: catch a score that doesn't match its own stated reasoning, an
// unsupported claim, or something a diligent investor would push back on.
//
// Deliberately does NOT rewrite the scorecard. The eight dimension scores stay
// exactly what the deterministic math + first-pass specialists produced —
// this is a disclosed second opinion sitting next to that number, not a
// silent override of it. Shown to the reader in the "How we got this" tab so
// disagreement (if any) is visible, not just resolved invisibly on the model's
// say-so.

import { z } from "zod";
import type { LlmProvider } from "./provider";
import { languageBlock } from "./specialists";
import type {
  BusinessInput,
  CategoryScores,
  FinancialCalculations,
  OverallAssessment,
  RiskScoring,
  StageName,
  StageResults,
} from "./types";

const DIMENSIONS = ["market", "financial", "technical", "competitive", "location", "operational", "legal", "risk"] as const;

export const CrossCheckSchema = z
  .object({
    agreement: z.enum(["confirmed", "revised"]),
    confidence: z.enum(["High", "Medium", "Low"]),
    flags: z.array(z.string()),
    score_opinions: z.array(
      z
        .object({
          dimension: z.enum(DIMENSIONS),
          reported_score: z.number(),
          reviewer_score: z.number(),
          reason: z.string(),
        })
        .strict()
    ),
    summary: z.string(),
  })
  .strict();

export type CrossCheckResult = z.infer<typeof CrossCheckSchema>;

const CROSS_CHECK_PROMPT = `You are an independent reviewer auditing another analyst's feasibility assessment before it ships to the client — you did not write the original analysis.

Your job is to be skeptical, not to rubber-stamp:
- Does each dimension's score actually match the reasoning and evidence given for it?
- Is any claim stated with more confidence than the evidence supports?
- Do the specialists contradict each other or the computed financial numbers anywhere?
- Is anything a diligent investor would immediately question?

Rules:
- Use ONLY the material given below. Never invent new facts, market data, or numbers.
- Never second-guess the FINANCIALS block — that is deterministic arithmetic, not a judgment call.
- For "score_opinions": only include a dimension where you'd genuinely score it differently based on its OWN stated reasoning — most runs should have zero or very few entries. Do not manufacture disagreement to look thorough; "agreement: confirmed" with an empty list is a common, legitimate, honest outcome when the analysis holds up.
- "flags" lists specific unsupported or overconfident claims you found, in plain language — empty if none.
- This is a second opinion shown alongside the original scores, not a replacement for them — your reviewer_score is your own opinion, not an instruction to change anything.

Return JSON matching the schema.`;

export async function generateCrossCheck(
  llm: LlmProvider,
  ctx: {
    input: BusinessInput;
    stages: StageResults;
    financials: FinancialCalculations;
    riskScoring: RiskScoring;
    scores: CategoryScores;
    overall: OverallAssessment;
  }
): Promise<{ result: CrossCheckResult; tokensIn: number; tokensOut: number }> {
  const user =
    `REPORTED VERDICT: ${ctx.overall.overall_score}/100 — ${ctx.overall.rating} (${ctx.overall.recommendation})\n` +
    `REPORTED DIMENSION SCORES: ${JSON.stringify(ctx.scores)}\n` +
    `FINANCIALS (deterministic — do not second-guess): ${JSON.stringify(ctx.financials)}\n` +
    `RISK: level ${ctx.riskScoring.riskLevel}, overall ${ctx.riskScoring.overallRiskScore}/100\n` +
    `INPUT: ${JSON.stringify(ctx.input)}\n` +
    `EACH SPECIALIST'S FULL FINDINGS (this is the reasoning behind each reported score): ${JSON.stringify(ctx.stages)}` +
    languageBlock(ctx.input);

  const { data, tokensIn, tokensOut } = await llm.structured<CrossCheckResult>({
    system: CROSS_CHECK_PROMPT,
    user,
    schema: CrossCheckSchema,
    schemaName: "cross_check",
    mockValue: mockCrossCheck(ctx.scores),
  });
  return { result: data, tokensIn, tokensOut };
}

function mockCrossCheck(scores: CategoryScores): CrossCheckResult {
  return {
    agreement: "confirmed",
    confidence: "Medium",
    flags: [],
    score_opinions: [],
    summary: `(mock) Independent review not run — no AI provider is configured, so this reflects mock data, not a real second opinion of the ${scores.financial}/100 financial or other dimension scores.`,
  };
}

export const CROSS_CHECK_DIMENSIONS: readonly StageName[] = DIMENSIONS;
