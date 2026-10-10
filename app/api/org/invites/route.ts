// GET  /api/org/invites — pending organization invites addressed to the caller.
// POST /api/org/invites — { orgId, action: "accept" | "decline" }. Accepting is
//                         the ONLY way to become a member of someone else's org.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { inviteId, type OrgInvite, type OrgMember } from "@/lib/orgTypes";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const caller = await requireUser(req);
    const snap = await adminDb().collection("orgInvites").where("uid", "==", caller.uid).get();
    const invites = snap.docs.map((d) => d.data() as OrgInvite).sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ invites });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { orgId, action } = (await req.json().catch(() => ({}))) as { orgId?: unknown; action?: unknown };
    if (typeof orgId !== "string" || !orgId) throw new HttpError(400, "orgId is required.");
    if (action !== "accept" && action !== "decline") throw new HttpError(400, "action must be accept or decline.");

    const db = adminDb();
    // The id embeds the caller's uid, so nobody can act on someone else's invite.
    const inviteRef = db.collection("orgInvites").doc(inviteId(orgId, caller.uid));

    if (action === "decline") {
      await inviteRef.delete();
      await logAudit({ uid: caller.uid, email: caller.email, action: "org.inviteDeclined", target: orgId });
      return NextResponse.json({ ok: true });
    }

    const orgRef = db.collection("organizations").doc(orgId);
    const userRef = db.collection("users").doc(caller.uid);
    const outcome = await db.runTransaction(async (tx) => {
      const [inviteSnap, orgSnap, userSnap] = await Promise.all([tx.get(inviteRef), tx.get(orgRef), tx.get(userRef)]);
      if (!inviteSnap.exists) throw new HttpError(404, "This invite no longer exists.");
      if (!orgSnap.exists) {
        // Commit the cleanup (throwing here would roll it back), then report it.
        tx.delete(inviteRef);
        return "org-gone" as const;
      }
      if (userSnap.data()?.orgId) throw new HttpError(409, "You already belong to an organization.");

      const invite = inviteSnap.data() as OrgInvite;
      const member: OrgMember = {
        uid: caller.uid,
        email: caller.email ?? invite.email,
        name: (userSnap.data()?.name as string) ?? invite.name,
        role: invite.role,
        addedAt: Date.now(),
      };
      tx.set(orgRef.collection("members").doc(caller.uid), member);
      tx.set(userRef, { orgId }, { merge: true });
      tx.delete(inviteRef);
      return "joined" as const;
    });
    if (outcome === "org-gone") throw new HttpError(404, "That organization no longer exists.");

    await logAudit({ uid: caller.uid, email: caller.email, action: "org.inviteAccepted", target: orgId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
