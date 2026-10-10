// Provider factory — one place that turns env config into a ready LlmProvider.
// The whole point: users never touch base URLs. Set FEASIBILITY_PROVIDER (or
// just drop in a key) and the engine uses it. Default is MOCK so the app runs
// with zero setup. Every hosted option is OpenAI-API-compatible, so they all go
// through OpenAIProvider with a different baseURL/model; Ollama is native.

import { OpenAIProvider, type LlmProvider } from "./provider";
import { OllamaProvider } from "./ollama";
import { withConcurrencyLimit } from "./concurrency";
import { isProductionDeployment } from "../runtimeEnv";

export type ProviderName = "mock" | "openai" | "gemini" | "groq" | "cerebras" | "ollama";

interface HostedPreset {
  baseURL?: string;
  defaultModel: string;
  keyEnv: string;
}

// OpenAI-compatible hosted providers. Keys come from env; models overridable via
// FEASIBILITY_MODEL. Free tiers (per research): Gemini 2.5 Flash, Groq, Cerebras.
export type HostedProviderName = Exclude<ProviderName, "mock" | "ollama">;

export const HOSTED: Record<HostedProviderName, HostedPreset> = {
  openai: { defaultModel: "gpt-4o", keyEnv: "OPENAI_API_KEY" },
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.5-flash",
    keyEnv: "GEMINI_API_KEY",
  },
  groq: { baseURL: "https://api.groq.com/openai/v1", defaultModel: "openai/gpt-oss-120b", keyEnv: "GROQ_API_KEY" },
  cerebras: { baseURL: "https://api.cerebras.ai/v1", defaultModel: "qwen-3-32b", keyEnv: "CEREBRAS_API_KEY" },
};

/** Pick a provider from FEASIBILITY_PROVIDER, else auto-detect from present keys. */
export function activeProviderName(): ProviderName {
  const explicit = process.env.FEASIBILITY_PROVIDER?.toLowerCase() as ProviderName | undefined;
  if (explicit) return explicit;
  if (process.env.FEASIBILITY_MOCK === "true") return "mock";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.CEREBRAS_API_KEY) return "cerebras";
  if (process.env.OLLAMA_HOST) return "ollama";
  return "mock";
}

/**
 * Thrown when a production server has no real AI provider. Before, a missing
 * key (or FEASIBILITY_MOCK=true) quietly switched to MOCK — paying customers
 * got canned sample reports and were charged for them.
 */
export class LlmConfigError extends Error {}


export interface LlmFactoryOpts {
  /** Slow the mock provider so the web UI shows believable live progress. */
  mockDelayMs?: number;
  /** Force a provider regardless of env (used rarely, e.g. tests). */
  provider?: ProviderName;
}

export function createLlm(opts: LlmFactoryOpts = {}): LlmProvider {
  const name = opts.provider ?? activeProviderName();
  const model = process.env.FEASIBILITY_MODEL;

  if (name === "mock") {
    // Code that explicitly asks for mock (tests, the static sample report) is
    // fine; mock chosen by environment config never is, in production.
    if (!opts.provider && isProductionDeployment()) {
      throw new LlmConfigError(
        "No AI provider is configured on this server (set OPENAI_API_KEY or another provider key, and don't set FEASIBILITY_MOCK / FEASIBILITY_PROVIDER=mock in production)."
      );
    }
    return new OpenAIProvider({ mock: true, mockDelayMs: opts.mockDelayMs });
  }
  if (name === "ollama") return withConcurrencyLimit(new OllamaProvider({ model }));

  const preset = HOSTED[name as keyof typeof HOSTED];
  if (!preset) {
    throw new Error(`Unknown FEASIBILITY_PROVIDER "${name}". Use one of: mock, openai, gemini, groq, cerebras, ollama.`);
  }
  const apiKey = process.env[preset.keyEnv];
  if (!apiKey) {
    throw new Error(`Provider "${name}" selected but ${preset.keyEnv} is not set (in .env.local).`);
  }
  // Real providers share the per-instance call limiter (see concurrency.ts).
  // mock: false explicitly — otherwise FEASIBILITY_MOCK=true would silently
  // turn even a real, keyed provider into the mock.
  return withConcurrencyLimit(
    new OpenAIProvider({ apiKey, baseURL: preset.baseURL, model: model ?? preset.defaultModel, mock: false })
  );
}

/**
 * A real provider using a customer's own key (bring-your-own-key). Never mock,
 * and it shares the same per-instance call limiter as platform calls.
 */
export function createLlmForKey(provider: HostedProviderName, apiKey: string): LlmProvider {
  const preset = HOSTED[provider];
  if (!preset) throw new Error(`Unknown provider "${provider}".`);
  return withConcurrencyLimit(new OpenAIProvider({ apiKey, baseURL: preset.baseURL, model: preset.defaultModel, mock: false }));
}
