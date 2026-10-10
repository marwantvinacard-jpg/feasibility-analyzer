// GET /api/analysis/{id}/pdf — the exported study, rendered on the server.
// The paid export used to be generated in the browser, so the paywall was
// only a hidden button; now the file only exists for someone entitled to it:
// the export was unlocked (paid), or the caller is an admin / export-exempt.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";
import { checkRateLimit } from "@/lib/rateLimit";
import { isExportExempt } from "@/lib/exportAccess";
import { renderReportHtml } from "@/lib/report/renderHtml";
import { renderPdf } from "@/lib/report/pdfRenderer";
import type { FullResult } from "@/lib/engine/runFeasibility";

export const runtime = "nodejs";
export const maxDuration = 120;

const slug = (s: string) =>
  (s || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "report";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await requireUser(req);
    const { id } = await params;
    const db = adminDb();
    const ref = db.collection("analyses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "Analysis not found.");
    const a = snap.data()!;

    // Same access as viewing the report: owner, a member of its org, or an admin.
    let canView = a.uid === caller.uid || caller.admin;
    if (!canView && a.orgId) {
      canView = (await db.collection("organizations").doc(a.orgId).collection("members").doc(caller.uid).get()).exists;
    }
    if (!canView) throw new HttpError(403, "You don't have access to this analysis.");
    if (a.status !== "complete" || !a.result) throw new HttpError(409, "This analysis has no finished report yet.");

    const role = (await db.collection("users").doc(caller.uid).get()).data()?.role as string | undefined;
    const entitled = a.exportUnlocked === true || caller.admin || isExportExempt({ email: caller.email, role });
    if (!entitled) throw new HttpError(402, "Unlock the export for this study to download its PDF.");

    const rl = await checkRateLimit(`pdf:${caller.uid}`, 10, 10 * 60_000);
    if (!rl.allowed) throw new HttpError(429, "Too many downloads — please wait a few minutes.");

    const result = a.result as FullResult;
    const pdf = await renderPdf(renderReportHtml(result, { date: new Date(a.createdAt ?? Date.now()).toISOString().slice(0, 10) }));

    // The first export is recorded (the Terms: the unlock is non-refundable once generated).
    if (!a.firstExportedAt) await ref.update({ firstExportedAt: Date.now() }).catch(() => {});
    await logAudit({ uid: caller.uid, email: caller.email, action: "analysis.exportPdf", target: id }).catch(() => {});

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="feasibility-${slug(result.input?.business_idea ?? "")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    await logError("analysis.pdf", err).catch(() => {});
    return NextResponse.json({ error: "The PDF couldn't be generated. Please try again." }, { status: 500 });
  }
}
