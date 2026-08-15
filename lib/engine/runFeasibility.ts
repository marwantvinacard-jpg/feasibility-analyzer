// The orchestrator — the whole engine in one call. Mirrors the n8n graph:
//   compute financials → 6 specialists in parallel → deterministic scoring →
//   report content. Emits per-stage progress so the web app can render live
//   status from Firestore. Named results + per-stage error capture replace the
//   fragile 6-way merge-by-index.

import type { LlmProvider } from "./provider";
import { OpenAIProvider } from "./provider";
import type { SearchProvider } from "./search";
import { SerpApiProvider } from "./search";
import { computeFinancials } from "./financial";
import { scoreRisks } from "./risk";
import { computeCategoryScores, overallAssessment, summarize } from "./scorer";
import { generateReport, type ReportContent } from "./report";
import {
  runCompetitive,
  runFinancial,
  runLocation,
  runMarket,
  runRisk,
  runTechnical,
  type StageOutput,
} from "./specialists";
import {
  SIX_STAGES,
  type BusinessInput,
  type FeasibilityResult,
  type Source,
  type StageName,
  type StageResults,
  type StageStatus,
} from "./types";

export interface RunOptions {
  llm?: LlmProvider;
  search?: SearchProvider;
  /** Called as each stage transitions state — wire to Firestore for live UI. */
  onProgress?: (stage: StageName, status: StageStatus) => void;
}

export interface FullResult extends FeasibilityResult {
  report: ReportContent;
}

/** Rough gpt-4o pricing (USD/1M tokens). Estimate only — real cost logged per run. */
function estimateCostCents(tokensIn: number, tokensOut: number): number {
  const inUsd = (tokensIn / 1_000_000) * 2.5;
  const outUsd = (tokensOut / 1_000_000) * 10;
  return Math.round((inUsd + outUsd) * 100);
}

export async function runFeasibility(
  input: BusinessInput,
  opts: RunOptions = {}
): Promise<FullResult> {
  const llm = opts.llm ?? new OpenAIProvider();
  const search = opts.search ?? new SerpApiProvider();
  const onProgress = opts.onProgress ?? (() => {});

  const stageStatus = Object.fromEntries(SIX_STAGES.map((s) => [s, "pending"])) as Record<
    StageName,
    StageStatus
  >;

  // 1) Deterministic financials up front (also fed to the financial specialist).
  const financials = computeFinancials(input);

  // 2) Fan out all six specialists in parallel. Each catches its own errors.
  const runners: Record<StageName, () => Promise<StageOutput<any>>> = {
    market: () => runMarket(llm, search, input),
    financial: () => runFinancial(llm, search, input, financials),
    technical: () => runTechnical(llm, search, input),
    competitive: () => runCompetitive(llm, search, input),
    location: () => runLocation(llm, search, input),
    risk: () => runRisk(llm, search, input),
  };

  const outputs = await Promise.all(
    SIX_STAGES.map(async (stage) => {
      stageStatus[stage] = "running";
      onProgress(stage, "running");
      const out = await runners[stage]();
      stageStatus[stage] = out.ok ? "done" : "failed";
      onProgress(stage, stageStatus[stage]);
      return out;
    })
  );

  const stages: StageResults = {};
  const sources: Source[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  for (const out of outputs) {
    if (out.ok && out.data) (stages as any)[out.stage] = out.data;
    sources.push(...out.sources);
    tokensIn += out.tokensIn;
    tokensOut += out.tokensOut;
  }

  // 3) Deterministic risk scoring from the structured rows.
  const riskScoring = scoreRisks(stages.risk ?? { risks: [], dealbreaker_risks: [] });

  // 4) Category scores, weighted overall, verdict, and the summary lists.
  const { scores } = computeCategoryScores(stages, financials, riskScoring);
  const overall = overallAssessment(scores);
  const { criticalIssues, strengths, conditions, nextSteps } = summarize(scores, overall);

  // 5) Report narrative content (rendered to PDF/web downstream).
  const report = await generateReport(llm, {
    input,
    stages,
    financials,
    riskScoring,
    scores,
    overall,
  });
  tokensIn += report.tokensIn;
  tokensOut += report.tokensOut;

  const uniqueSources = dedupeSources(sources);

  return {
    input,
    stages,
    stageStatus,
    financials,
    riskScoring,
    categoryScores: scores,
    overall,
    criticalIssues,
    strengths,
    conditions,
    nextSteps,
    sources: uniqueSources,
    usage: {
      model: llm.model,
      mock: llm.mock,
      tokensIn,
      tokensOut,
      costCents: estimateCostCents(tokensIn, tokensOut),
    },
    report: report.content,
  };
}

function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of sources) {
    if (!s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}
