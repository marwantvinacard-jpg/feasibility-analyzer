// Shape of an analysis persisted in Firestore (analyses/{id}). Shared by the
// server route that writes it and the client that reads it via onSnapshot.
import type { BusinessInput, StageName, StageStatus } from "./engine/types";
import type { FullResult } from "./engine/runFeasibility";

export type AnalysisStatus = "running" | "complete" | "failed";
export type ReviewStatus = "unreviewed" | "reviewed";

export interface AnalysisDoc {
  id: string;
  uid: string;
  /** Set when the owner belongs to an org — lets teammates see it too (see firestore.rules). */
  orgId?: string;
  /** Set when this run came through the public API rather than the app UI. */
  source?: "api";
  /** True once the one-time export unlock has been paid for this study (or the owner is export-exempt). */
  exportUnlocked?: boolean;
  createdAt: number;
  status: AnalysisStatus;
  input: BusinessInput;
  /** Absent for API-run analyses, which are synchronous (no live per-stage progress). */
  stageStatus?: Record<StageName, StageStatus>;
  result?: FullResult;
  error?: string;
  /** true when a credit was charged (so failures can refund exactly once). */
  charged?: boolean;
  /** "byok" when the run used the customer's own AI key (no credit charged). */
  keyMode?: "platform" | "byok";

  /** Analyst sign-off — the difference between an AI opinion and a fundable study. */
  reviewStatus?: ReviewStatus;
  reviewedBy?: string; // email of the admin who reviewed it
  reviewedAt?: number;
  reviewNotes?: string;
}

/** A saved, named stress-test scenario (analyses/{id}/scenarios/{scenarioId}). */
export interface ScenarioDoc {
  id: string;
  name: string;
  knobs: Record<string, number>;
  createdAt: number;
  createdBy: string; // email
}

/**
 * The slice of an analysis the dashboard and Benchmarks actually use. A full
 * analysis doc carries the whole report, the 15-section study, 60-month
 * projections and uploaded document text (often 100 KB+); listing screens
 * fetch only these fields, via GET /api/analyses (Firestore field selection).
 */
export interface AnalysisSummary {
  id: string;
  uid: string;
  orgId?: string;
  source?: "api";
  createdAt: number;
  status: AnalysisStatus;
  error?: string;
  reviewStatus?: ReviewStatus;
  exportUnlocked?: boolean;
  input: Pick<BusinessInput, "business_idea" | "location" | "client_name" | "business_type" | "currency">;
  result?: {
    overall: FullResult["overall"];
    categoryScores: FullResult["categoryScores"];
    study?: { projections: { funding: { total: number }; capexTotal: number } };
  };
}

/** Firestore field paths that make up an AnalysisSummary (keep in sync with the type above). */
export const ANALYSIS_SUMMARY_FIELDS = [
  "id",
  "uid",
  "orgId",
  "source",
  "createdAt",
  "status",
  "error",
  "reviewStatus",
  "exportUnlocked",
  "input.business_idea",
  "input.location",
  "input.client_name",
  "input.business_type",
  "input.currency",
  "result.overall",
  "result.categoryScores",
  "result.study.projections.funding.total",
  "result.study.projections.capexTotal",
] as const;
