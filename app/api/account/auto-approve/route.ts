// POST /api/account/auto-approve — self-serve approval once a signup has
// verified their email. Removes the "every account needs a human admin to
// click approve" bottleneck for the common case, while keeping a pending
// state as a real gate: an unverified email, or an account an admin has
// already rejected, still can't get in this way. Admins can still manually
// approve/reject anyone regardless (see /api/admin/user).

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { sendApprovalEmail } from "@/lib/email";

export const runtime = "nodejs";

const APPROVAL_CREDITS = 3;

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    if (!caller.emailVerified) throw new HttpError(403, "Verify your email first.");

    const ref = adminDb().collection("users").doc(caller.uid);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "Account not found.");
    const data = snap.data()!;
    if (data.status !== "pending") {
      // Already approved/rejected — nothing to do, not an error (the client
      // may call this speculatively every time it sees a pending status).
      return NextResponse.json({ ok: true, status: data.status });
    }

    const current = (data.credits as number) ?? 0;
    await ref.set(
      { status: "approved", credits: current > 0 ? current : APPROVAL_CREDITS, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    if (data.email) sendApprovalEmail(data.email, data.name ?? "").catch(() => {});
    await logAudit({ uid: caller.uid, email: caller.email, action: "user.autoApprove" });

    return NextResponse.json({ ok: true, status: "approved" });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
