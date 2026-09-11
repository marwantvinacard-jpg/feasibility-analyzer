// Wraps an LlmProvider to capture every raw prompt→completion pair — the
// actual input/output the model saw and returned, not just the final
// structured result. This is the corpus a later fine-tune (e.g. onto a small
// local model) would need: system prompt, user prompt, and the raw JSON
// completion, per specialist call, per analysis.

import type { LlmProvider, StructuredCall, StructuredResult } from "./provider";

export interface TrainingEntry {
  schemaName: string;
  system: string;
  user: string;
  /** The validated, parsed output — exactly what the caller received. */
  output: unknown;
  model: string;
  mock: boolean;
  tokensIn: number;
  tokensOut: number;
  at: number;
}

/** Wrap a provider so every `structured()` call is also reported to `sink`. */
export function withTrainingLog(llm: LlmProvider, sink: (entry: TrainingEntry) => void): LlmProvider {
  return {
    mock: llm.mock,
    model: llm.model,
    async structured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
      const result = await llm.structured(call);
      try {
        sink({
          schemaName: call.schemaName,
          system: call.system,
          user: call.user,
          output: result.data,
          model: call.model ?? llm.model,
          mock: llm.mock,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          at: Date.now(),
        });
      } catch {
        /* logging must never break the actual analysis */
      }
      return result;
    },
  };
}
