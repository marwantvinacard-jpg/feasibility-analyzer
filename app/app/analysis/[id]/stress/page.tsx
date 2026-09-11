"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { Mark } from "@/components/Brand";
import { StressReport } from "@/components/StressReport";
import { subscribeAnalysis, subscribeScenarios, saveScenario, deleteScenario } from "@/lib/analyses";
import type { AnalysisDoc, ScenarioDoc } from "@/lib/analysisTypes";
import { baselineKnobs, stressFields, type StressKnobs } from "@/lib/stress";
import type { FullResult } from "@/lib/engine/runFeasibility";
import { money } from "@/lib/ui";
import { useSession } from "@/lib/session";
import { downloadElementPdf, slugify } from "@/lib/pdf";
import { useT } from "@/lib/i18n/LanguageContext";

export default function StressPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const [rec, setRec] = useState<AnalysisDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = subscribeAnalysis(String(id), (d) => { setRec(d); setLoaded(true); });
    return () => unsub();
  }, [id]);

  if (!loaded) return <div className="py-20 text-center text-sm text-muted">{t("common.loading")}</div>;
  if (!rec || rec.status !== "complete" || !rec.result)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h2 className="font-display text-lg font-semibold">{t("stress.nothingToTest")}</h2>
        <p className="mt-1 text-sm text-muted">{t("stress.runFirst")}</p>
        <Button href="/app" variant="ghost" className="mt-5">{t("nav.dashboard")}</Button>
      </div>
    );

  return <Board id={String(id)} result={rec.result} createdAt={rec.createdAt} onBack={() => router.push(`/app/analysis/${id}`)} />;
}

function Board({ id, result, createdAt, onBack }: { id: string; result: FullResult; createdAt: number; onBack: () => void }) {
  const t = useT();
  const cur = result.input.currency ?? "USD";
  const fields = useMemo(() => stressFields(result, t), [result, t]);
  const base = useMemo(() => baselineKnobs(result), [result]);
  const [knobs, setKnobs] = useState<StressKnobs>(base);
  const [downloading, setDownloading] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const dirty = JSON.stringify(knobs) !== JSON.stringify(base);
  const set = (k: keyof StressKnobs, v: number) => setKnobs((p) => ({ ...p, [k]: v }));

  const { user } = useSession();
  const [scenarios, setScenarios] = useState<ScenarioDoc[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const unsub = subscribeScenarios(id, setScenarios);
    return () => unsub();
  }, []);

  async function saveCurrent() {
    const name = window.prompt(t("stress.scenarioNamePrompt"));
    if (!name?.trim()) return;
    setSaving(true);
    try {
      await saveScenario(id, name.trim(), knobs as unknown as Record<string, number>);
    } finally {
      setSaving(false);
    }
  }
  function loadScenario(s: ScenarioDoc) {
    setKnobs({ ...base, ...(s.knobs as unknown as StressKnobs) });
  }
  async function removeScenario(scenarioId: string) {
    await deleteScenario(id, scenarioId);
  }

  const grouped = useMemo(() => {
    const g: Record<string, typeof fields> = {};
    for (const f of fields) (g[f.group] ??= []).push(f);
    return g;
  }, [fields]);

  async function download() {
    if (!exportRef.current) return;
    setDownloading(true);
    try {
      await downloadElementPdf(
        exportRef.current,
        `stress-test-${slugify(result.input.business_idea)}${dirty ? "-adjusted" : ""}.pdf`
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <Icon name="arrow" size={16} className="rotate-180" /> {t("stress.backToReport")}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <button onClick={() => setKnobs(base)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-ink">
              <Icon name="arrow" size={14} className="-scale-x-100" /> {t("stress.reset")}
            </button>
          )}
          <button onClick={saveCurrent} disabled={saving || !user} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-ink">
            <Icon name="doc" size={14} /> {saving ? t("stress.savingScenario") : t("stress.saveScenario")}
          </button>
          <button onClick={download} disabled={downloading} className="btn btn-primary text-sm">
            <Icon name="download" size={16} /> {downloading ? t("stress.preparingPdf") : t("stress.downloadPdf")}
          </button>
        </div>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("stress.pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("stress.pageHint")}
          {dirty ? t("stress.showingAdjusted") : t("stress.atBaseline")}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Knobs */}
        <div className="space-y-4 lg:sticky lg:top-5 lg:self-start">
          {scenarios.length > 0 && (
            <div className="card p-4">
              <div className="label mb-3">{t("stress.savedScenarios")}</div>
              <div className="space-y-1.5">
                {scenarios.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-2 text-sm">
                    <button onClick={() => loadScenario(s)} className="min-w-0 flex-1 truncate text-left hover:text-brand">
                      {s.name}
                      <span className="ml-1.5 text-xs text-faint">{s.createdBy}</span>
                    </button>
                    <button onClick={() => removeScenario(s.id)} className="shrink-0 text-faint hover:text-stop" aria-label={`Delete ${s.name}`}>
                      <Icon name="x" size={13} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                      {moved && <div className="mt-0.5 text-right text-[0.68rem] text-faint">{t("stress.baselineValue", { v: show(bval) })}</div>}
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

      {/* Off-screen export copy — light palette, full width, for the PDF */}
      <div style={{ position: "fixed", left: "-10000px", top: 0 }} aria-hidden>
        <div ref={exportRef} className="pdf-export">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgb(var(--border))", paddingBottom: 12, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <Mark className="h-6 w-6" /> {t("common.appName")}
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "rgb(var(--faint))" }}>
              {t("stress.stressReportTitle")}{dirty ? t("stress.adjustedAssumptions") : ""}<br />
              {new Date(createdAt).toLocaleDateString()}
            </div>
          </div>
          <h1 className="font-display" style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>{result.input.business_idea}</h1>
          <p style={{ fontSize: 13, color: "rgb(var(--muted))", marginBottom: 18 }}>{result.input.location}</p>
          <StressReport result={result} knobs={knobs} print />
        </div>
      </div>
    </div>
  );
}
