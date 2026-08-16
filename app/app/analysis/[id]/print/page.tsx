"use client";

// Chrome-free print page (browser Save-as-PDF). Reads the persisted analysis
// from Firestore so it works across devices.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Mark } from "@/components/Brand";
import { ReportView } from "@/components/ReportView";
import { subscribeAnalysis } from "@/lib/firebase/analyses";
import type { AnalysisDoc } from "@/lib/analysisTypes";

export default function PrintPage() {
  const params = useParams();
  const id = String(params.id);
  const [rec, setRec] = useState<AnalysisDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = subscribeAnalysis(id, (doc) => { setRec(doc); setLoaded(true); });
    return () => unsub();
  }, [id]);

  if (!loaded) return null;
  if (!rec?.result) return <div className="p-10 text-center text-muted">Report not available.</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2 font-semibold"><Mark className="h-7 w-7" /> FeasibilityAI</div>
        <div className="text-right text-xs text-faint">Feasibility Report<br />{new Date(rec.createdAt).toLocaleDateString()}</div>
      </div>
      <ReportView result={rec.result} print />
      <div className="no-print mt-8 text-center">
        <button onClick={() => window.print()} className="btn btn-primary">Print / Save as PDF</button>
      </div>
    </div>
  );
}
