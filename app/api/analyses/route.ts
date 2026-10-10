// GET /api/analyses?scope=mine|org — the analyses list for the dashboard and
// Benchmarks, as slim summaries (see AnalysisSummary). Clients used to
// live-subscribe to every full analysis doc — whole reports, studies and
// uploaded text — which for a busy org meant hundreds of MB per page load.
// The Admin SDK's field selection sends back only what the list screens show.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logError } from "@/lib/firebase/errorLog";
import { ANALYSIS_SUMMARY_FIELDS, type AnalysisSummary } from "@/lib/analysisTypes";
import { sweepStaleRuns } from "@/lib/runLifecycle";

export const runtime = "nodejs";

/** Most recent analyses returned per request. Summaries are ~1 KB each. */
const MAX_ITEMS = 1000;

export async function GET(req: Request) {
  try {
    const caller = await requireUser(req);
    const scope = new URL(req.url).searchParams.get("scope") === "org" ? "org" : "mine";
    const db = adminDb();

    // Opening the dashboard also settles this user's runs whose server died
    // mid-run (failed + refunded), so nothing sits at "running" forever.
    if (scope === "mine") await sweepStaleRuns(db, { uid: caller.uid }).catch((e) => logError("analyses.sweep", e));

    let field: "uid" | "orgId" = "uid";
    let value = caller.uid;
    if (scope === "org") {
      const orgId = (await db.collection("users").doc(caller.uid).get()).data()?.orgId as string | undefined;
      if (!orgId) return NextResponse.json({ items: [], truncated: false });
      // Same check as the firestore.rules read rule: must actually be a member.
      const member = await db.collection("organizations").doc(orgId).collection("members").doc(caller.uid).get();
      if (!member.exists) throw new HttpError(403, "You're not a member of this organization.");
      field = "orgId";
      value = orgId;
    }

    const base = db.collection("analyses").where(field, "==", value);
    let snap;
    try {
      snap = await base.orderBy("createdAt", "desc").limit(MAX_ITEMS).select(...ANALYSIS_SUMMARY_FIELDS).get();
    } catch (err) {
      // Needs the composite index in firestore.indexes.json. Until it's deployed,
      // fall back to an unordered read (still slim) instead of breaking the page.
      if ((err as { code?: number }).code !== 9) throw err; // 9 = FAILED_PRECONDITION (missing index)
      logError("analyses.list.missingIndex", err, { field }).catch(() => {});
      snap = await base.limit(MAX_ITEMS).select(...ANALYSIS_SUMMARY_FIELDS).get();
    }

    const items = snap.docs
      .map((d) => ({ ...d.data(), id: d.id }) as AnalysisSummary)
      .sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ items, truncated: snap.size === MAX_ITEMS });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    logError("analyses.list", err).catch(() => {});
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
