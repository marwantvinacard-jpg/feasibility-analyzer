"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { StressReport } from "@/components/StressReport";
import { subscribeAnalysis } from "@/lib/analyses";
import type { AnalysisDoc } from "@/lib/analysisTypes";
import { baselineKnobs, stressFields, encodeKnobs, type StressKnobs } from "@/lib/stress";
import type { FullResult } from "@/lib/engine/runFeasibility";
import { money } from "@/lib/ui";

export default function StressPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rec, setRec] = useState<AnalysisDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = subscribeAnalysis(String(id), (d) => { setRec(d); setLoaded(true); });
    return () => unsub();
  }, [id]);

  if (!loaded) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;
  if (!rec || rec.status !== "complete" || !rec.result)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h2 className="font-display text-lg font-semibold">Nothing to stress-test yet</h2>
        <p className="mt-1 text-sm text-muted">Run an analysis to completion first.</p>
        <Button href="/app" variant="ghost" className="mt-5">Dashboard</Button>
      </div>
    );

  return <Board result={rec.result} id={String(id)} onBack={() => router.push(`/app/analysis/${id}`)} />;
}

function Board({ result, id, onBack }: { result: FullResult; id: string; onBack: () => void }) {
  const cur = result.input.currency ?? "USD";
  const fields = useMemo(() => stressFields(result), [result]);
  const base = useMemo(() => baselineKnobs(result), [result]);
  const [knobs, setKnobs] = useState<StressKnobs>(base);

  const dirty = JSON.stringify(knobs) !== JSON.stringify(base);
  const set = (k: keyof StressKnobs, v: number) => setKnobs((p) => ({ ...p, [k]: v }));

  const grouped = useMemo(() => {
    const g: Record<string, typeof fields> = {};
    for (const f of fields) (g[f.group] ??= []).push(f);
    return g;
  }, [fields]);

  const exportPdf = () =>
    window.open(`/app/analysis/${id}/stress/print?k=${encodeURIComponent(encodeKnobs(knobs))}`, "_blank");

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <Icon name="arrow" size={16} className="rotate-180" /> Back to report
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <button onClick={() => setKnobs(base)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-ink">
              <Icon name="arrow" size={14} className="-scale-x-100" /> Reset
            </button>
          )}
          <button onClick={exportPdf} className="btn btn-primary text-sm">
            <Icon name="download" size={16} /> Export full PDF
          </button>
        </div>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Stress test</h1>
        <p className="mt-1 text-sm text-muted">
          Drag any assumption — scores, financials, predictions, risk and recommendations recompute instantly.
          {dirty ? " Showing adjusted figures." : " Currently at baseline."}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Knobs */}
        <div className="space-y-4 lg:sticky lg:top-5 lg:self-start">
          {Object.entries(grouped).map(([group, gfields]) => (
            <div key={group} className="card p-4">
              <div className="label mb-3">{group}</div>
              <div className="space-y-4">
                {gfields.map((f) => {
                  const val = knobs[f.key];
                  const bval = base[f.key];
                  const moved = Math.abs(val - bval) > 1e-9;
                  const show = (v: number) =>
                    f.unit === "money" ? money(v, cur) : f.unit === "pct" ? `${v % 1 === 0 ? v : v.toFixed(1)}%` : String(Math.round(v));
                  return (
                    <div key={f.key}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted">
                          {f.label}
                          {moved && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                        </span>
                        <span className="num font-semibold">{show(val)}</span>
                      </div>
                      <input
                        type="range"
                        min={f.min} max={f.max} step={f.step} value={val}
                        onChange={(e) => set(f.key, Number(e.target.value))}
                        className="mt-1.5 w-full accent-brand"
                      />
                      {moved && <div className="mt-0.5 text-right text-[0.68rem] text-faint">baseline {show(bval)}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Live report */}
        <StressReport result={result} knobs={knobs} />
      </div>
    </div>
  );
}
