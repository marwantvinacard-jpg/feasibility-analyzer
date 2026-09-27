// GET    /api/account?export=1 — dump everything Firestore holds about the
//        caller as JSON (GDPR-style data-portability request).
// DELETE /api/account — permanently delete the caller's own account: their
//        Firestore user doc, every analysis + its scenarios, and the
//        Firebase Auth user itself. Blocked if they own an organization —
//        that needs an ownership transfer first, not a silent cascade
//        through an org's shared billing/API keys.

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const caller = await requireUser(req);
    const db = adminDb();

    const [userSnap, analysesSnap] = await Promise.all([
      db.collection("users").doc(caller.uid).get(),
      db.collection("analyses").where("uid", "==", caller.uid).get(),
    ]);

    const analyses = await Promise.all(
      analysesSnap.docs.map(async (doc) => {
        const scenarios = await doc.ref.collection("scenarios").get();
        return { ...doc.data(), scenarios: scenarios.docs.map((s) => s.data()) };
      })
    );

    await logAudit({ uid: caller.uid, email: caller.email, action: "account.dataExported" });
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      account: userSnap.data() ?? null,
      analyses,
    });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    await logError("account.export", err);
    return NextResponse.json({ error: "Could not export your data." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const caller = await requireUser(req);
    const db = adminDb();

    const userSnap = await db.collection("users").doc(caller.uid).get();
    const orgId = userSnap.data()?.orgId as string | undefined;
    if (orgId) {
      const orgSnap = await db.collection("organizations").doc(orgId).get();
      if (orgSnap.data()?.ownerUid === caller.uid) {
        throw new HttpError(
          400,
          "You own an organization — transfer ownership or delete the organization first, then delete your account."
        );
      }
    }

    const analysesSnap = await db.collection("analyses").where("uid", "==", caller.uid).get();
    const batch = db.batch();
    for (const doc of analysesSnap.docs) {
      const scenarios = await doc.ref.collection("scenarios").get();
      for (const s of scenarios.docs) batch.delete(s.ref);
      batch.delete(doc.ref);
    }
    batch.delete(db.collection("users").doc(caller.uid));
    await batch.commit();

    await logAudit({ uid: caller.uid, email: caller.email, action: "account.deleted" });
    await adminAuth().deleteUser(caller.uid);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    await logError("account.delete", err, {});
    return NextResponse.json({ error: "Could not delete your account. Please try again or contact support." }, { status: 500 });
  }
}
