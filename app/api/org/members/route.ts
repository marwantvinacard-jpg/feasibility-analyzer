// POST   /api/org/members — invite a member by username or email (owner only).
// DELETE /api/org/members — remove a member (owner only; can't remove self/owner).

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import type { OrgMember, OrgRole } from "@/lib/orgTypes";

export const runtime = "nodejs";

async function requireOwnedOrg(caller: { uid: string }) {
  const db = adminDb();
  const userSnap = await db.collection("users").doc(caller.uid).get();
  const orgId = userSnap.data()?.orgId as string | undefined;
  if (!orgId) throw new HttpError(404, "No organization found.");
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throw new HttpError(404, "No organization found.");
  if (orgSnap.data()?.ownerUid !== caller.uid) throw new HttpError(403, "Only the owner can manage members.");
  return { db, orgId, orgRef };
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { identifier, role } = (await req.json()) as { identifier: string; role?: OrgRole };
    if (!identifier?.trim()) throw new HttpError(400, "A username or email is required.");

    const { db, orgId, orgRef } = await requireOwnedOrg(caller);

    // Resolve identifier -> uid, the same way login does (usernames collection),
    // falling back to Auth's own email lookup.
    let targetUid: string;
    let targetEmail: string;
    let targetName: string;
    const id = identifier.trim();
    if (id.includes("@")) {
      const { adminAuth } = await import("@/lib/firebase/admin");
      const user = await adminAuth()
        .getUserByEmail(id)
        .catch(() => null);
      if (!user) throw new HttpError(404, "No account with that email.");
      targetUid = user.uid;
      targetEmail = user.email ?? id;
      targetName = user.displayName ?? id;
    } else {
      const unameSnap = await db.collection("usernames").doc(id.trim().toLowerCase()).get();
      if (!unameSnap.exists) throw new HttpError(404, "No account with that username.");
      const { uid, email } = unameSnap.data() as { uid: string; email: string };
      targetUid = uid;
      targetEmail = email;
      const userDoc = await db.collection("users").doc(uid).get();
      targetName = (userDoc.data()?.name as string) ?? email;
    }

    const targetUserRef = db.collection("users").doc(targetUid);
    const targetUserSnap = await targetUserRef.get();
    if (targetUserSnap.data()?.orgId) throw new HttpError(409, "That person already belongs to an organization.");

    const member: OrgMember = {
      uid: targetUid,
      email: targetEmail,
      name: targetName,
      role: role === "viewer" ? "viewer" : "analyst",
      addedAt: Date.now(),
    };

    await db.runTransaction(async (tx) => {
      tx.set(orgRef.collection("members").doc(targetUid), member);
      tx.set(targetUserRef, { orgId }, { merge: true });
    });

    await logAudit({ uid: caller.uid, email: caller.email, action: "org.addMember", target: targetUid, meta: { orgId } });
    return NextResponse.json({ member });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const caller = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const targetUid = searchParams.get("uid");
    if (!targetUid) throw new HttpError(400, "uid is required.");

    const { db, orgId, orgRef } = await requireOwnedOrg(caller);
    if (targetUid === caller.uid) throw new HttpError(400, "The owner can't remove themselves — delete the organization instead.");

    await db.runTransaction(async (tx) => {
      tx.delete(orgRef.collection("members").doc(targetUid));
      tx.set(db.collection("users").doc(targetUid), { orgId: null }, { merge: true });
    });

    await logAudit({ uid: caller.uid, email: caller.email, action: "org.removeMember", target: targetUid, meta: { orgId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
