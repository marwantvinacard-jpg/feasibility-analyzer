// Provider factory — one place that turns env config into a ready LlmProvider.
// The whole point: users never touch base URLs. Set FEASIBILITY_PROVIDER (or
// just drop in a key) and the engine uses it. Default is MOCK so the app runs
// with zero setup. Every hosted option is OpenAI-API-compatible, so they all go
// through OpenAIProvider with a different baseURL/model; Ollama is native.

import { OpenAIProvider, type LlmProvider } from "./provider";
import { OllamaProvider } from "./ollama";

export type ProviderName = "mock" | "openai" | "gemini" | "groq" | "cerebras" | "ollama";

interface HostedPreset {
  baseURL?: string;
  defaultModel: string;
  keyEnv: string;
}

// OpenAI-compatible hosted providers. Keys come from env; models overridable via
// FEASIBILITY_MODEL. Free tiers (per research): Gemini 2.5 Flash, Groq, Cerebras.
const HOSTED: Record<Exclude<ProviderName, "mock" | "ollama">, HostedPreset> = {
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

export interface LlmFactoryOpts {
  /** Slow the mock provider so the web UI shows believable live progress. */
  mockDelayMs?: number;
  /** Force a provider regardless of env (used rarely, e.g. tests). */
  provider?: ProviderName;
}

export function createLlm(opts: LlmFactoryOpts = {}): LlmProvider {
  const name = opts.provider ?? activeProviderName();
  const model = process.env.FEASIBILITY_MODEL;

  if (name === "mock") return new OpenAIProvider({ mock: true, mockDelayMs: opts.mockDelayMs });
  if (name === "ollama") return new OllamaProvider({ model });

  const preset = HOSTED[name as keyof typeof HOSTED];
  if (!preset) {
    throw new Error(`Unknown FEASIBILITY_PROVIDER "${name}". Use one of: mock, openai, gemini, groq, cerebras, ollama.`);
  }
  const apiKey = process.env[preset.keyEnv];
  if (!apiKey) {
    throw new Error(`Provider "${name}" selected but ${preset.keyEnv} is not set (in .env.local).`);
  }
  return new OpenAIProvider({ apiKey, baseURL: preset.baseURL, model: model ?? preset.defaultModel });
}
