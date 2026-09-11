// POST /api/admin/org — admin-only org actions (approve / reject). A new
// organization can't issue API keys or call the public API until approved —
// mirrors the existing per-user approval gate in /api/admin/user.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const caller = await requireAdmin(req);
    const { orgId, action } = (await req.json()) as { orgId: string; action: "approve" | "reject" };
    if (!orgId || !action) throw new HttpError(400, "orgId and action are required.");

    const ref = adminDb().collection("organizations").doc(orgId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "Organization not found.");

    await ref.update({ status: action === "approve" ? "approved" : "rejected" });
    await logAudit({ uid: caller.uid, email: caller.email, action: `org.${action}`, target: orgId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
