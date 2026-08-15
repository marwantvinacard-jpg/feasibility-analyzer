"use client";

import { Badge } from "@/components/kit";
import { ScoreGauge, ScoreBar } from "@/components/ScoreGauge";
import { Icon } from "@/components/icons";
import { DIMENSION_META, money, scoreTone, toneText, verdictTone, cn, type Tone } from "@/lib/ui";
import type { FullResult } from "@/lib/engine/runFeasibility";
import type { StageName } from "@/lib/engine/types";

const ORDER: StageName[] = ["market", "financial", "technical", "competitive", "location", "risk"];
const VERDICT_ICON = { go: "check", warn: "clock", stop: "x" } as const;

export function ReportView({ result, print = false }: { result: FullResult; print?: boolean }) {
  const { input, overall, categoryScores: cs, financials: f, riskScoring, report } = result;
  const cur = input.currency ?? "USD";
  const vtone = verdictTone(overall.recommendation);

  return (
    <div className={cn("space-y-6", print && "mx-auto max-w-3xl")}>
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
              <Metric label="Monthly profit" value={money(f.monthly_profit, cur)} tone={f.monthly_profit >= 0 ? "go" : "stop"} />
              <Metric label="Margin" value={`${f.profit_margin_percent}%`} />
              <Metric label="Break-even" value={f.break_even_months === null ? "—" : `${f.break_even_months} mo`} />
              <Metric label="Startup capital" value={money(f.startup_capital_needed, cur)} />
            </div>
          </div>
        </div>
      </div>

      {/* Dimension scores */}
      <Section title="Scorecard" subtitle="Weighted across the six dimensions of feasibility">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER.map((s) => (
            <div key={s} className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted">
                  <Icon name={DIMENSION_META[s].icon} size={18} className="text-ink/70" />
                  <span className="text-sm font-medium text-ink">{DIMENSION_META[s].label}</span>
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
      <Section title="Executive summary">
        <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-muted">{report.executive_summary}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <ListCard title="Key findings" items={report.key_findings} tone="brand" icon="spark" />
          <ListCard title="Critical success factors" items={report.critical_success_factors} tone="go" icon="check" />
        </div>
      </Section>

      {/* Financials */}
      <Section title="Financial analysis" subtitle="Computed deterministically from your numbers">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <Row k="Monthly revenue" v={money(f.monthly_revenue, cur)} />
              <Row k="Monthly cost" v={money(f.monthly_cost, cur)} />
              <Row k="Monthly profit" v={money(f.monthly_profit, cur)} tone={f.monthly_profit >= 0 ? "go" : "stop"} />
              <Row k="Profit margin" v={`${f.profit_margin_percent}%`} />
              <Row k="Revenue / cost ratio" v={String(f.revenue_to_cost_ratio)} />
              <Row k="Break-even" v={f.break_even_months === null ? "Never (non-positive profit)" : `${f.break_even_months} months`} />
              <Row k="Startup capital needed" v={money(f.startup_capital_needed, cur)} />
              <Row k="Working capital needed" v={money(f.working_capital_needed, cur)} />
              <Row k="Cash flow" v={f.cash_flow_status} tone={f.cash_flow_status === "Positive" ? "go" : f.cash_flow_status === "Negative" ? "stop" : "warn"} />
            </tbody>
          </table>
        </div>
        {result.stages.financial && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ListCard title="Strengths" items={result.stages.financial.strengths} tone="go" icon="check" />
            <ListCard title="Concerns" items={result.stages.financial.concerns} tone="stop" icon="x" />
          </div>
        )}
      </Section>

      {/* Risk register */}
      <Section title="Risk register" subtitle={`Overall risk ${riskScoring.overallRiskScore}/100 · ${riskScoring.riskLevel}`}>
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
                  <div className="label">priority</div>
                </div>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-muted sm:grid-cols-2">
                <div>
                  <span className="text-faint">Impact</span> <span className="num">{r.impact}%</span> ·{" "}
                  <span className="text-faint">Likelihood</span> <span className="num">{r.probability}%</span>
                </div>
                <div><span className="text-faint">Mitigation:</span> {r.mitigation}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Competitors */}
      {result.stages.competitive && result.stages.competitive.competitive_research.length > 0 && (
        <Section title="Competitive landscape" subtitle={result.stages.competitive.positioning_recommendation.strategic_approach}>
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
      <Section title="Detailed analysis">
        <div className="space-y-3">
          {ORDER.map((s) => (
            <details key={s} className="group rounded-xl border border-border bg-surface-2 p-4" open={print}>
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="flex items-center gap-2.5 font-medium">
                  <Icon name={DIMENSION_META[s].icon} size={18} className="text-muted" /> {DIMENSION_META[s].label}
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

      {/* Recommendation */}
      <Section title="Recommendation & next steps">
        <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-muted">{report.conclusion}</p>
        {result.conditions.length > 0 && (
          <div className="mt-4">
            <ListCard title="Conditions to address first" items={result.conditions} tone="warn" icon="clock" />
          </div>
        )}
        <div className="mt-4">
          <ListCard title="Next steps" items={result.nextSteps} tone="brand" icon="arrow" numbered />
        </div>
      </Section>

      {/* Sources */}
      {result.sources.length > 0 && (
        <Section title="Sources">
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

      <p className="pt-2 text-center text-xs text-faint">
        Generated by FeasibilityAI{result.usage.mock ? " · demo data" : ""} · Decision aid, not a guarantee.
      </p>
    </div>
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
