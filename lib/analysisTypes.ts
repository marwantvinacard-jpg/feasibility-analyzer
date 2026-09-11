// Shape of an analysis persisted in Firestore (analyses/{id}). Shared by the
// server route that writes it and the client that reads it via onSnapshot.
import type { BusinessInput, StageName, StageStatus } from "./engine/types";
import type { FullResult } from "./engine/runFeasibility";

export type AnalysisStatus = "running" | "complete" | "failed";
export type ReviewStatus = "unreviewed" | "reviewed";

export interface AnalysisDoc {
  id: string;
  uid: string;
  createdAt: number;
  status: AnalysisStatus;
  input: BusinessInput;
  stageStatus: Record<StageName, StageStatus>;
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
