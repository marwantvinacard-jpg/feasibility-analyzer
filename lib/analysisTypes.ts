// Shape of an analysis persisted in Firestore (analyses/{id}). Shared by the
// server route that writes it and the client that reads it via onSnapshot.
import type { BusinessInput, StageName, StageStatus } from "./engine/types";
import type { FullResult } from "./engine/runFeasibility";

export type AnalysisStatus = "running" | "complete" | "failed";

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
}
