"use client";

// Clean, chrome-free page for the browser's print-to-PDF (zero-dependency PDF
// for the concept build). At the Firebase step this same ReportView renders
// server-side via Puppeteer for emailed/stored PDFs.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Mark } from "@/components/Brand";
import { ReportView } from "@/components/ReportView";
import { getAnalysis, type AnalysisRecord } from "@/lib/store";

export default function PrintPage() {
  const params = useParams();
  const id = String(params.id);
  const [rec, setRec] = useState<AnalysisRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const r = getAnalysis(id);
    setRec(r ?? null);
    setReady(true);
  }, [id]);

  if (!ready) return null;
  if (!rec?.result) return <div className="p-10 text-center text-muted">Report not available.</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2 font-semibold">
          <Mark className="h-7 w-7" /> FeasibilityAI
        </div>
        <div className="text-right text-xs text-faint">
          Feasibility Report<br />
          {new Date(rec.createdAt).toLocaleDateString()}
        </div>
      </div>
      <ReportView result={rec.result} print />
      <div className="no-print mt-8 text-center">
        <button onClick={() => window.print()} className="btn btn-primary">Print / Save as PDF</button>
      </div>
    </div>
  );
}
