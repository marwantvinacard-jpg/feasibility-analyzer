// Native Ollama provider — the FREE, no-key, local path. Uses Ollama's own
// `format` parameter (grammar-constrained decoding) for schema-valid JSON, which
// the OpenAI-compat shim does NOT enforce reliably (per research: ollama#10001).
// The `ollama` package is imported dynamically so the app builds fine when it
// isn't installed / isn't in use.

import { zodToJsonSchema } from "zod-to-json-schema";
import type { LlmProvider, StructuredCall, StructuredResult } from "./provider";

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
    const res = await client.chat({
      model: call.model ?? this.model,
      messages: [
        { role: "system", content: call.system },
        { role: "user", content: call.user },
      ],
      // Grammar-constrained JSON — guarantees a parseable object matching the schema.
      format: zodToJsonSchema(call.schema as any) as any,
      options: { temperature: 0 },
    });
    const parsed = JSON.parse(res.message.content);
    const data = call.schema.parse(parsed); // still validate — belt and braces
    return {
      data,
      tokensIn: (res as any).prompt_eval_count ?? 0,
      tokensOut: (res as any).eval_count ?? 0,
    };
  }
}
