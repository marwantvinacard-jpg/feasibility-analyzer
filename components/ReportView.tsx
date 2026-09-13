"use client";

import { useState } from "react";
import { Badge } from "@/components/kit";
import { ScoreGauge, ScoreBar } from "@/components/ScoreGauge";
import { Icon } from "@/components/icons";
import { FinancialStudyView } from "@/components/FinancialStudy";
import { SensitivityPanel } from "@/components/SensitivityPanel";
import { money, scoreTone, toneText, verdictTone, cn, type Tone } from "@/lib/ui";
import type { FullResult } from "@/lib/engine/runFeasibility";
import type { StageName } from "@/lib/engine/types";
import { useT } from "@/lib/i18n/LanguageContext";

const ORDER: StageName[] = ["market", "financial", "technical", "competitive", "location", "operational", "legal", "risk"];
const VERDICT_ICON = { go: "check", warn: "clock", stop: "x" } as const;

export function ReportView({
  result,
  print = false,
  analysisId,
  canEditModel = false,
}: {
  result: FullResult;
  print?: boolean;
  analysisId?: string;
  canEditModel?: boolean;
}) {
  const t = useT();
  const { input, overall, categoryScores: cs, financials: f, riskScoring, report } = result;
  const cur = input.currency ?? "USD";
  const vtone = verdictTone(overall.recommendation);

  // Analyses created before the financial study existed have no `study`, so the
  // tabs only appear when there is a second view to switch to. Printing renders
  // both stacked — a PDF has no tabs.
  const [tab, setTab] = useState<"feasibility" | "study">("feasibility");
  const study = result.study;
  const showFeasibility = print || !study || tab === "feasibility";
  const showStudy = study && (print || tab === "study");

  return (
    <div className={cn("space-y-6", print && "mx-auto max-w-3xl")}>
      {result.usage.mock && (
        <div className="no-print flex items-center gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          <Icon name="risk" size={16} strokeWidth={2} className="shrink-0" />
          <span>
            <strong>{t("report.mockBannerTitle")}</strong> {t("report.mockBannerBody")}
          </span>
        </div>
      )}
      {/* Verdict hero */}
      <div className="card overflow-hidden p-0">
        <div className="bg-paper-glow flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
          <ScoreGauge score={overall.overall_score} size={176} sublabel={overall.rating} />
          <div className="flex-1 text-center sm:text-left">
            <Badge tone={vtone} className="mb-2.5">
              <Icon name={VERDICT_ICON[vtone]} size={13} strokeWidth={2.5} /> {overall.recommendation}
            </Badge>
            <h1 className="font-display text-2xl font-semibold leading-snug tracking-tight sm:text-[1.7rem]">
              {input.business_idea}
            </h1>
            <p className="mt-1.5 text-sm text-muted">{input.target_customer} · {input.location}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label={t("report.monthlyProfit")} value={money(f.monthly_profit, cur)} tone={f.monthly_profit >= 0 ? "go" : "stop"} />
              <Metric label={t("report.margin")} value={`${f.profit_margin_percent}%`} />
              <Metric label={t("report.breakEven")} value={f.break_even_months === null ? "—" : `${f.break_even_months} mo`} />
              <Metric label={t("report.startupCapital")} value={money(f.startup_capital_needed, cur)} />
            </div>
          </div>
        </div>
      </div>

      {!print && study && (
        <div className="no-print flex gap-1 rounded-xl border border-border bg-surface-2 p-1">
          <TabButton active={tab === "feasibility"} onClick={() => setTab("feasibility")} icon="spark">
            {t("report.tabFeasibility")}
          </TabButton>
          <TabButton active={tab === "study"} onClick={() => setTab("study")} icon="financial">
            {t("report.tabStudy")}
          </TabButton>
        </div>
      )}

      {showFeasibility && (
        <>
      {/* Dimension scores */}
      <Section title={t("report.scorecard")} subtitle={t("report.scorecardSubtitle")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER.map((s) => (
            <div key={s} className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted">
                  <Icon name={dimIcon(s)} size={18} className="text-ink/70" />
                  <span className="text-sm font-medium text-ink">{t(`dim.${s}`)}</span>
                </div>
                <span className={cn("num text-lg font-semibold", toneText[scoreTone(cs[s])])}>{cs[s]}</span>
              </div>
              <div className="mt-3">
                <ScoreBar score={cs[s]} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Executive summary */}
      <Section title={t("report.execSummary")}>
        <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-muted">{report.executive_summary}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <ListCard title={t("report.keyFindings")} items={report.key_findings} tone="brand" icon="spark" />
          <ListCard title={t("report.criticalSuccessFactors")} items={report.critical_success_factors} tone="go" icon="check" />
        </div>
      </Section>

      {/* Financials */}
      <Section title={t("report.financialAnalysis")} subtitle={t("report.financialAnalysisSubtitle")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <Row k={t("report.monthlyRevenue")} v={money(f.monthly_revenue, cur)} />
              <Row k={t("report.monthlyCost")} v={money(f.monthly_cost, cur)} />
              <Row k={t("report.monthlyProfit")} v={money(f.monthly_profit, cur)} tone={f.monthly_profit >= 0 ? "go" : "stop"} />
              <Row k={t("report.profitMargin")} v={`${f.profit_margin_percent}%`} />
              <Row k={t("report.revenueCostRatio")} v={String(f.revenue_to_cost_ratio)} />
              <Row k={t("report.breakEven")} v={f.break_even_months === null ? t("report.neverBreakEven") : t("report.months", { n: f.break_even_months })} />
              <Row k={t("report.startupCapitalNeeded")} v={money(f.startup_capital_needed, cur)} />
              <Row k={t("report.workingCapitalNeeded")} v={money(f.working_capital_needed, cur)} />
              <Row k={t("report.cashFlow")} v={f.cash_flow_status} tone={f.cash_flow_status === "Positive" ? "go" : f.cash_flow_status === "Negative" ? "stop" : "warn"} />
            </tbody>
          </table>
        </div>
        {result.stages.financial && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ListCard title={t("report.strengths")} items={result.stages.financial.strengths} tone="go" icon="check" />
            <ListCard title={t("report.concerns")} items={result.stages.financial.concerns} tone="stop" icon="x" />
          </div>
        )}
      </Section>

      {/* Sensitivity — automatic, no manual stress-test session required */}
      {!print && <SensitivityPanel input={input} analysisId={analysisId} />}

      {/* Risk register */}
      <Section title={t("report.riskRegister")} subtitle={t("report.riskRegisterSubtitle", { score: riskScoring.overallRiskScore, level: riskScoring.riskLevel })}>
        <div className="space-y-2">
          {riskScoring.rankedRisks.slice(0, 8).map((r, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface-2 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge className="mb-1.5">{r.category}</Badge>
                  <div className="text-sm font-medium">{r.description}</div>
                </div>
                <div className="text-right">
                  <div className={cn("num text-base font-semibold", toneText[scoreTone(100 - (r.priority ?? 0))])}>{r.priority}</div>
                  <div className="label">{t("report.priority")}</div>
                </div>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-muted sm:grid-cols-2">
                <div>
                  <span className="text-faint">{t("report.impact")}</span> <span className="num">{r.impact}%</span> ·{" "}
                  <span className="text-faint">{t("report.likelihood")}</span> <span className="num">{r.probability}%</span>
                </div>
                <div><span className="text-faint">{t("report.mitigation")}</span> {r.mitigation}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Competitors */}
      {result.stages.competitive && result.stages.competitive.competitive_research.length > 0 && (
        <Section title={t("report.competitiveLandscape")} subtitle={result.stages.competitive.positioning_recommendation.strategic_approach}>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.stages.competitive.competitive_research.map((c, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface-2 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{c.competitor_name}</div>
                  <span className="text-xs text-faint">{c.pricing}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{c.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Dimension narratives */}
      <Section title={t("report.detailedAnalysis")}>
        <div className="space-y-3">
          {ORDER.map((s) => (
            <details key={s} className="group rounded-xl border border-border bg-surface-2 p-4" open={print}>
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="flex items-center gap-2.5 font-medium">
                  <Icon name={dimIcon(s)} size={18} className="text-muted" /> {t(`dim.${s}`)}
                </span>
                <span className="flex items-center gap-2">
                  <span className={cn("num text-sm font-semibold", toneText[scoreTone(cs[s])])}>{cs[s]}/100</span>
                  <Icon name="chevron" size={16} className="text-faint transition group-open:rotate-180" />
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{report.dimension_narratives[s]}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Stakeholders */}
      {result.stages.stakeholders && (
        <Section title={t("report.stakeholderAnalysis")} subtitle={result.stages.stakeholders.summary}>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.stages.stakeholders.stakeholders.map((sh, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface-2 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{sh.group}</div>
                  <div className="flex gap-1.5">
                    <Badge tone={sh.influence === "High" ? "warn" : "go"}>{t("report.influence")}: {sh.influence}</Badge>
                    <Badge tone={sh.impact === "High" ? "warn" : "go"}>{t("report.impactLabel")}: {sh.impact}</Badge>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted">{sh.interest}</p>
                <p className="mt-1.5 text-xs"><span className="text-faint">{t("report.engagement")}</span> {sh.engagement_strategy}</p>
              </div>
            ))}
          </div>
          {result.stages.stakeholders.key_concerns.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-faint">{t("report.keyConcerns")}</div>
              <ul className="mt-1.5 space-y-1 text-sm text-muted">
                {result.stages.stakeholders.key_concerns.map((c, i) => (
                  <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warn" />{c}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Recommendation */}
      <Section title={t("report.recommendation")}>
        <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-muted">{report.conclusion}</p>
        {result.conditions.length > 0 && (
          <div className="mt-4">
            <ListCard title={t("report.conditionsToAddress")} items={result.conditions} tone="warn" icon="clock" />
          </div>
        )}
        <div className="mt-4">
          <ListCard title={t("report.nextSteps")} items={result.nextSteps} tone="brand" icon="arrow" numbered />
        </div>
      </Section>

      {/* Sources */}
      {result.sources.length > 0 && (
        <Section title={t("report.sources")}>
          <ul className="space-y-1.5 text-sm">
            {result.sources.slice(0, 12).map((s, i) => (
              <li key={i} className="flex items-center gap-2 truncate">
                <Icon name="search" size={13} className="shrink-0 text-faint" />
                <a href={s.url} target="_blank" rel="noreferrer" className="truncate text-brand hover:underline">
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
        </>
      )}

      {showStudy && (
        <>
          {print && (
            <div className="pt-2">
              <h2 className="font-display text-2xl font-semibold tracking-tight">{t("report.financialStudyTitle")}</h2>
              <p className="mt-0.5 text-sm text-muted">
                {t("report.fifteenSection", { years: study!.projections.projectionYears, currency: study!.projections.currency })}
              </p>
            </div>
          )}
          <FinancialStudyView study={study!} input={input} print={print} analysisId={analysisId} canEditModel={canEditModel} />
        </>
      )}

      <p className="pt-2 text-center text-xs text-faint">
        {t("report.footer", { app: t("common.appName"), mock: result.usage.mock ? t("report.demoDataSuffix") : "" })}
      </p>
    </div>
  );
}

function dimIcon(s: StageName) {
  const map: Record<StageName, React.ComponentProps<typeof Icon>["name"]> = {
    market: "market", financial: "financial", technical: "technical", competitive: "competitive",
    location: "location", operational: "operational", legal: "legal", risk: "risk",
  };
  return map[s];
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentProps<typeof Icon>["name"];
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition",
        active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
      )}
    >
      <Icon name={icon} size={16} className={active ? "text-brand" : "text-faint"} />
      {children}
    </button>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "go" | "stop" }) {
  return (
    <div className="rounded-xl bg-surface/70 p-3 text-center sm:text-left">
      <div className={cn("num text-lg font-semibold", tone === "go" ? "text-go" : tone === "stop" ? "text-stop" : "text-ink")}>{value}</div>
      <div className="mt-0.5 text-[0.7rem] text-faint">{label}</div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "go" | "stop" | "warn" }) {
  return (
    <tr>
      <td className="py-2.5 text-muted">{k}</td>
      <td className={cn("num py-2.5 text-right font-semibold", tone === "go" ? "text-go" : tone === "stop" ? "text-stop" : tone === "warn" ? "text-warn" : "")}>{v}</td>
    </tr>
  );
}

function ListCard({
  title,
  items,
  tone,
  icon,
  numbered,
}: {
  title: string;
  items: string[];
  tone: Tone | "brand";
  icon: React.ComponentProps<typeof Icon>["name"];
  numbered?: boolean;
}) {
  const dot =
    tone === "go" ? "text-go" : tone === "stop" ? "text-stop" : tone === "warn" ? "text-warn" : "text-brand";
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="label mb-2.5 flex items-center gap-1.5">
        <Icon name={icon} size={13} className={dot} /> {title}
      </div>
      <ul className="space-y-1.5 text-sm text-muted">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className={cn("num shrink-0 font-semibold", dot)}>{numbered ? `${i + 1}` : "·"}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
