"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/kit";
import { StageProgress } from "@/components/StageProgress";
import { ReportView } from "@/components/ReportView";
import { streamAnalyze } from "@/lib/sse";
import { getAnalysis, saveAnalysis, type AnalysisRecord } from "@/lib/store";
import { SIX_STAGES, type StageName, type StageStatus } from "@/lib/engine/types";

const initialStatus = () =>
  Object.fromEntries(SIX_STAGES.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [rec, setRec] = useState<AnalysisRecord | null>(null);
  const [status, setStatus] = useState<Record<StageName, StageStatus>>(initialStatus);
  const [phase, setPhase] = useState<"loading" | "running" | "done" | "failed" | "missing">("loading");
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    const r = getAnalysis(id);
    if (!r) {
      setPhase("missing");
      return;
    }
    setRec(r);
    if (r.status === "complete" && r.result) {
      setPhase("done");
    } else if (!started.current) {
      started.current = true;
      run(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function run(r: AnalysisRecord) {
    setPhase("running");
    setStatus(initialStatus());
    saveAnalysis({ ...r, status: "running" });
    streamAnalyze(r.input, {
      onProgress: ({ stage, status: st }) =>
        setStatus((prev) => ({ ...prev, [stage as StageName]: st as StageStatus })),
      onDone: (result) => {
        const done: AnalysisRecord = { ...r, status: "complete", result };
        saveAnalysis(done);
        setRec(done);
        setPhase("done");
      },
      onError: (message) => {
        setError(message);
        saveAnalysis({ ...r, status: "failed" });
        setPhase("failed");
      },
    });
  }

  if (phase === "loading") return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  if (phase === "missing")
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="text-4xl">🔍</div>
        <h2 className="mt-3 text-lg font-semibold">Analysis not found</h2>
        <Button href="/app" variant="ghost" className="mt-5">← Back to dashboard</Button>
      </div>
    );

  if (phase === "running") return <div className="py-8"><StageProgress status={status} /></div>;

  if (phase === "failed")
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="text-4xl">⚠️</div>
        <h2 className="mt-3 text-lg font-semibold">Analysis failed</h2>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="ghost" href="/app">← Dashboard</Button>
          {rec && <Button onClick={() => run(rec)}>Retry</Button>}
        </div>
      </div>
    );

  if (phase === "done" && rec?.result)
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="no-print flex items-center justify-between">
          <button onClick={() => router.push("/app")} className="text-sm text-muted hover:text-ink">← Dashboard</button>
          <div className="flex gap-2">
            <a href={`/app/analysis/${id}/print`} target="_blank" rel="noreferrer" className="btn btn-ghost text-sm">
              ⬇ Download PDF
            </a>
            <Button href="/app/new" className="text-sm">＋ New analysis</Button>
          </div>
        </div>
        <ReportView result={rec.result} />
      </div>
    );

  return null;
}
