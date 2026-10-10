// Native Ollama provider — the FREE, no-key, local path. Uses Ollama's own
// `format` parameter (grammar-constrained decoding) for schema-valid JSON, which
// the OpenAI-compat shim does NOT enforce reliably (per research: ollama#10001).
// The `ollama` package is imported dynamically so the app builds fine when it
// isn't installed / isn't in use.

import { zodToJsonSchema } from "zod-to-json-schema";
import type { LlmProvider, StructuredCall, StructuredResult } from "./provider";
import { UNTRUSTED_DATA_RULE } from "./untrusted";

export class OllamaProvider implements LlmProvider {
  readonly mock = false;
  readonly model: string;
  private host: string;

  constructor(opts: { model?: string; host?: string } = {}) {
    this.model = opts.model ?? process.env.FEASIBILITY_MODEL ?? process.env.FEASIBILITY_OLLAMA_MODEL ?? "qwen3";
    this.host = opts.host ?? process.env.OLLAMA_HOST ?? "http://localhost:11434";
  }

  async structured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
    const { Ollama } = await import("ollama");
    const client = new Ollama({ host: this.host });
    // Same reasoning as OpenAIProvider's client timeout: the call has to fail
    // on its own, well inside the run's time budget, so the run can be settled
    // (failed + refunded) instead of left hanging. Deliberately no retry here
    // (unlike the OpenAI-compatible path, whose SDK retries) — a local model
    // that's this slow is usually resource-starved, not transiently flaky, so
    // retrying would just double the wait for the same outcome.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const res = await Promise.race([
      client.chat({
        model: call.model ?? this.model,
        messages: [
          { role: "system", content: call.system + UNTRUSTED_DATA_RULE },
          { role: "user", content: call.user },
        ],
        // Grammar-constrained JSON — guarantees a parseable object matching the schema.
        format: zodToJsonSchema(call.schema as any) as any,
        options: { temperature: 0 },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Ollama request timed out after 60s")), 60_000);
      }),
    ]).finally(() => clearTimeout(timer));
    const parsed = JSON.parse(res.message.content);
    const data = call.schema.parse(parsed); // still validate — belt and braces
    return {
      data,
      tokensIn: (res as any).prompt_eval_count ?? 0,
      tokensOut: (res as any).eval_count ?? 0,
    };
  }
}
