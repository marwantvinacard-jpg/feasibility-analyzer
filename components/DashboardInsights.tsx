"use client";

// Portfolio-level analytics for the dashboard: a score trend across every
// completed study, a verdict mix, and a dimension breakdown for the most
// recent one. Pure SVG — no charting library — so it stays lightweight and
// never disagrees with the numbers already computed by the engine.

import { DIMENSION_META, cn, scoreTone, toneStroke, verdictTone, money, type Tone } from "@/lib/ui";
import type { AnalysisDoc } from "@/lib/analysisTypes";
import type { CategoryScores } from "@/lib/engine/types";
import { Icon } from "@/components/icons";

export function DashboardInsights({ items }: { items: AnalysisDoc[] }) {
  const completed = items.filter((a) => a.status === "complete" && a.result);
  if (completed.length === 0) return null;

  const scores = completed.map((a) => a.result!.overall.overall_score);
  const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  const verdictCounts = { go: 0, warn: 0, stop: 0 } as Record<Tone, number>;
  for (const a of completed) verdictCounts[verdictTone(a.result!.overall.recommendation)]++;

  const capitalFigures = completed
    .map((a) => a.result!.study?.projections.funding.total)
    .filter((n): n is number => typeof n === "number" && n > 0);

  const latest = completed[0]; // list is newest-first
  const trend = [...completed].reverse().slice(-12); // oldest -> newest, last 12

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card p-5 lg:col-span-3">
        <div className="flex items-center justify-between">
          <h3 className="label">Score trend</h3>
          <span className="text-xs text-faint">
            Avg <span className="num font-semibold text-ink">{avgScore}</span>/100 across {completed.length} {completed.length === 1 ? "study" : "studies"}
          </span>
        </div>
        <ScoreTrend items={trend} />
      </div>

      <div className="card p-5 lg:col-span-2">
        <h3 className="label">Verdict mix</h3>
        <VerdictBar counts={verdictCounts} total={completed.length} />
        {capitalFigures.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="label">Capital modeled</div>
            <div className="num mt-1 text-lg font-semibold">
              {money(capitalFigures.reduce((s, v) => s + v, 0))}
            </div>
            <div className="mt-0.5 text-xs text-faint">across {capitalFigures.length} full financial studies</div>
          </div>
        )}
      </div>

      {latest.result && (
        <div className="card p-5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h3 className="label">Latest study — dimension breakdown</h3>
            <span className="truncate text-xs text-faint">{latest.input.business_idea || "Untitled analysis"}</span>
          </div>
          <DimensionBreakdown scores={latest.result.categoryScores} />
        </div>
      )}
    </div>
  );
}

function ScoreTrend({ items }: { items: AnalysisDoc[] }) {
  const w = 100 / Math.max(items.length, 1);
  return (
    <div className="mt-4 flex h-28 items-end gap-1.5 sm:gap-2">
      {items.map((a) => {
        const score = a.result!.overall.overall_score;
        const tone = scoreTone(score);
        return (
          <div
            key={a.id}
            className="group relative flex-1 rounded-t-md transition-opacity hover:opacity-80"
            style={{ height: `${Math.max(4, score)}%`, background: toneStroke[tone], minWidth: 6 }}
            title={`${a.input.business_idea || "Untitled"} — ${score}/100`}
          >
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white group-hover:block">
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VerdictBar({ counts, total }: { counts: Record<Tone, number>; total: number }) {
  const segs: { tone: Tone; label: string }[] = [
    { tone: "go", label: "Go" },
    { tone: "warn", label: "Conditional" },
    { tone: "stop", label: "No-go" },
  ];
  return (
    <div className="mt-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
        {segs.map(({ tone }) =>
          counts[tone] > 0 ? (
            <div key={tone} style={{ width: `${(counts[tone] / total) * 100}%`, background: toneStroke[tone] }} />
          ) : null
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {segs.map(({ tone, label }) => (
          <span key={tone} className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: toneStroke[tone] }} />
            {label} <span className="num font-semibold text-ink">{counts[tone]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function DimensionBreakdown({ scores }: { scores: CategoryScores }) {
  const keys = Object.keys(DIMENSION_META) as (keyof CategoryScores)[];
  return (
    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
      {keys.map((k) => {
        const score = scores[k];
        const tone = scoreTone(score);
        const meta = DIMENSION_META[k];
        return (
          <div key={k} className="flex items-center gap-3">
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2")}>
              <Icon name={meta.icon} size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-medium text-ink">{meta.label}</span>
                <span className="num ml-2 font-semibold" style={{ color: toneStroke[tone] }}>{score}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, score)}%`, background: toneStroke[tone] }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
