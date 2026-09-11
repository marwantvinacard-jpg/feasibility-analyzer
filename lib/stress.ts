// Pure, synchronous recompute of a finished analysis under changed assumptions.
// Everything here is deterministic engine math (no LLM, no network), so the
// stress dashboard can call applyStress() on every keystroke and stay real-time.

import { computeFinancials } from "@/lib/engine/financial";
import { computeCategoryScores, overallAssessment, summarize } from "@/lib/engine/scorer";
import { buildProjections, type Projections } from "@/lib/engine/projections";
import type { FinancialModel } from "@/lib/engine/financialModel";
import type { FullResult } from "@/lib/engine/runFeasibility";
import type {
  CategoryScores,
  FinancialCalculations,
  OverallAssessment,
} from "@/lib/engine/types";

export interface StressKnobs {
  /** Stated monthly revenue / cost — drives the six-dimension financial score. */
  monthlyRevenue: number;
  monthlyCost: number;
  /** Manual what-if overrides for the LLM-derived dimension scores (0-100). */
  market: number;
  technical: number;
  competitive: number;
  location: number;
  /** Financial-model flex, in percent (100 = unchanged). Study only. */
  pricePct: number;
  volumePct: number;
  opexPct: number;
  /** Absolute overrides for two headline model assumptions. Study only. */
  discountRatePct: number;
  growthPct: number;
}

export interface StressField {
  key: keyof StressKnobs;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Formatting hint for the readout. */
  unit: "money" | "pct" | "score";
  group: "Revenue & cost" | "Dimension what-ifs" | "Financial model";
}

export function baselineKnobs(r: FullResult): StressKnobs {
  const a = r.study?.model.assumptions;
  const growth = a?.revenue_growth_percent_by_year ?? [];
  return {
    monthlyRevenue: r.input.monthly_revenue || 0,
    monthlyCost: r.input.monthly_cost || 0,
    market: Math.round(r.categoryScores.market),
    technical: Math.round(r.categoryScores.technical),
    competitive: Math.round(r.categoryScores.competitive),
    location: Math.round(r.categoryScores.location),
    pricePct: 100,
    volumePct: 100,
    opexPct: 100,
    discountRatePct: a?.discount_rate_percent ?? 12,
    growthPct: growth.length ? Math.round(growth.reduce((s, g) => s + g, 0) / growth.length) : 6,
  };
}

/** Slider definitions, ranged around the baseline. Study fields are dropped when absent. */
export function stressFields(r: FullResult): StressField[] {
  const base = baselineKnobs(r);
  const span = (v: number, lo = 0.3, hi = 2.5) => ({
    min: Math.max(0, Math.round((v * lo) / 100) * 100),
    max: Math.max(1000, Math.round((v * hi) / 100) * 100),
  });
  const rev = span(base.monthlyRevenue);
  const cost = span(base.monthlyCost);

  const fields: StressField[] = [
    { key: "monthlyRevenue", label: "Monthly revenue", ...rev, step: 500, unit: "money", group: "Revenue & cost" },
    { key: "monthlyCost", label: "Monthly cost", ...cost, step: 500, unit: "money", group: "Revenue & cost" },
    { key: "market", label: "Market score", min: 0, max: 100, step: 1, unit: "score", group: "Dimension what-ifs" },
    { key: "technical", label: "Technical score", min: 0, max: 100, step: 1, unit: "score", group: "Dimension what-ifs" },
    { key: "competitive", label: "Competitive score", min: 0, max: 100, step: 1, unit: "score", group: "Dimension what-ifs" },
    { key: "location", label: "Location score", min: 0, max: 100, step: 1, unit: "score", group: "Dimension what-ifs" },
  ];

  if (r.study) {
    fields.push(
      { key: "pricePct", label: "Price", min: 50, max: 150, step: 1, unit: "pct", group: "Financial model" },
      { key: "volumePct", label: "Volume", min: 30, max: 200, step: 1, unit: "pct", group: "Financial model" },
      { key: "opexPct", label: "Operating cost", min: 50, max: 180, step: 1, unit: "pct", group: "Financial model" },
      { key: "discountRatePct", label: "Discount rate", min: 0, max: 40, step: 0.5, unit: "pct", group: "Financial model" },
      { key: "growthPct", label: "Revenue growth / yr", min: -20, max: 60, step: 1, unit: "pct", group: "Financial model" },
    );
  }
  return fields;
}

