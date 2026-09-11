// Shape of a saved analysis. The app has no backend DB — a completed run is
// stored in the browser (lib/store.ts) after arriving over SSE.
import type { BusinessInput, StageName, StageStatus } from "./engine/types";
import type { FullResult } from "./engine/runFeasibility";

export type AnalysisStatus = "running" | "complete" | "failed";

export interface AnalysisDoc {
  id: string;
  createdAt: number;
  status: AnalysisStatus;
  input: BusinessInput;
  stageStatus: Record<StageName, StageStatus>;
  result?: FullResult;
  error?: string;
}
