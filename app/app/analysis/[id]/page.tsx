"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { StageProgress } from "@/components/StageProgress";
import { ReportView } from "@/components/ReportView";
import { subscribeAnalysis, reviewAnalysis, getIdToken, checkAnalysis, downloadAnalysisPdf } from "@/lib/analyses";
import { isStale } from "@/lib/runLimits";
import { useSession } from "@/lib/session";
import type { AnalysisDoc } from "@/lib/analysisTypes";
import { SIX_STAGES, type StageName, type StageStatus } from "@/lib/engine/types";
import { useT } from "@/lib/i18n/LanguageContext";
import { isExportExempt, EXPORT_UNLOCK_PRICE_USD } from "@/lib/exportAccess";

const fallbackStages = () =>
  Object.fromEntries(SIX_STAGES.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [dl, setDl] = useState(false);
  const { user } = useSession();
  const t = useT();
  const [reviewing, setReviewing] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  async function unlockExport(analysisId: string) {
    setUnlockError("");
    setUnlocking(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: "unlock_export", analysisId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout.");
      window.location.href = data.url;
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : "Checkout failed.");
      setUnlocking(false);
    }
  }

  async function markReviewed() {
    const notes = window.prompt(t("analysis.notesLabel")) ?? "";
    setReviewing(true);
    try {
      await reviewAnalysis(id, notes);
    } finally {
      setReviewing(false);
    }
  }

  // The PDF is rendered on the server, which also checks the export is
  // unlocked — it used to be built in the browser from a hidden copy of the page.
  async function downloadPdf() {
    setDl(true);
    setUnlockError("");
    try {
      await downloadAnalysisPdf(id);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : "Download failed.");
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

  // A run still "running" past the time limit can't finish (its server was
  // stopped). Ask the server to settle it — failed + refunded — rather than
  // leave the progress bar up forever. Re-checks while the page stays open.
  const runningSince = rec?.status === "running" ? rec.createdAt : null;
  useEffect(() => {
    if (runningSince === null) return;
    const settle = () => { if (isStale(runningSince)) checkAnalysis(id).catch(() => {}); };
    settle();
    const timer = setInterval(settle, 30_000);
    return () => clearInterval(timer);
  }, [id, runningSince]);

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
    return (
      <div className="py-8">
        <StageProgress status={rec.stageStatus ?? fallbackStages()} />
        <p className="mt-4 text-center text-sm text-muted">{t("analysis.runningCanLeave")}</p>
      </div>
    );

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
            {rec.result.study && (rec.uid === user?.uid || user?.role === "admin") && (
              <Button href={`/app/analysis/${id}/edit-model`} variant="ghost" className="text-sm"><Icon name="operational" size={17} /> Edit model</Button>
            )}
            {isExportExempt(user) || rec.exportUnlocked ? (
              <button onClick={downloadPdf} disabled={dl} className="btn btn-ghost text-sm">
                <Icon name="download" size={17} /> {dl ? t("analysis.preparing") : t("analysis.download")}
              </button>
            ) : (
              <button onClick={() => unlockExport(id)} disabled={unlocking} className="btn btn-ghost text-sm text-brand">
                <Icon name="key" size={17} /> {unlocking ? t("analysis.preparing") : `Unlock export — $${EXPORT_UNLOCK_PRICE_USD.toLocaleString()}`}
              </button>
            )}
            <Button href="/app/new" className="text-sm"><Icon name="plus" size={17} /> {t("nav.newAnalysis")}</Button>
          </div>
        </div>
        {unlockError && <p className="no-print text-sm text-stop">{unlockError}</p>}
        {!isExportExempt(user) && !rec.exportUnlocked && (
          <div className="no-print rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm text-ink">
            <span className="font-medium text-brand">This study's export is locked.</span>{" "}
            <span className="text-muted">Pay a one-time ${EXPORT_UNLOCK_PRICE_USD.toLocaleString()} to unlock the PDF download for this analysis. Viewing it here is always free.</span>
          </div>
        )}
        {rec.reviewStatus === "reviewed" && rec.reviewNotes && (
          <div className="no-print rounded-xl border border-go/30 bg-go/8 p-3 text-sm">
            <span className="font-medium text-go">{t("analysis.reviewerNotes")}</span> <span className="text-muted">{rec.reviewNotes}</span>
          </div>
        )}
        {/* A locked study doesn't print (the paid PDF is the export). Only a
            deterrent — anything on screen can still be copied. */}
        <div className={isExportExempt(user) || rec.exportUnlocked ? "" : "print-locked"}>
          <ReportView result={rec.result} analysisId={id} canEditModel={rec.uid === user?.uid || user?.role === "admin"} />
        </div>
        <p className="print-locked-note">{t("analysis.printLocked")}</p>
      </div>
    );

  // "complete" with no result (or an unknown status) used to fall through to
  // "Loading…" forever. Say what happened and offer a way out instead.
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-faint"><Icon name="doc" size={26} /></span>
      <h2 className="font-display mt-4 text-lg font-semibold">{t("analysis.noResult")}</h2>
      <p className="mt-1 text-sm text-muted">{t("analysis.noResultBody")}</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="ghost" href="/app">{t("nav.dashboard")}</Button>
        <Button href="/app/new">{t("analysis.tryAgain")}</Button>
      </div>
    </div>
  );
}
