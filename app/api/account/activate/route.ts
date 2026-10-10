// POST /api/account/activate — self-service approval. A pending account whose
// email is verified (per the signed ID token, never the client's say-so) is
// approved on the spot with the standard starter credits, so nobody waits on
// an admin. Rejected accounts are never re-approved here. With
// SIGNUP_APPROVAL=manual this does nothing and the admin approves as before.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { APPROVAL_CREDITS, signupApprovalMode } from "@/lib/approval";

export const runtime = "nodejs";

type Result = "approved" | "needs-verification" | "manual" | "rejected";

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const ref = adminDb().collection("users").doc(caller.uid);

    const { result, changed } = await adminDb().runTransaction<{ result: Result; changed: boolean }>(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "Account not found.");
      const status = snap.data()?.status as string | undefined;
      if (status === "approved") return { result: "approved", changed: false };
      if (status === "rejected") return { result: "rejected", changed: false };
      if (signupApprovalMode() === "manual") return { result: "manual", changed: false };
      if (!caller.emailVerified) return { result: "needs-verification", changed: false };

      const current = (snap.data()?.credits as number) ?? 0;
      tx.update(ref, {
        status: "approved",
        credits: current > 0 ? current : APPROVAL_CREDITS,
        approvedBy: "auto-verified-email",
        updatedAt: new Date().toISOString(),
      });
      return { result: "approved", changed: true };
    });

    if (changed) {
      // Only the transition is logged, not every repeat call from an approved account.
      await logAudit({ uid: caller.uid, email: caller.email, action: "user.autoApprove", target: caller.uid }).catch(() => {});
    }
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
