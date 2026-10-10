// DELETE /api/account — { confirm: "DELETE" }. Permanently deletes the caller's
// account and everything that belongs to it (see the Privacy Policy):
// analyses (with their saved scenarios), saved AI key, username, invitations,
// training data, then the sign-in account itself. Payment records and the
// security audit log are kept, as the law requires for accounting/fraud.
//
// Organizations: an owner whose org still has other members must remove them
// first (otherwise their team would be left without an owner). An org whose
// only member is its owner is deleted with the account.

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";

export const runtime = "nodejs";
export const maxDuration = 120;

async function deleteQuery(q: FirebaseFirestore.Query) {
  const db = adminDb();
  for (const d of (await q.get()).docs) await db.recursiveDelete(d.ref);
}

export async function DELETE(req: Request) {
  try {
    const caller = await requireUser(req);
    const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: unknown };
    if (confirm !== "DELETE") throw new HttpError(400, 'Type DELETE to confirm.');
    if (caller.admin) throw new HttpError(403, "Admin accounts can't be deleted from here — remove the admin role first.");

    const db = adminDb();
    const userRef = db.collection("users").doc(caller.uid);
    const user = (await userRef.get()).data() ?? {};

    // Organization first, so we never leave a team without its owner.
    const orgId = user.orgId as string | undefined;
    if (orgId) {
      const orgRef = db.collection("organizations").doc(orgId);
      const org = (await orgRef.get()).data();
      if (org?.ownerUid === caller.uid) {
        const others = (await orgRef.collection("members").get()).docs.filter((d) => d.id !== caller.uid);
        if (others.length > 0) {
          throw new HttpError(409, "Your organization still has other members. Remove them on the Team page before deleting your account.");
        }
        await deleteQuery(db.collection("orgInvites").where("orgId", "==", orgId));
        await db.recursiveDelete(orgRef); // members, API keys
      } else {
        await orgRef.collection("members").doc(caller.uid).delete();
      }
    }

    await deleteQuery(db.collection("analyses").where("uid", "==", caller.uid));
    await deleteQuery(db.collection("orgInvites").where("uid", "==", caller.uid));
    await deleteQuery(db.collection("trainingData").where("uid", "==", caller.uid));
    await db.recursiveDelete(db.collection("usage").doc(caller.uid));
    if (typeof user.username === "string") {
      const u = db.collection("usernames").doc(user.username);
      if ((await u.get()).data()?.uid === caller.uid) await u.delete();
    }
    await db.recursiveDelete(userRef); // profile + encrypted AI key

    await adminAuth().deleteUser(caller.uid);
    await logAudit({ uid: caller.uid, action: "account.deleted" }).catch(() => {});
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    await logError("account.delete", err).catch(() => {});
    return NextResponse.json({ error: "Couldn't delete the account. Please try again or contact us." }, { status: 500 });
  }
}
