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
import { UNTRUSTED_DATA_RULE } from "./untrusted";

const envInt = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

/** Sampling temperature for every structured call (FEASIBILITY_TEMPERATURE, default 0.2). */
export const LLM_TEMPERATURE = (() => {
  const n = Number(process.env.FEASIBILITY_TEMPERATURE);
  return Number.isFinite(n) && n >= 0 && n <= 2 ? n : 0.2;
})();
const LLM_SEED = 20260926;

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

/**
 * OpenAI-compatible provider. Because Gemini, Groq, Cerebras and OpenRouter all
 * speak the OpenAI Chat Completions API, one class covers every hosted option —
 * just point `baseURL` at the provider and pass its key + model. (Ollama gets a
 * dedicated native branch elsewhere for grammar-constrained schemas.) In mock
 * mode it returns the caller's fixture with an optional small delay so the web
 * UI can show believable live per-stage progress.
 */
export class OpenAIProvider implements LlmProvider {
  readonly mock: boolean;
  readonly model: string;
  private client: OpenAI | null;
  private mockDelayMs: number;
  /** OpenAI itself (no custom baseURL) — the only provider we send `seed` to. */
  private isOpenAI: boolean;

  constructor(
    opts: { apiKey?: string; model?: string; mock?: boolean; baseURL?: string; mockDelayMs?: number } = {}
  ) {
    this.mock = opts.mock ?? process.env.FEASIBILITY_MOCK === "true";
    this.model = opts.model ?? process.env.FEASIBILITY_MODEL ?? "gpt-4o";
    this.mockDelayMs = opts.mockDelayMs ?? Number(process.env.FEASIBILITY_MOCK_DELAY_MS ?? 0);
    const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
    const baseURL = opts.baseURL ?? process.env.FEASIBILITY_BASE_URL;
    this.isOpenAI = !baseURL;
    // In mock mode we never touch the network, so a missing key is fine.
    // A hard per-call timeout matters: a hanging provider must fail the call
    // on its own, well inside the run's time budget (lib/runLifecycle.ts), so
    // the run can be settled — failed and refunded — instead of stuck. The SDK
    // also retries 429s and 5xx itself with exponential backoff (honouring
    // Retry-After); its defaults are 2 retries and a 10-minute timeout, far
    // past the run's time limit.
    this.client = this.mock
      ? null
      : new OpenAI({
          apiKey,
          baseURL,
          timeout: envInt("FEASIBILITY_LLM_TIMEOUT_MS", 60_000),
          maxRetries: envInt("FEASIBILITY_LLM_MAX_RETRIES", 3),
        });
    if (!this.mock && !apiKey) {
      throw new Error(
        "No LLM API key set. Set OPENAI_API_KEY (or a compatible key + FEASIBILITY_BASE_URL) in .env.local, or run with FEASIBILITY_MOCK=true."
      );
    }
  }

  async structured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
    if (this.mock) {
      if (this.mockDelayMs > 0) {
        // Jitter so stages don't finish in lockstep.
        const jitter = this.mockDelayMs * (0.6 + Math.random() * 0.8);
        await new Promise((r) => setTimeout(r, jitter));
      }
      const data = call.schema.parse(call.mockValue);
      return { data, tokensIn: 0, tokensOut: 0 };
    }

    const resp = await this.client!.chat.completions.create({
      model: call.model ?? this.model,
      // Low temperature + a fixed seed: the same business idea should get the
      // same verdict. At the default (1.0) repeat runs could land on different
      // sides of the GO / NO-GO bands. (Providers don't promise bit-identical
      // output even so; this makes large swings unlikely, not impossible.)
      temperature: LLM_TEMPERATURE,
      ...(this.isOpenAI ? { seed: LLM_SEED } : {}),
      messages: [
        { role: "system", content: call.system + UNTRUSTED_DATA_RULE },
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
