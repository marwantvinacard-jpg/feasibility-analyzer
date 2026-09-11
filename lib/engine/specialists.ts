// Runs the six feasibility specialists. Each is an independent structured LLM
// call, keyed BY NAME (not merged by index like n8n), so one failing branch
// can't silently shift another dimension's score. Research-heavy stages get a
// capped web-research context injected first.

import type { LlmProvider } from "./provider";
import type { ResearchStage, SearchProvider } from "./search";
import { gatherResearch } from "./search";
import { FinancialModelSchema } from "./financialModel";
import {
  CompetitiveSchema,
  FinancialJudgmentSchema,
  LegalSchema,
  LocationSchema,
  MarketSchema,
  OperationalSchema,
  RiskSchema,
  StakeholderSchema,
  TechnicalSchema,
} from "./schemas";
import {
  COMPETITIVE_PROMPT,
  FINANCIAL_MODEL_PROMPT,
  FINANCIAL_PROMPT,
  LEGAL_PROMPT,
  LOCATION_PROMPT,
  MARKET_PROMPT,
  OPERATIONAL_PROMPT,
  RISK_PROMPT,
  STAKEHOLDER_PROMPT,
  TECHNICAL_PROMPT,
} from "./prompts";
import {
  mockCompetitive,
  mockFinancialJudgment,
  mockFinancialModel,
  mockLegal,
  mockLocation,
  mockMarket,
  mockOperational,
  mockRisk,
  mockStakeholders,
  mockTechnical,
} from "./mocks";
import type {
  BusinessInput,
  FinancialCalculations,
  Source,
} from "./types";
import { verticalHint } from "./verticals";

export interface StageOutput<T> {
  stage: ResearchStage;
  data: T | null;
  ok: boolean;
  error?: string;
  sources: Source[];
  tokensIn: number;
  tokensOut: number;
}

const businessBlock = (input: BusinessInput) => {
  const { knowledge_base, business_type, ...core } = input;
  return `Business data (JSON):\n${JSON.stringify(core, null, 2)}${verticalHint(business_type)}`;
};

/** Applicant-uploaded reference material, appended verbatim (capped upstream). */
const knowledgeBlock = (input: BusinessInput) =>
  input.knowledge_base && input.knowledge_base.trim()
    ? `\n\nReference material provided by the applicant (uploaded documents — use where relevant and cite as "applicant documents"; do not treat as verified):\n"""\n${input.knowledge_base.trim()}\n"""`
    : "";

/**
 * Optional user-chosen methodology/emphasis (e.g. "follow SBA feasibility
 * study format", "weight legal risk heavily", "assume a lean bootstrap
 * approach"). Advisory only — it can never override the scoring rubric or
 * the requirement to return the schema shape exactly.
 */
const protocolBlock = (input: BusinessInput) =>
  input.study_protocol && input.study_protocol.trim()
    ? `\n\nThe applicant requested this study emphasize or follow: "${input.study_protocol.trim()}". Honor this in your ANALYSIS AND NARRATIVE where it doesn't conflict with the instructions above — never change the required output schema or the scoring rubric to fit it.`
    : "";

/** Generic runner: gather research (if any), call the LLM, validate, capture cost. */
async function runStage<T>(
  llm: LlmProvider,
  search: SearchProvider,
  stage: ResearchStage,
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
    const user = `${businessBlock(input)}${knowledgeBlock(input)}${protocolBlock(input)}${extraUser}${research.text}`;
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

/**
 * Builds the cost/revenue model behind the financial feasibility study. Not a
 * scoring dimension — it produces drivers, which projections.ts turns into the
 * P&L, cash flow, break-even and return metrics.
 */
export function runFinancialModel(llm: LlmProvider, search: SearchProvider, input: BusinessInput) {
  const horizon = input.projection_years ?? 5;
  const extra =
    `\n\nModel currency: ${input.currency ?? "USD"}. Projection horizon: ${horizon} years.` +
    (input.capex_budget
      ? `\nThe applicant states a setup budget of ${input.capex_budget} — reconcile your CapEx lines to it and flag any shortfall in the assumption notes.`
      : "") +
    (input.funding_preference
      ? `\nThe applicant's preferred funding structure: ${input.funding_preference}.`
      : "");
  return runStage(
    llm,
    search,
    "financial_model",
    FINANCIAL_MODEL_PROMPT,
    FinancialModelSchema,
    "financial_model",
    input,
    mockFinancialModel(input),
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

export function runOperational(llm: LlmProvider, search: SearchProvider, input: BusinessInput) {
  return runStage(llm, search, "operational", OPERATIONAL_PROMPT, OperationalSchema, "operational", input, mockOperational(input));
}

export function runLegal(llm: LlmProvider, search: SearchProvider, input: BusinessInput) {
  return runStage(llm, search, "legal", LEGAL_PROMPT, LegalSchema, "legal", input, mockLegal(input));
}

/** Not a scored dimension — runs alongside the six/eight like the financial model. */
export function runStakeholders(llm: LlmProvider, search: SearchProvider, input: BusinessInput) {
  return runStage(llm, search, "stakeholders", STAKEHOLDER_PROMPT, StakeholderSchema, "stakeholders", input, mockStakeholders(input));
}
