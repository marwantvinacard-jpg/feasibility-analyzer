// The orchestrator — the whole engine in one call. Mirrors the n8n graph:
//   compute financials → 6 specialists in parallel → deterministic scoring →
//   report content. Emits per-stage progress so the web app can render live
//   status from Firestore. Named results + per-stage error capture replace the
//   fragile 6-way merge-by-index.

import type { LlmProvider } from "./provider";
import { createLlm } from "./factory";
import type { SearchProvider } from "./search";
import { SerpApiProvider } from "./search";
import { computeFinancials } from "./financial";
import { scoreRisks } from "./risk";
import { computeCategoryScores, overallAssessment, summarize } from "./scorer";
import { generateReport, type ReportContent } from "./report";
import { generateStudy, type FinancialStudy } from "./study";
import type { FinancialModel } from "./financialModel";
import {
  runCompetitive,
  runFinancial,
  runFinancialModel,
  runLegal,
  runLocation,
  runMarket,
  runOperational,
  runRisk,
  runStakeholders,
  runTechnical,
  type StageOutput,
} from "./specialists";
import {
  ALL_STAGES,
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
  /**
   * The 15-section financial feasibility study. Absent when the model or
   * narrative step failed, and absent on analyses run before the study existed —
   * every consumer must treat it as optional.
   */
  study?: FinancialStudy;
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
  const llm = opts.llm ?? createLlm();
  const search = opts.search ?? new SerpApiProvider();
  const onProgress = opts.onProgress ?? (() => {});

  const stageStatus = Object.fromEntries(ALL_STAGES.map((s) => [s, "pending"])) as Record<
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
    operational: () => runOperational(llm, search, input),
    legal: () => runLegal(llm, search, input),
    risk: () => runRisk(llm, search, input),
  };

  // The financial model and the stakeholder analysis ride along with the
  // scored stages. Neither is a scoring dimension, so their failure degrades
  // gracefully (no study / no stakeholder section) rather than affecting the
  // verdict.
  const modelPromise = runFinancialModel(llm, search, input);
  const stakeholdersPromise = runStakeholders(llm, search, input);

  const outputs = await Promise.all(
    ALL_STAGES.map(async (stage) => {
      stageStatus[stage] = "running";
      onProgress(stage, "running");
      const out = await runners[stage]();
      stageStatus[stage] = out.ok ? "done" : "failed";
      onProgress(stage, stageStatus[stage]);
      return out;
    })
  );
  const [modelOut, stakeholdersOut] = await Promise.all([modelPromise, stakeholdersPromise]);

  const stages: StageResults = {};
  const sources: Source[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  for (const out of [...outputs, modelOut, stakeholdersOut]) {
    if (out.ok && out.data && out.stage !== "financial_model") (stages as any)[out.stage] = out.data;
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

  // 5) Narrative content — the feasibility report, and the financial study when
  //    a model was produced. Independent calls, so they run together.
  const model = modelOut.ok ? (modelOut.data as FinancialModel) : null;
  const [report, studyOut] = await Promise.all([
    generateReport(llm, { input, stages, financials, riskScoring, scores, overall }),
    model
      ? generateStudy(llm, { input, model, stages, riskScoring }).catch(() => null)
      : Promise.resolve(null),
  ]);
  tokensIn += report.tokensIn + (studyOut?.tokensIn ?? 0);
  tokensOut += report.tokensOut + (studyOut?.tokensOut ?? 0);

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
    ...(studyOut ? { study: studyOut.study } : {}),
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
