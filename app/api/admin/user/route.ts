// POST /api/admin/user — admin-only account actions (approve / reject / grant
// credits). The security rules forbid clients from changing status/role/credits,
// so this runs with the Admin SDK after verifying the caller's admin claim.

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { sendApprovalEmail, sendRejectionEmail } from "@/lib/email";

export const runtime = "nodejs";

const APPROVAL_CREDITS = 3;

export async function POST(req: Request) {
  try {
    const caller = await requireAdmin(req);
    const { uid, action, amount } = (await req.json()) as {
      uid: string;
      action: "approve" | "reject" | "grant";
      amount?: number;
    };
    if (!uid || !action) throw new HttpError(400, "uid and action are required.");

    const ref = adminDb().collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "User not found.");

    if (action === "approve") {
      const current = (snap.data()?.credits as number) ?? 0;
      await ref.set(
        { status: "approved", credits: current > 0 ? current : APPROVAL_CREDITS, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      const d = snap.data();
      if (d?.email) sendApprovalEmail(d.email, d.name ?? "").catch(() => {});
    } else if (action === "reject") {
      await ref.set({ status: "rejected", updatedAt: new Date().toISOString() }, { merge: true });
      const d = snap.data();
      if (d?.email) sendRejectionEmail(d.email, d.name ?? "").catch(() => {});
    } else if (action === "grant") {
      await ref.update({ credits: FieldValue.increment(amount ?? APPROVAL_CREDITS) });
    } else {
      throw new HttpError(400, "Unknown action.");
    }

    await logAudit({ uid: caller.uid, email: caller.email, action: `user.${action}`, target: uid, meta: { amount } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
