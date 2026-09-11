// Monte Carlo simulation over the financial model — turns the deterministic
// "base case" into a probability distribution, which is what real due
// diligence actually asks for ("what's the chance IRR clears our hurdle?")
// rather than a single point estimate. Pure code, reuses buildProjections()
// under random price/volume/opex/growth draws.

import { buildProjections } from "./projections";
import type { FinancialModel } from "./financialModel";

export interface MonteCarloInput {
  /** Relative std-dev applied to each driver, e.g. 0.12 = ±12% typical swing. */
  priceVol?: number;
  volumeVol?: number;
  opexVol?: number;
  growthVolPts?: number; // absolute percentage-point std-dev on growth/yr
  iterations?: number;
  seed?: number;
}

export interface MonteCarloResult {
  iterations: number;
  npv: Percentiles;
  irr: Percentiles; // null draws excluded
  year1Ebitda: Percentiles;
  paybackMonths: Percentiles; // null (never) draws excluded
  probabilityPositiveNpv: number;
  probabilityBreakEvenWithin24Months: number;
  probabilityIrrAboveHurdle: (hurdlePercent: number) => number;
  samples: { npv: number; irr: number | null }[]; // capped, for a scatter/histogram
}

export interface Percentiles {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
}

/** Deterministic PRNG (mulberry32) so results are reproducible for a given seed. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Standard normal via Box-Muller, using the given uniform generator. */
function gaussian(next: () => number): number {
  const u1 = Math.max(next(), 1e-9);
  const u2 = next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
const clampPct = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function percentiles(vals: number[]): Percentiles {
  if (vals.length === 0) return { p10: 0, p50: 0, p90: 0, mean: 0 };
  const s = [...vals].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
  return { p10: at(0.1), p50: at(0.5), p90: at(0.9), mean: s.reduce((a, b) => a + b, 0) / s.length };
}

export function runMonteCarlo(
  model: FinancialModel,
  stated: { monthlyCost: number; monthlyRevenue: number },
  opts: MonteCarloInput = {}
): MonteCarloResult {
  const {
    priceVol = 0.1,
    volumeVol = 0.15,
    opexVol = 0.08,
    growthVolPts = 4,
    iterations = 300,
    seed = 42,
  } = opts;
  const next = rng(seed);

  const npvs: number[] = [];
  const irrs: (number | null)[] = [];
  const y1: number[] = [];
  const paybacks: (number | null)[] = [];
  const samples: { npv: number; irr: number | null }[] = [];

  for (let i = 0; i < iterations; i++) {
    const priceMult = clampPct(1 + gaussian(next) * priceVol, 0.4, 1.8);
    const volumeMult = clampPct(1 + gaussian(next) * volumeVol, 0.2, 2.2);
    const opexMult = clampPct(1 + gaussian(next) * opexVol, 0.6, 1.6);
    const growthDelta = gaussian(next) * growthVolPts;

    const m: FinancialModel = structuredClone(model);
    m.revenue_streams = m.revenue_streams.map((s) => ({
      ...s,
      price_per_unit: s.price_per_unit * priceMult,
      units_per_month: s.units_per_month * volumeMult,
    }));
    m.opex = m.opex.map((o) => ({ ...o, monthly_amount: o.monthly_amount * opexMult }));
    m.assumptions = {
      ...m.assumptions,
      revenue_growth_percent_by_year: m.assumptions.revenue_growth_percent_by_year.map((g) =>
        clampPct(g + growthDelta, -50, 200)
      ),
    };

    try {
      const p = buildProjections(m, stated);
      npvs.push(p.returns.npv);
      irrs.push(p.returns.irrPercent);
      y1.push(p.annual[0]?.ebitda ?? 0);
      paybacks.push(p.returns.paybackMonths);
      if (samples.length < 200) samples.push({ npv: p.returns.npv, irr: p.returns.irrPercent });
    } catch {
      // a degenerate draw (e.g. divide-by-zero in an edge case) — skip it
    }
  }

  const validIrrs = irrs.filter((v): v is number => v !== null);
  const validPaybacks = paybacks.filter((v): v is number => v !== null);

  return {
    iterations: npvs.length,
    npv: percentiles(npvs),
    irr: percentiles(validIrrs),
    year1Ebitda: percentiles(y1),
    paybackMonths: percentiles(validPaybacks),
    probabilityPositiveNpv: npvs.length ? npvs.filter((v) => v > 0).length / npvs.length : 0,
    probabilityBreakEvenWithin24Months: paybacks.length
      ? paybacks.filter((v) => v !== null && v <= 24).length / paybacks.length
      : 0,
    probabilityIrrAboveHurdle: (hurdle: number) =>
      validIrrs.length ? validIrrs.filter((v) => v >= hurdle).length / validIrrs.length : 0,
    samples,
  };
}
