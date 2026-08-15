// LLM provider abstraction. One interface, two implementations:
//  - OpenAIProvider: real structured-outputs calls (BYOK or platform key).
//  - the same class in mock mode: returns the caller-supplied fixture,
//    validated against the same schema, with zero network + zero cost.
//
// Every call goes through `structured()` so nothing in the engine ever parses
// free-form prose — the model must return schema-valid JSON or the call throws.

import OpenAI from "openai";
import type { z } from "zod";
import { jsonSchemaFor } from "./schemas";

export interface StructuredCall<T> {
  /** System prompt (the specialist persona + rubric). */
  system: string;
  /** User message (the task + business data). */
  user: string;
  /** Zod schema used to validate the response. */
  schema: z.ZodType<T>;
  /** Schema name sent to OpenAI structured outputs. */
  schemaName: string;
  /** Optional per-call model override. */
  model?: string;
  /** Returned verbatim (after validation) when the provider is in mock mode. */
  mockValue: T;
}

export interface StructuredResult<T> {
  data: T;
  tokensIn: number;
  tokensOut: number;
}

export interface LlmProvider {
  readonly mock: boolean;
  readonly model: string;
  structured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>>;
}

export class OpenAIProvider implements LlmProvider {
  readonly mock: boolean;
  readonly model: string;
  private client: OpenAI | null;

  constructor(opts: { apiKey?: string; model?: string; mock?: boolean } = {}) {
    this.mock = opts.mock ?? process.env.FEASIBILITY_MOCK === "true";
    this.model = opts.model ?? process.env.FEASIBILITY_MODEL ?? "gpt-4o";
    const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
    // In mock mode we never touch the network, so a missing key is fine.
    this.client = this.mock ? null : new OpenAI({ apiKey });
    if (!this.mock && !apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Set it in .env.local, or run with FEASIBILITY_MOCK=true."
      );
    }
  }

  async structured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
    if (this.mock) {
      const data = call.schema.parse(call.mockValue);
      return { data, tokensIn: 0, tokensOut: 0 };
    }

    const resp = await this.client!.chat.completions.create({
      model: call.model ?? this.model,
      messages: [
        { role: "system", content: call.system },
        { role: "user", content: call.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: jsonSchemaFor(call.schemaName, call.schema),
      },
    });

    const raw = resp.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Model returned non-JSON for "${call.schemaName}": ${raw.slice(0, 300)}`);
    }
    const data = call.schema.parse(parsed); // throws on schema mismatch — no silent fallback
    return {
      data,
      tokensIn: resp.usage?.prompt_tokens ?? 0,
      tokensOut: resp.usage?.completion_tokens ?? 0,
    };
  }
}
