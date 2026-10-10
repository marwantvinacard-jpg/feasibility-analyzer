// POST   /api/org/members            — invite someone by username or email (owner only).
//                                      Creates a pending invite; they only join if they accept
//                                      it (see /api/org/invites).
// DELETE /api/org/members?uid=...    — remove a member of YOUR org (owner only; can't remove self/owner).
// DELETE /api/org/members?invite=... — cancel a pending invite you sent (owner only).

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { sendOrgInviteEmail } from "@/lib/email";
import { accountForUsername } from "@/lib/usernameLookup";
import { inviteId, type OrgInvite, type OrgMember, type OrgRole } from "@/lib/orgTypes";

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
  return { db, orgId, orgRef, orgName: (orgSnap.data()?.name as string) ?? "", callerStatus: userSnap.data()?.status as string | undefined };
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { identifier, role } = (await req.json()) as { identifier: string; role?: OrgRole };
    if (typeof identifier !== "string" || !identifier.trim()) throw new HttpError(400, "A username or email is required.");

    const { db, orgId, orgRef, orgName, callerStatus } = await requireOwnedOrg(caller);
    if (callerStatus !== "approved") throw new HttpError(403, "Your account must be approved before you can invite people.");

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
      // usernames docs hold only the uid; the email comes from Firebase Auth.
      const account = await accountForUsername(id);
      if (!account) throw new HttpError(404, "No account with that username.");
      targetUid = account.uid;
      targetEmail = account.email;
      const userDoc = await db.collection("users").doc(account.uid).get();
      targetName = (userDoc.data()?.name as string) ?? account.email;
    }

    if (targetUid === caller.uid) throw new HttpError(400, "You're already in this organization.");
    const memberSnap = await orgRef.collection("members").doc(targetUid).get();
    if (memberSnap.exists) throw new HttpError(409, "That person is already a member.");
    const targetUserSnap = await db.collection("users").doc(targetUid).get();
    if (targetUserSnap.data()?.orgId) throw new HttpError(409, "That person already belongs to an organization.");

    // Only an invite is created here. Membership (and with it, sharing their
    // analyses with this org) starts when THEY accept it.
    const invite: OrgInvite = {
      id: inviteId(orgId, targetUid),
      orgId,
      orgName,
      uid: targetUid,
      email: targetEmail,
      name: targetName,
      role: role === "viewer" ? "viewer" : "analyst",
      invitedByEmail: caller.email ?? "",
      createdAt: Date.now(),
    };
    await db.collection("orgInvites").doc(invite.id).set(invite);

    await logAudit({ uid: caller.uid, email: caller.email, action: "org.invite", target: targetUid, meta: { orgId } });
    // Awaited (Cloud Run throttles CPU after the reply); send() logs its own failures.
    if (targetEmail) await sendOrgInviteEmail(targetEmail, targetName, orgName, caller.email ?? "");
    return NextResponse.json({ invite });
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
    const invitedUid = searchParams.get("invite");
    if (!targetUid && !invitedUid) throw new HttpError(400, "uid or invite is required.");

    const { db, orgId, orgRef } = await requireOwnedOrg(caller);

    if (invitedUid) {
      const inviteRef = db.collection("orgInvites").doc(inviteId(orgId, invitedUid));
      if (!(await inviteRef.get()).exists) throw new HttpError(404, "No pending invite for that person.");
      await inviteRef.delete();
      await logAudit({ uid: caller.uid, email: caller.email, action: "org.inviteCanceled", target: invitedUid, meta: { orgId } });
      return NextResponse.json({ ok: true });
    }

    const uid = targetUid!;
    if (uid === caller.uid) throw new HttpError(400, "The owner can't remove themselves — delete the organization instead.");

    await db.runTransaction(async (tx) => {
      // Only someone who is actually a member of the caller's org can be
      // removed — otherwise any org owner could clear anyone's orgId.
      const memberRef = orgRef.collection("members").doc(uid);
      const memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists) throw new HttpError(404, "That person isn't a member of your organization.");
      if ((memberSnap.data() as OrgMember).role === "owner") throw new HttpError(400, "The owner can't be removed.");

      const userRef = db.collection("users").doc(uid);
      const userSnap = await tx.get(userRef);
      tx.delete(memberRef);
      if (userSnap.data()?.orgId === orgId) tx.set(userRef, { orgId: null }, { merge: true });
    });

    await logAudit({ uid: caller.uid, email: caller.email, action: "org.removeMember", target: uid, meta: { orgId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
