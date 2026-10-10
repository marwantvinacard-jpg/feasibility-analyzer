// Providers a customer can bring their own key for. Shared by the browser
// (Settings) and the server (lib/byok.ts) — no server-only imports here.
// Keys must match the hosted presets in lib/engine/factory.ts.

export const BYOK_PROVIDER_LABELS = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  groq: "Groq",
  cerebras: "Cerebras",
} as const;

export type ByokProvider = keyof typeof BYOK_PROVIDER_LABELS;