export interface StressOutput {
  financials: FinancialCalculations;
  categoryScores: CategoryScores;
  overall: OverallAssessment;
  summary: ReturnType<typeof summarize>;
  projections: Projections | null;
}

export function applyStress(r: FullResult, k: StressKnobs): StressOutput {
  const input = { ...r.input, monthly_revenue: k.monthlyRevenue, monthly_cost: k.monthlyCost };
  const financials = computeFinancials(input);

  const categoryScores: CategoryScores = {
    market: clampScore(k.market),
    financial: financials.financial_feasibility_score,
    technical: clampScore(k.technical),
    competitive: clampScore(k.competitive),
    location: clampScore(k.location),
    risk: r.categoryScores.risk, // risk rows aren't a numeric knob here
  };
  const overall = overallAssessment(categoryScores);
  const summary = summarize(categoryScores, overall);

  let projections: Projections | null = null;
  if (r.study?.model) {
    const m: FinancialModel = structuredClone(r.study.model);
    m.revenue_streams = m.revenue_streams.map((s) => ({
      ...s,
      price_per_unit: s.price_per_unit * (k.pricePct / 100),
      units_per_month: s.units_per_month * (k.volumePct / 100),
    }));
    m.opex = m.opex.map((o) => ({ ...o, monthly_amount: o.monthly_amount * (k.opexPct / 100) }));
    m.assumptions = {
      ...m.assumptions,
      discount_rate_percent: k.discountRatePct,
      revenue_growth_percent_by_year: m.assumptions.revenue_growth_percent_by_year.map(() => k.growthPct),
    };
    try {
      projections = buildProjections(m, { monthlyCost: k.monthlyCost, monthlyRevenue: k.monthlyRevenue });
    } catch {
      projections = null;
    }
  }

  return { financials, categoryScores, overall, summary, projections };
}

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/* ------------------------------------------------------------------ *
 *  Recommendations — computed suggestions for closing the gap to a
 *  better verdict, plus the AI's own conditions / next steps.
 * ------------------------------------------------------------------ */

export const VERDICT_BANDS = [
  { min: 80, label: "HIGHLY FEASIBLE", rec: "GO" },
  { min: 60, label: "FEASIBLE", rec: "GO (with conditions)" },
  { min: 40, label: "MARGINALLY FEASIBLE", rec: "CONDITIONAL" },
  { min: 0, label: "NOT FEASIBLE", rec: "NO-GO" },
] as const;

const WEIGHTS: Record<"market" | "financial" | "technical" | "competitive" | "location" | "risk", number> = {
  market: 0.25, financial: 0.3, technical: 0.15, competitive: 0.15, location: 0.1, risk: 0.05,
};

export interface Lever {
  label: string;
  detail: string;
  gain: number; // overall points this move would add
}

export interface Recommendations {
  currentScore: number;
  currentVerdict: string;
  targetScore: number | null;   // next band up, or null if already top
  targetVerdict: string | null;
  gap: number;
  /** Ranked, cheapest first. */
  levers: Lever[];
  /** Straight from the AI analysis. */
  conditions: string[];
  nextSteps: string[];
  aiConclusion: string;
}

