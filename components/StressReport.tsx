"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { ScoreGauge, ScoreBar } from "@/components/ScoreGauge";
import { applyStress, recommend, baselineKnobs, type StressKnobs, type StressOutput } from "@/lib/stress";
import { runMonteCarlo, type MonteCarloResult } from "@/lib/engine/montecarlo";
import type { FullResult } from "@/lib/engine/runFeasibility";
import { DIMENSION_META, money, verdictTone, toneText, cn } from "@/lib/ui";
import { useT } from "@/lib/i18n/LanguageContext";

const DIMS = ["market", "financial", "technical", "competitive", "location", "operational", "legal", "risk"] as const;

export function StressReport({
  result,
  knobs,
  print = false,
}: {
  result: FullResult;
  knobs: StressKnobs;
  print?: boolean;
}) {
  const t = useT();
  const cur = result.input.currency ?? "USD";
  const live = useMemo(() => applyStress(result, knobs), [result, knobs]);
  const recs = useMemo(() => recommend(result, knobs, live, cur), [result, knobs, live, cur]);
  const base = useMemo(() => baselineKnobs(result), [result]);
  const dirty = JSON.stringify(knobs) !== JSON.stringify(base);

  const baseline: StressOutput = useMemo(
    () => ({
      financials: result.financials,
      categoryScores: result.categoryScores,
      overall: result.overall,
      summary: {
        criticalIssues: result.criticalIssues,
        strengths: result.strengths,
        conditions: result.conditions,
        nextSteps: result.nextSteps,
      },
      projections: result.study?.projections ?? null,
    }),
    [result]
  );

  const vtone = verdictTone(live.overall.recommendation);
  const P = live.projections;
  const BP = baseline.projections;

  return (
    <div className={cn("space-y-5", print && "print-report")}>
      {/* ---- Verdict ---- */}
      <section className="card flex flex-wrap items-center gap-6 p-6">
        <ScoreGauge score={live.overall.overall_score} sublabel={live.overall.rating} />
        <div className="min-w-[12rem] flex-1">
          <div className="label">{t("stress.recommendation")}{dirty ? t("stress.adjusted") : ""}</div>
          <div className={cn("mt-1 font-display text-xl font-semibold", toneText[vtone])}>
            {live.overall.recommendation}
          </div>
          <div className="mt-3 text-sm">
            <Delta cur={live.overall.overall_score} base={baseline.overall.overall_score} goodWhenUp suffix=" pts" />
            <span className="ml-1.5 text-xs text-faint">{t("stress.vsBaseline", { score: baseline.overall.overall_score })}</span>
          </div>
        </div>
      </section>

      {/* ---- Scorecard ---- */}
      <section className="card p-5">
        <div className="label mb-3">{t("stress.scorecard")}</div>
        <div className="space-y-3">
          {DIMS.map((d) => {
            const c = live.categoryScores[d];
            const b = Math.round(baseline.categoryScores[d]);
            return (
              <div key={d}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted">
                    <Icon name={DIMENSION_META[d].icon} size={13} /> {t(`dim.${d}`)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Delta cur={c} base={b} goodWhenUp small />
                    <span className="num w-7 text-right font-semibold">{Math.round(c)}</span>
                  </span>
                </div>
                <ScoreBar score={c} />
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Financials ---- */}
      <section className="card p-5">
        <div className="label mb-3">{t("stress.financialsTitle")}</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Metric label={t("stress.monthlyProfit")} cur={live.financials.monthly_profit} base={baseline.financials.monthly_profit} kind="money" cur3={cur} goodWhenUp />
          <Metric label={t("stress.profitMargin")} cur={live.financials.profit_margin_percent} base={baseline.financials.profit_margin_percent} kind="pct" goodWhenUp />
          <Metric label={t("stress.breakEven")} cur={live.financials.break_even_months ?? Infinity} base={baseline.financials.break_even_months ?? Infinity} kind="months" goodWhenUp={false} />
          <Metric label={t("stress.revCostRatio")} cur={live.financials.revenue_to_cost_ratio} base={baseline.financials.revenue_to_cost_ratio} kind="ratio" goodWhenUp />
          <Metric label={t("stress.annualProfit")} cur={live.financials.annual_profit} base={baseline.financials.annual_profit} kind="money" cur3={cur} goodWhenUp />
          <Metric label={t("stress.startupCapital")} cur={live.financials.startup_capital_needed} base={baseline.financials.startup_capital_needed} kind="money" cur3={cur} goodWhenUp={false} />
        </div>
      </section>

      {/* ---- Predictions (financial study) ---- */}
      {P && BP && (
        <section className="card p-5">
          <div className="label mb-3">{t("stress.predictionsTitle", { years: P.projectionYears })}</div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Metric label={t("stress.npv")} cur={P.returns.npv} base={BP.returns.npv} kind="money" cur3={cur} goodWhenUp />
            <Metric label={t("stress.irr")} cur={P.returns.irrPercent ?? 0} base={BP.returns.irrPercent ?? 0} kind="pct" goodWhenUp />
            <Metric label={t("stress.roi")} cur={P.returns.roiPercent} base={BP.returns.roiPercent} kind="pct" goodWhenUp />
            <Metric label={t("stress.payback")} cur={P.returns.paybackMonths ?? Infinity} base={BP.returns.paybackMonths ?? Infinity} kind="months" goodWhenUp={false} />
            <Metric label={t("stress.fundingNeed")} cur={P.funding.total} base={BP.funding.total} kind="money" cur3={cur} goodWhenUp={false} />
            <Metric label={t("stress.minCashBalance")} cur={P.funding.minimumCashBalance} base={BP.funding.minimumCashBalance} kind="money" cur3={cur} goodWhenUp />
          </div>

          <div className="mt-5">
            <div className="mb-1 text-xs text-faint">{t("stress.cashBalanceHorizon")}</div>
            <CashCurve live={P.monthly.map((m) => m.cashBalance)} base={BP.monthly.map((m) => m.cashBalance)} cur={cur} />
          </div>

          <div className="mt-5 overflow-x-auto">
            <div className="mb-2 text-xs text-faint">{t("stress.annualPl")}</div>
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="pb-2 font-medium">{t("stress.year")}</th>
                  <th className="pb-2 font-medium">{t("stress.revenue")}</th>
                  <th className="pb-2 font-medium">{t("stress.ebitda")}</th>
                  <th className="pb-2 font-medium">{t("stress.netProfit")}</th>
                  <th className="pb-2 font-medium">{t("stress.netMargin")}</th>
                </tr>
              </thead>
              <tbody>
                {P.annual.map((y) => (
                  <tr key={y.year} className="border-t border-border/60">
                    <td className="py-2 font-medium">Y{y.year}</td>
                    <td className="num py-2">{money(y.revenue, cur)}</td>
                    <td className="num py-2">{money(y.ebitda, cur)}</td>
                    <td className={cn("num py-2", y.netProfit < 0 && "text-stop")}>{money(y.netProfit, cur)}</td>
                    <td className="num py-2">{y.netMarginPercent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="overflow-x-auto">
              <div className="mb-2 text-xs text-faint">{t("stress.scenarios")}</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-faint">
                    <th className="pb-2 font-medium">{t("stress.case")}</th><th className="pb-2 font-medium">{t("stress.y1Ebitda")}</th>
                    <th className="pb-2 font-medium">{t("stress.payback")}</th><th className="pb-2 font-medium">{t("stress.npv")}</th>
                  </tr>
                </thead>
                <tbody>
                  {P.scenarios.map((s) => (
                    <tr key={s.name} className="border-t border-border/60">
                      <td className="py-2 font-medium">{s.name}</td>
                      <td className="num py-2">{money(s.year1Ebitda, cur)}</td>
                      <td className="num py-2">{s.paybackMonth ? t("study.monthsShort", { n: s.paybackMonth }) : "—"}</td>
                      <td className="num py-2">{money(s.npv, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <div className="mb-2 text-xs text-faint">{t("stress.oneWaySensitivity")}</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-faint">
                    <th className="pb-2 font-medium">{t("stress.variable")}</th><th className="pb-2 font-medium">{t("stress.change")}</th>
                    <th className="pb-2 font-medium">{t("stress.y1Ebitda")}</th><th className="pb-2 font-medium">{t("stress.npv")}</th>
                  </tr>
                </thead>
                <tbody>
                  {P.sensitivity.map((s, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="py-2">{s.variable}</td>
                      <td className="num py-2">{s.change}</td>
                      <td className="num py-2">{money(s.year1Ebitda, cur)}</td>
                      <td className="num py-2">{money(s.npv, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ---- Probability simulation ---- */}
      {result.study?.model && <MonteCarloPanel model={result.study.model} knobs={knobs} cur={cur} />}

      {/* ---- Risk assessment ---- */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="label">{t("stress.riskAssessment")}</span>
          <Badge tone={result.riskScoring.riskLevel === "Low" ? "go" : result.riskScoring.riskLevel === "Medium" ? "warn" : "stop"}>
            {t("stress.riskLevel", { level: result.riskScoring.riskLevel, score: result.riskScoring.overallRiskScore })}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="pb-2 font-medium">{t("stress.risk")}</th><th className="pb-2 font-medium">{t("stress.impact")}</th>
                <th className="pb-2 font-medium">{t("stress.prob")}</th><th className="pb-2 font-medium">{t("stress.priority")}</th>
                <th className="pb-2 font-medium">{t("stress.mitigation")}</th>
              </tr>
            </thead>
            <tbody>
              {result.riskScoring.rankedRisks.slice(0, 8).map((r, i) => (
                <tr key={i} className="border-t border-border/60 align-top">
                  <td className="py-2 pr-3">{r.description}</td>
                  <td className="num py-2">{r.impact}</td>
                  <td className="num py-2">{r.probability}</td>
                  <td className="num py-2 font-semibold">{r.priority ?? Math.round((r.impact * r.probability) / 100)}</td>
                  <td className="py-2 text-muted">{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.study?.narrative.financial_risks?.length ? (
          <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
            <div className="text-xs text-faint">{t("stress.financialRisks")}</div>
            {result.study.narrative.financial_risks.map((fr, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{fr.category}:</span> <span className="text-muted">{fr.risk}</span>
                <span className="text-faint">{t("stress.mitigationInline", { m: fr.mitigation })}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* ---- Efficient recommendations ---- */}
      <section className="card p-5">
        <div className="label mb-3">{t("stress.efficientRecs")}</div>

        {recs.targetScore ? (
          <div className="rounded-xl bg-surface-2 p-4">
            <div className="text-sm">
              {t("stress.atScoreBelow", { score: recs.currentScore, gap: recs.gap, verdict: recs.targetVerdict ?? "" })}
            </div>
            {recs.levers.length ? (
              <ul className="mt-3 space-y-2">
                {recs.levers.map((l, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <span><span className="font-medium">{l.label}</span> — <span className="text-muted">{l.detail}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("stress.noSingleLever")}</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-go/10 p-4 text-sm text-go">
            {t("stress.alreadyTop")}
          </div>
        )}

        {recs.conditions.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-faint">{t("stress.conditionsForGo")}</div>
            <ul className="mt-1.5 space-y-1.5 text-sm text-muted">
              {recs.conditions.map((c, i) => (
                <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warn" />{c}</li>
              ))}
            </ul>
          </div>
        )}

        {recs.nextSteps.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-faint">{t("stress.recommendedNextSteps")}</div>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-muted">
              {recs.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        )}
      </section>

      {/* ---- AI analysis (static context) ---- */}
      <section className="card p-5">
        <div className="label mb-3">{t("stress.aiAnalysis")}</div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{result.report.executive_summary}</p>

        {result.report.key_findings?.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-faint">{t("stress.keyFindings")}</div>
            <ul className="mt-1.5 space-y-1.5 text-sm text-muted">
              {result.report.key_findings.map((f, i) => (
                <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DIMS.map((d) => (
            <div key={d} className="rounded-xl bg-surface-2 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Icon name={DIMENSION_META[d].icon} size={13} /> {t(`dim.${d}`)}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{result.report.dimension_narratives[d]}</p>
            </div>
          ))}
        </div>

        {result.report.conclusion && (
          <p className="mt-4 whitespace-pre-line border-t border-border/60 pt-4 text-sm leading-relaxed text-muted">
            {result.report.conclusion}
          </p>
        )}
      </section>
    </div>
  );
}

function MonteCarloPanel({
  model,
  knobs,
  cur,
}: {
  model: NonNullable<import("@/lib/engine/runFeasibility").FullResult["study"]>["model"];
  knobs: StressKnobs;
  cur: string;
}) {
  const t = useT();
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    // yield to paint the "Running…" state before the (synchronous) simulation
    setTimeout(() => {
      const flexed = structuredClone(model);
      flexed.revenue_streams = flexed.revenue_streams.map((s) => ({
        ...s,
        price_per_unit: s.price_per_unit * (knobs.pricePct / 100),
        units_per_month: s.units_per_month * (knobs.volumePct / 100),
      }));
      flexed.opex = flexed.opex.map((o) => ({ ...o, monthly_amount: o.monthly_amount * (knobs.opexPct / 100) }));
      flexed.assumptions = {
        ...flexed.assumptions,
        discount_rate_percent: knobs.discountRatePct,
        revenue_growth_percent_by_year: flexed.assumptions.revenue_growth_percent_by_year.map(() => knobs.growthPct),
      };
      setResult(runMonteCarlo(flexed, { monthlyCost: knobs.monthlyCost, monthlyRevenue: knobs.monthlyRevenue }));
      setRunning(false);
    }, 10);
  }

  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="label">{t("stress.probSimTitle")}</div>
          <p className="mt-1 text-xs text-muted">{t("stress.probSimBody")}</p>
        </div>
        <button onClick={run} disabled={running} className="btn btn-ghost shrink-0 text-sm">
          {running ? t("stress.simulating") : result ? t("stress.rerun") : t("stress.runSimulation")}
        </button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ProbStat label={t("stress.pNpvPositive")} value={`${Math.round(result.probabilityPositiveNpv * 100)}%`} good={result.probabilityPositiveNpv >= 0.6} />
            <ProbStat label={t("stress.pBreakEven24")} value={`${Math.round(result.probabilityBreakEvenWithin24Months * 100)}%`} good={result.probabilityBreakEvenWithin24Months >= 0.6} />
            <ProbStat label={t("stress.pIrr15")} value={`${Math.round(result.probabilityIrrAboveHurdle(15) * 100)}%`} good={result.probabilityIrrAboveHurdle(15) >= 0.6} />
            <ProbStat label={t("stress.simulations")} value={String(result.iterations)} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <RangeCard label={t("stress.npv")} p={result.npv} fmt={(v) => money(v, cur)} />
            <RangeCard label={t("stress.irr")} p={result.irr} fmt={(v) => `${v.toFixed(1)}%`} />
            <RangeCard label={t("stress.payback")} p={result.paybackMonths} fmt={(v) => t("study.monthsShort", { n: Math.round(v) })} />
          </div>

          <div className="mt-4">
            <div className="mb-1 text-xs text-faint">{t("stress.npvDistribution")}</div>
            <ScatterStrip samples={result.samples} />
          </div>
        </>
      )}
    </section>
  );
}

function ProbStat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-[0.68rem] text-faint">{label}</div>
      <div className={cn("num mt-0.5 text-lg font-semibold", good === undefined ? "" : good ? "text-go" : "text-warn")}>{value}</div>
    </div>
  );
}

function RangeCard({ label, p, fmt }: { label: string; p: { p10: number; p50: number; p90: number }; fmt: (v: number) => string }) {
  const t = useT();
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-[0.68rem] text-faint">{t("stress.p10p50p90", { label })}</div>
      <div className="num mt-1 flex items-baseline gap-2">
        <span className="text-xs text-muted">{fmt(p.p10)}</span>
        <span className="text-base font-semibold">{fmt(p.p50)}</span>
        <span className="text-xs text-muted">{fmt(p.p90)}</span>
      </div>
    </div>
  );
}

function ScatterStrip({ samples }: { samples: { npv: number; irr: number | null }[] }) {
  if (!samples.length) return null;
  const vals = samples.map((s) => s.npv);
  const min = Math.min(...vals, 0), max = Math.max(...vals, 0);
  const W = 640, H = 46;
  const x = (v: number) => ((v - min) / (max - min || 1)) * W;
  const zeroX = x(0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full min-w-[420px]">
      <line x1={zeroX} x2={zeroX} y1={0} y2={H} stroke="rgb(var(--stop))" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
      {samples.map((s, i) => (
        <circle key={i} cx={x(s.npv)} cy={H / 2 + (((i * 37) % 20) - 10)} r={2.2} fill={s.npv >= 0 ? "rgb(var(--go))" : "rgb(var(--stop))"} opacity={0.55} />
      ))}
    </svg>
  );
}

/* ---------- helpers ---------- */

function Delta({ cur, base, goodWhenUp, suffix = "", small = false }: {
  cur: number; base: number; goodWhenUp: boolean; suffix?: string; small?: boolean;
}) {
  const d = cur - base;
  if (!isFinite(d) || Math.abs(d) < 1e-9)
    return <span className={cn("text-faint", small ? "text-[0.68rem]" : "text-xs")}>±0{suffix}</span>;
  const good = goodWhenUp ? d > 0 : d < 0;
  const mag = Math.abs(d) >= 1000 ? Math.round(Math.abs(d)).toLocaleString() : trimNum(Math.abs(d));
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold", small ? "text-[0.68rem]" : "text-xs", good ? "text-go" : "text-stop")}>
      {d > 0 ? "▲" : "▼"} {mag}{suffix}
    </span>
  );
}
const trimNum = (n: number) => (n % 1 === 0 ? n : Number(n.toFixed(2))).toString();

function Metric({ label, cur, base, kind, cur3 = "USD", goodWhenUp }: {
  label: string; cur: number; base: number;
  kind: "money" | "pct" | "months" | "ratio"; cur3?: string; goodWhenUp: boolean;
}) {
  const fmt = (v: number) => {
    if (!isFinite(v)) return "—";
    if (kind === "money") return money(v, cur3);
    if (kind === "pct") return `${v % 1 === 0 ? v : v.toFixed(1)}%`;
    if (kind === "months") return `${Math.round(v)} mo`;
    return v.toFixed(2);
  };
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-[0.7rem] text-faint">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold">{fmt(cur)}</div>
      <div className="mt-0.5"><Delta cur={cur} base={base} goodWhenUp={goodWhenUp} small /></div>
    </div>
  );
}

function CashCurve({ live, base, cur }: { live: number[]; base: number[]; cur: string }) {
  const t = useT();
  const all = [...live, ...base, 0];
  const min = Math.min(...all), max = Math.max(...all);
  const W = 640, H = 130, n = Math.max(live.length, base.length, 2);
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full min-w-[520px]">
        {min < 0 && max > 0 && (
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgb(var(--stop))" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
        )}
        <path d={path(base)} fill="none" stroke="rgb(var(--border))" strokeWidth={2} />
        <path d={path(live)} fill="none" stroke="rgb(var(--brand))" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex gap-4 text-[0.7rem] text-faint">
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-brand" /> {t("stress.adjustedLegend")}</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-border" /> {t("stress.baselineLegend")}</span>
        <span className="ml-auto">{t("stress.lowPoint", { v: money(Math.min(...live), cur) })}</span>
      </div>
    </div>
  );
}
