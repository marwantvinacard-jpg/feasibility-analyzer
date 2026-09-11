// POST /api/analysis/delete — owner (or admin) deletes an analysis. Clients
// can't delete directly (security rules), so this verifies ownership server-side.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { id } = (await req.json()) as { id: string };
    if (!id) throw new HttpError(400, "id required.");

    const ref = adminDb().collection("analyses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: true });
    if (snap.data()?.uid !== caller.uid && !caller.admin) throw new HttpError(403, "Not your analysis.");

    await ref.delete();
    await logAudit({ uid: caller.uid, email: caller.email, action: "analysis.delete", target: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
