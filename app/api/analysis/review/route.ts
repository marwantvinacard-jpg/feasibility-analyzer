// POST /api/analysis/review — an admin marks an analysis reviewed, with notes.
// The gap between "an AI produced this" and "a person is willing to stand
// behind this" is exactly what makes a feasibility study fundable.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const caller = await requireAdmin(req);
    const { id, notes } = (await req.json()) as { id: string; notes?: string };
    if (!id) throw new HttpError(400, "id required.");

    const ref = adminDb().collection("analyses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "Analysis not found.");

    await ref.update({
      reviewStatus: "reviewed",
      reviewedBy: caller.email ?? caller.uid,
      reviewedAt: Date.now(),
      reviewNotes: notes ?? "",
    });
    await logAudit({ uid: caller.uid, email: caller.email, action: "analysis.review", target: id, meta: { notes } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
