// Small presentation helpers shared across the UI.

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Semantic tone for a 0-100 score: GO (emerald) / conditional (amber) / stop (rose). */
export type Tone = "go" | "warn" | "stop";

export function scoreTone(score: number): Tone {
  if (score >= 70) return "go";
  if (score >= 45) return "warn";
  return "stop";
}

export const toneText: Record<Tone, string> = {
  go: "text-go",
  warn: "text-warn",
  stop: "text-stop",
};
export const toneBg: Record<Tone, string> = {
  go: "bg-go",
  warn: "bg-warn",
  stop: "bg-stop",
};
export const toneSoft: Record<Tone, string> = {
  go: "bg-go/10 text-go border-go/25",
  warn: "bg-warn/10 text-warn border-warn/25",
  stop: "bg-stop/10 text-stop border-stop/25",
};
export const toneStroke: Record<Tone, string> = {
  go: "rgb(var(--go))",
  warn: "rgb(var(--warn))",
  stop: "rgb(var(--stop))",
};

/** Verdict tone from the overall recommendation string. */
export function verdictTone(recommendation: string): Tone {
  if (recommendation.startsWith("GO (with")) return "warn";
  if (recommendation.startsWith("GO")) return "go";
  if (recommendation.startsWith("CONDITIONAL")) return "warn";
  return "stop";
}

export function money(n: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

import type { IconName } from "@/components/icons";

export const DIMENSION_META: Record<
  string,
  { label: string; blurb: string; icon: IconName }
> = {
  market: { label: "Market", blurb: "Size, demand & timing", icon: "market" },
  financial: { label: "Financial", blurb: "Profit, margin & break-even", icon: "financial" },
  technical: { label: "Technical", blurb: "Execution & scalability", icon: "technical" },
  competitive: { label: "Competitive", blurb: "Rivals & differentiation", icon: "competitive" },
  location: { label: "Location & Legal", blurb: "Place, economy & rules", icon: "location" },
  risk: { label: "Risk", blurb: "What could go wrong", icon: "risk" },
};
