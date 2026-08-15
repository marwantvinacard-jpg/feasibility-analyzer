// Runs the six feasibility specialists. Each is an independent structured LLM
// call, keyed BY NAME (not merged by index like n8n), so one failing branch
// can't silently shift another dimension's score. Research-heavy stages get a
// capped web-research context injected first.

import type { LlmProvider } from "./provider";
import type { SearchProvider } from "./search";
import { gatherResearch } from "./search";
import {
  CompetitiveSchema,
  FinancialJudgmentSchema,
  LocationSchema,
  MarketSchema,
  RiskSchema,
  TechnicalSchema,
} from "./schemas";
import {
  COMPETITIVE_PROMPT,
  FINANCIAL_PROMPT,
  LOCATION_PROMPT,
  MARKET_PROMPT,
  RISK_PROMPT,
  TECHNICAL_PROMPT,
} from "./prompts";
import {
  mockCompetitive,
  mockFinancialJudgment,
  mockLocation,
  mockMarket,
  mockRisk,
  mockTechnical,
} from "./mocks";
import type {
  BusinessInput,
  FinancialCalculations,
  Source,
  StageName,
} from "./types";

export interface StageOutput<T> {
  stage: StageName;
  data: T | null;
  ok: boolean;
  error?: string;
  sources: Source[];
  tokensIn: number;
  tokensOut: number;
}

const businessBlock = (input: BusinessInput) =>
  `Business data (JSON):\n${JSON.stringify(input, null, 2)}`;

/** Generic runner: gather research (if any), call the LLM, validate, capture cost. */
async function runStage<T>(
  llm: LlmProvider,
  search: SearchProvider,
  stage: StageName,
  system: string,
  schema: any,
  schemaName: string,
  input: BusinessInput,
  mockValue: T,
  extraUser = ""
): Promise<StageOutput<T>> {
  try {
    const research =
      stage === "financial" ? { text: "", sources: [] } : await gatherResearch(search, stage, input);
    const user = `${businessBlock(input)}${extraUser}${research.text}`;
    const { data, tokensIn, tokensOut } = await llm.structured<T>({
      system,
      user,
      schema,
      schemaName,
      mockValue,
    });
    return { stage, data, ok: true, sources: research.sources, tokensIn, tokensOut };
  } catch (err) {
    return {
      stage,
      data: null,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      sources: [],
      tokensIn: 0,
      tokensOut: 0,
    };
  }
}

export function runMarket(llm: LlmProvider, search: SearchProvider, input: BusinessInput) {
  return runStage(llm, search, "market", MARKET_PROMPT, MarketSchema, "market", input, mockMarket(input));
}

export function runFinancial(
  llm: LlmProvider,
  search: SearchProvider,
  input: BusinessInput,
  calc: FinancialCalculations
) {
  const extra = `\n\nPre-computed financial calculations (do not recompute):\n${JSON.stringify(calc, null, 2)}`;
  return runStage(
    llm,
    search,
    "financial",
    FINANCIAL_PROMPT,
    FinancialJudgmentSchema,
    "financial_judgment",
    input,
    mockFinancialJudgment(input),
    extra
  );
}

export function runTechnical(llm: LlmProvider, search: SearchProvider, input: BusinessInput) {
  return runStage(llm, search, "technical", TECHNICAL_PROMPT, TechnicalSchema, "technical", input, mockTechnical(input));
}

export function runCompetitive(llm: LlmProvider, search: SearchProvider, input: BusinessInput) {
  return runStage(
    llm,
    search,
    "competitive",
    COMPETITIVE_PROMPT,
    CompetitiveSchema,
    "competitive",
    input,
    mockCompetitive(input)
  );
}

export function runLocation(llm: LlmProvider, search: SearchProvider, input: BusinessInput) {
  return runStage(llm, search, "location", LOCATION_PROMPT, LocationSchema, "location", input, mockLocation(input));
}

export function runRisk(llm: LlmProvider, search: SearchProvider, input: BusinessInput) {
  return runStage(llm, search, "risk", RISK_PROMPT, RiskSchema, "risk", input, mockRisk(input));
}
