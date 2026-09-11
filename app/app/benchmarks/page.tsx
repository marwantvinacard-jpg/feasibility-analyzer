"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { fetchMyOrg } from "@/lib/org";
import { subscribeOrgAnalyses } from "@/lib/analyses";
import type { Organization } from "@/lib/orgTypes";
import type { AnalysisDoc } from "@/lib/analysisTypes";
import { DIMENSION_META, money, scoreTone, toneStroke } from "@/lib/ui";
import { VERTICALS } from "@/lib/engine/verticals";
import type { CategoryScores } from "@/lib/engine/types";

const VERTICAL_LABEL: Record<string, string> = Object.fromEntries(VERTICALS.map((v) => [v.key, v.label]));
VERTICAL_LABEL[""] = "General / not specified";

export default function BenchmarksPage() {
  const { user } = useSession();
  const [org, setOrg] = useState<Organization | null>(null);
  const [items, setItems] = useState<AnalysisDoc[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMyOrg()
      .then((d) => setOrg(d.org))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!org) return;
    const unsub = subscribeOrgAnalyses(org.id, setItems);
    return () => unsub();
  }, [org]);

  const completed = useMemo(() => items.filter((a) => a.status === "complete" && a.result), [items]);

  const byVertical = useMemo(() => {
    const groups: Record<string, AnalysisDoc[]> = {};
    for (const a of completed) {
      const key = a.input.business_type ?? "";
      (groups[key] ??= []).push(a);
    }
    return groups;
  }, [completed]);

  const avgDims = useMemo(() => {
    if (completed.length === 0) return null;
    const sums = {} as Record<keyof CategoryScores, number>;
    const keys = Object.keys(DIMENSION_META) as (keyof CategoryScores)[];
    for (const k of keys) sums[k] = 0;
    for (const a of completed) for (const k of keys) sums[k] += a.result!.categoryScores[k];
    const avg = {} as Record<keyof CategoryScores, number>;
    for (const k of keys) avg[k] = Math.round(sums[k] / completed.length);
    return avg;
  }, [completed]);

  if (!user || !loaded) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  if (!org) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Icon name="chart" size={26} /></span>
        <h2 className="font-display mt-4 text-lg font-semibold">No organization yet</h2>
        <p className="mt-1 text-sm text-muted">Benchmarks are computed across your team's studies — create an organization first.</p>
      </div>
    );
  }

  if (completed.length === 0) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-faint"><Icon name="chart" size={26} /></span>
        <h2 className="font-display mt-4 text-lg font-semibold">Not enough data yet</h2>
        <p className="mt-1 text-sm text-muted">Benchmarks build up as your team completes studies — come back after a few.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Benchmarks</h1>
        <p className="mt-1.5 text-sm text-muted">
          Computed from your own organization's {completed.length} completed {completed.length === 1 ? "study" : "studies"} —
          not external industry data. This becomes more useful the more you run.
        </p>
      </div>

      {avgDims && (
        <div className="card p-5">
          <div className="label mb-3">Average score by dimension, across all your studies</div>
          <div className="space-y-3">
            {(Object.keys(DIMENSION_META) as (keyof CategoryScores)[]).map((k) => {
              const v = avgDims[k];
              const tone = scoreTone(v);
              return (
                <div key={k}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted">
                      <Icon name={DIMENSION_META[k].icon} size={13} /> {DIMENSION_META[k].label}
                    </span>
                    <span className="num font-semibold" style={{ color: toneStroke[tone] }}>{v}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, v)}%`, background: toneStroke[tone] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="label mb-3">By industry</h2>
        <div className="space-y-3">
          {Object.entries(byVertical).map(([key, group]) => {
            const avgScore = Math.round(group.reduce((s, a) => s + a.result!.overall.overall_score, 0) / group.length);
            const capexFigures = group
              .map((a) => a.result!.study?.projections.capexTotal)
              .filter((n): n is number => typeof n === "number" && n > 0);
            const avgCapex = capexFigures.length ? capexFigures.reduce((s, v) => s + v, 0) / capexFigures.length : null;
            const currency = group[0].input.currency ?? "USD";
            return (
              <div key={key} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{VERTICAL_LABEL[key] ?? key}</div>
                  <Badge>{group.length} {group.length === 1 ? "study" : "studies"}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-[0.7rem] text-faint">Avg. feasibility score</div>
                    <div className="num text-lg font-semibold" style={{ color: toneStroke[scoreTone(avgScore)] }}>{avgScore}</div>
                  </div>
                  {avgCapex !== null && (
                    <div>
                      <div className="text-[0.7rem] text-faint">Avg. CapEx</div>
                      <div className="num text-lg font-semibold">{money(avgCapex, currency)}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
