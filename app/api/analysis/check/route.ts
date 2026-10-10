// POST /api/analysis/check — { id }. Called by the report page when an analysis
// has been "running" for longer than any run can live: settles it as failed and
// refunds the credit (once — see lib/runLifecycle.ts), so the user isn't left
// watching a progress bar that will never finish.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { failRun, INTERRUPTED_MESSAGE, isStale } from "@/lib/runLifecycle";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
    if (typeof id !== "string" || !id) throw new HttpError(400, "id is required.");

    const db = adminDb();
    const snap = await db.collection("analyses").doc(id).get();
    if (!snap.exists) throw new HttpError(404, "Analysis not found.");
    const d = snap.data()!;
    if (d.uid !== caller.uid && !caller.admin) throw new HttpError(403, "Not your analysis.");

    // The server's clock decides, not the browser's.
    const settled = d.status === "running" && isStale(d.createdAt) ? await failRun(db, id, INTERRUPTED_MESSAGE) : false;
    return NextResponse.json({ settled });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
