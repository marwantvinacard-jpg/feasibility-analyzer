"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { StageProgress } from "@/components/StageProgress";
import { ReportView } from "@/components/ReportView";
import { subscribeAnalysis } from "@/lib/firebase/analyses";
import type { AnalysisDoc } from "@/lib/analysisTypes";
import { SIX_STAGES, type StageName, type StageStatus } from "@/lib/engine/types";

const fallbackStages = () =>
  Object.fromEntries(SIX_STAGES.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [rec, setRec] = useState<AnalysisDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = subscribeAnalysis(id, (doc) => {
      setRec(doc);
      setLoaded(true);
    });
    return () => unsub();
  }, [id]);

  if (!loaded) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  if (!rec)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-faint"><Icon name="search" size={26} /></span>
        <h2 className="font-display mt-4 text-lg font-semibold">Analysis not found</h2>
        <Button href="/app" variant="ghost" className="mt-5">Back to dashboard</Button>
      </div>
    );

  if (rec.status === "running")
    return <div className="py-8"><StageProgress status={rec.stageStatus ?? fallbackStages()} /></div>;

  if (rec.status === "failed")
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-stop/12 text-stop"><Icon name="x" size={26} strokeWidth={2} /></span>
        <h2 className="font-display mt-4 text-lg font-semibold">Analysis failed</h2>
        <p className="mt-1 text-sm text-muted">{rec.error ?? "Something went wrong."}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="ghost" href="/app">Dashboard</Button>
          <Button href="/app/new">Try again</Button>
        </div>
      </div>
    );

  if (rec.status === "complete" && rec.result)
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="no-print flex items-center justify-between">
          <button onClick={() => router.push("/app")} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <Icon name="arrow" size={16} className="rotate-180" /> Dashboard
          </button>
          <div className="flex gap-2">
            <a href={`/app/analysis/${id}/print`} target="_blank" rel="noreferrer" className="btn btn-ghost text-sm"><Icon name="download" size={17} /> Download PDF</a>
            <Button href="/app/new" className="text-sm"><Icon name="plus" size={17} /> New analysis</Button>
          </div>
        </div>
        <ReportView result={rec.result} />
      </div>
    );

  return <div className="py-20 text-center text-sm text-muted">Loading…</div>;
}