/** Bisect a single knob to the value that first reaches `target` overall score. */
function solve(
  r: FullResult,
  k: StressKnobs,
  field: "monthlyRevenue" | "monthlyCost",
  target: number
): number | null {
  const at = (v: number) => applyStress(r, { ...k, [field]: v }).overall.overall_score;
  let lo: number, hi: number;
  if (field === "monthlyRevenue") { lo = k.monthlyRevenue; hi = Math.max(k.monthlyRevenue * 6, 10000); }
  else { lo = 0; hi = k.monthlyCost; }
  const reachable = field === "monthlyRevenue" ? at(hi) >= target : at(lo) >= target;
  if (!reachable) return null;
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    const ok = at(mid) >= target;
    if (field === "monthlyRevenue") ok ? (hi = mid) : (lo = mid);
    else ok ? (lo = mid) : (hi = mid);
  }
  return field === "monthlyRevenue" ? hi : lo;
}

export function recommend(
  r: FullResult,
  k: StressKnobs,
  live: StressOutput,
  cur = "USD"
): Recommendations {
  const score = live.overall.overall_score;
  const band = VERDICT_BANDS.find((b) => score >= b.min)!;
  const upper = [...VERDICT_BANDS].reverse().find((b) => b.min > score) ?? null;
  const target = upper ? upper.min : null;
  const gap = target ? target - score : 0;

  const levers: Lever[] = [];
  if (target) {
    // Dimension what-if levers (market / technical / competitive / location).
    (["market", "technical", "competitive", "location"] as const).forEach((d) => {
      const w = WEIGHTS[d];
      const room = 100 - live.categoryScores[d];
      const needPts = Math.ceil(gap / w);
      if (needPts <= room && needPts > 0) {
        levers.push({
          label: `Raise ${d} score`,
          detail: `+${needPts} pts (to ${Math.round(live.categoryScores[d]) + needPts}/100) — weight ${Math.round(w * 100)}%`,
          gain: gap,
        });
      }
    });
    // Financial levers — solved numerically.
    const revNeeded = solve(r, k, "monthlyRevenue", target);
    if (revNeeded && revNeeded > k.monthlyRevenue * 1.001) {
      const up = revNeeded - k.monthlyRevenue;
      levers.push({
        label: "Increase monthly revenue",
        detail: `to ${money(revNeeded, cur)} (+${money(up, cur)}, +${((up / k.monthlyRevenue) * 100).toFixed(0)}%)`,
        gain: gap,
      });
    }
    const costNeeded = solve(r, k, "monthlyCost", target);
    if (costNeeded != null && costNeeded < k.monthlyCost * 0.999) {
      const dn = k.monthlyCost - costNeeded;
      levers.push({
        label: "Cut monthly cost",
        detail: `to ${money(costNeeded, cur)} (−${money(dn, cur)}, −${((dn / k.monthlyCost) * 100).toFixed(0)}%)`,
        gain: gap,
      });
    }
    levers.sort((a, b) => {
      // cheapest-looking first: score levers by relative effort proxy
      const eff = (l: Lever) => (l.label.includes("revenue") ? 2 : l.label.includes("cost") ? 3 : 1);
      return eff(a) - eff(b);
    });
  }

  return {
    currentScore: score,
    currentVerdict: `${band.label} — ${live.overall.recommendation}`,
    targetScore: target,
    targetVerdict: upper ? `${upper.label} — ${upper.rec}` : null,
    gap,
    levers,
    conditions: [
      ...live.summary.conditions,
      ...(r.study?.narrative.conditions ?? []),
    ].filter((v, i, a) => v && a.indexOf(v) === i),
    nextSteps: live.summary.nextSteps,
    aiConclusion: r.study?.narrative.conclusion ?? r.report.conclusion ?? "",
  };
}

const money = (n: number, cur = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
};

/* --- knob (de)serialisation for the printable export --------------- */

export function encodeKnobs(k: StressKnobs): string {
  try { return btoa(JSON.stringify(k)); } catch { return ""; }
}
export function decodeKnobs(s: string | null, fallback: StressKnobs): StressKnobs {
  if (!s) return fallback;
  try { return { ...fallback, ...JSON.parse(atob(s)) }; } catch { return fallback; }
}
