"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Mark } from "@/components/Brand";
import { StressReport } from "@/components/StressReport";
import { subscribeAnalysis } from "@/lib/analyses";
import type { AnalysisDoc } from "@/lib/analysisTypes";
import { baselineKnobs, decodeKnobs } from "@/lib/stress";

export default function StressPrintPage() {
  const { id } = useParams<{ id: string }>();
  const qs = useSearchParams();
  const [rec, setRec] = useState<AnalysisDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = subscribeAnalysis(String(id), (d) => { setRec(d); setLoaded(true); });
    return () => unsub();
  }, [id]);

  const knobs = useMemo(() => {
    if (!rec?.result) return null;
    return decodeKnobs(qs.get("k"), baselineKnobs(rec.result));
  }, [rec, qs]);

  useEffect(() => {
    if (loaded && rec?.result && knobs) {
      const t = setTimeout(() => window.print(), 700);
      return () => clearTimeout(t);
    }
  }, [loaded, rec, knobs]);

  if (!loaded) return null;
  if (!rec?.result || !knobs)
    return <div className="p-10 text-center text-muted">Report not available on this device.</div>;

  const dirty = JSON.stringify(knobs) !== JSON.stringify(baselineKnobs(rec.result));

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2 font-semibold"><Mark className="h-7 w-7" /> FeasibilityAI</div>
        <div className="text-right text-xs text-faint">
          Stress-Test Report{dirty ? " (adjusted assumptions)" : ""}<br />
          {new Date(rec.createdAt).toLocaleDateString()}
        </div>
      </div>
      <h1 className="font-display mb-1 text-xl font-semibold">{rec.result.input.business_idea}</h1>
      <p className="mb-5 text-sm text-muted">{rec.result.input.location}</p>

      <StressReport result={rec.result} knobs={knobs} print />

      <div className="no-print mt-8 text-center">
        <button onClick={() => window.print()} className="btn btn-primary">Print / Save as PDF</button>
      </div>
    </div>
  );
}
