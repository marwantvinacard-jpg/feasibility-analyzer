"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { StageProgress } from "@/components/StageProgress";
import { ReportView } from "@/components/ReportView";
import { Mark } from "@/components/Brand";
import { downloadElementPdf, slugify } from "@/lib/pdf";
import { subscribeAnalysis, reviewAnalysis } from "@/lib/analyses";
import { useSession } from "@/lib/session";
import type { AnalysisDoc } from "@/lib/analysisTypes";
import { SIX_STAGES, type StageName, type StageStatus } from "@/lib/engine/types";
import { useT } from "@/lib/i18n/LanguageContext";

const fallbackStages = () =>
  Object.fromEntries(SIX_STAGES.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const exportRef = useRef<HTMLDivElement>(null);
  const [dl, setDl] = useState(false);
  const { user } = useSession();
  const t = useT();
  const [reviewing, setReviewing] = useState(false);

  async function markReviewed() {
    const notes = window.prompt(t("analysis.notesLabel")) ?? "";
    setReviewing(true);
    try {
      await reviewAnalysis(id, notes);
    } finally {
      setReviewing(false);
    }
  }

  async function downloadPdf(idea: string) {
    if (!exportRef.current) return;
    setDl(true);
    try {
      await downloadElementPdf(exportRef.current, `feasibility-${slugify(idea)}.pdf`);
    } finally {
      setDl(false);
    }
  }

  const [rec, setRec] = useState<AnalysisDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = subscribeAnalysis(id, (doc) => {
      setRec(doc);
      setLoaded(true);
    });
    return () => unsub();
  }, [id]);

  if (!loaded) return <div className="py-20 text-center text-sm text-muted">{t("common.loading")}</div>;

  if (!rec)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-faint"><Icon name="search" size={26} /></span>
        <h2 className="font-display mt-4 text-lg font-semibold">{t("analysis.notFound")}</h2>
        <Button href="/app" variant="ghost" className="mt-5">{t("analysis.backToDashboard")}</Button>
      </div>
    );

  if (rec.status === "running")
    return <div className="py-8"><StageProgress status={rec.stageStatus ?? fallbackStages()} /></div>;

  if (rec.status === "failed")
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-stop/12 text-stop"><Icon name="x" size={26} strokeWidth={2} /></span>
        <h2 className="font-display mt-4 text-lg font-semibold">{t("analysis.failed")}</h2>
        <p className="mt-1 text-sm text-muted">{rec.error ?? t("analysis.genericError")}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="ghost" href="/app">{t("nav.dashboard")}</Button>
          <Button href="/app/new">{t("analysis.tryAgain")}</Button>
        </div>
      </div>
    );

  if (rec.status === "complete" && rec.result)
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="no-print flex items-center justify-between">
          <button onClick={() => router.push("/app")} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <Icon name="arrow" size={16} className="rotate-180" /> {t("nav.dashboard")}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {rec.reviewStatus === "reviewed" ? (
              <Badge tone="go"><Icon name="check" size={13} strokeWidth={2.5} /> {t("analysis.reviewedBy", { email: rec.reviewedBy ?? "" })}</Badge>
            ) : (
              <Badge tone="warn">{t("analysis.unreviewed")}</Badge>
            )}
            {user?.role === "admin" && rec.reviewStatus !== "reviewed" && (
              <button onClick={markReviewed} disabled={reviewing} className="btn btn-ghost text-sm">
                {reviewing ? t("analysis.saving") : t("analysis.markReviewed")}
              </button>
            )}
            <Button href={`/app/analysis/${id}/stress`} variant="ghost" className="text-sm"><Icon name="sliders" size={17} /> {t("analysis.stressTest")}</Button>
            <button onClick={() => downloadPdf(rec.result!.input.business_idea)} disabled={dl} className="btn btn-ghost text-sm">
              <Icon name="download" size={17} /> {dl ? t("analysis.preparing") : t("analysis.download")}
            </button>
            <Button href="/app/new" className="text-sm"><Icon name="plus" size={17} /> {t("nav.newAnalysis")}</Button>
          </div>
        </div>
        {rec.reviewStatus === "reviewed" && rec.reviewNotes && (
          <div className="no-print rounded-xl border border-go/30 bg-go/8 p-3 text-sm">
            <span className="font-medium text-go">{t("analysis.reviewerNotes")}</span> <span className="text-muted">{rec.reviewNotes}</span>
          </div>
        )}
        <ReportView result={rec.result} />

        {/* Off-screen export copy for the PDF (light palette, fixed width) */}
        <div style={{ position: "fixed", left: "-10000px", top: 0 }} aria-hidden>
          <div ref={exportRef} className="pdf-export">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgb(var(--border))", paddingBottom: 12, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}><Mark className="h-6 w-6" /> FeasibilityAI</div>
              <div style={{ textAlign: "right", fontSize: 11, color: "rgb(var(--faint))" }}>
                {t("common.appName")}<br />{new Date(rec.createdAt).toLocaleDateString()}
              </div>
            </div>
            <ReportView result={rec.result} print />
          </div>
        </div>
      </div>
    );

  return <div className="py-20 text-center text-sm text-muted">{t("common.loading")}</div>;
}
