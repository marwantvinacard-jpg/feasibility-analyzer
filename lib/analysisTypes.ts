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
