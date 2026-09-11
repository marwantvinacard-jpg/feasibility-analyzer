// GET  /api/org  — the caller's org (with their role + member list), or null.
// POST /api/org  — create an org (caller becomes owner). One org per user for v1.
// PATCH /api/org — update branding (owner only).

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import type { Organization, OrgMember } from "@/lib/orgTypes";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const caller = await requireUser(req);
    const db = adminDb();
    const userSnap = await db.collection("users").doc(caller.uid).get();
    const orgId = userSnap.data()?.orgId as string | undefined;
    if (!orgId) return NextResponse.json({ org: null, members: [] });

    const orgSnap = await db.collection("organizations").doc(orgId).get();
    if (!orgSnap.exists) return NextResponse.json({ org: null, members: [] });

    const membersSnap = await db.collection("organizations").doc(orgId).collection("members").get();
    const members = membersSnap.docs.map((d) => d.data() as OrgMember);

    return NextResponse.json({ org: orgSnap.data() as Organization, members });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { name } = (await req.json()) as { name: string };
    if (!name?.trim()) throw new HttpError(400, "Organization name is required.");

    const db = adminDb();
    const userRef = db.collection("users").doc(caller.uid);
    const userSnap = await userRef.get();
    if (userSnap.data()?.orgId) throw new HttpError(409, "You already belong to an organization.");

    const orgRef = db.collection("organizations").doc();
    const org: Organization = {
      id: orgRef.id,
      name: name.trim(),
      ownerUid: caller.uid,
      branding: {},
      plan: "free",
      createdAt: Date.now(),
    };
    const member: OrgMember = {
      uid: caller.uid,
      email: caller.email ?? "",
      name: (userSnap.data()?.name as string) ?? caller.email ?? "",
      role: "owner",
      addedAt: Date.now(),
    };

    await db.runTransaction(async (tx) => {
      tx.set(orgRef, org);
      tx.set(orgRef.collection("members").doc(caller.uid), member);
      tx.set(userRef, { orgId: orgRef.id }, { merge: true });
    });

    await logAudit({ uid: caller.uid, email: caller.email, action: "org.create", target: orgRef.id, meta: { name } });
    return NextResponse.json({ org });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const caller = await requireUser(req);
    const { name, logoUrl, primaryColor } = (await req.json()) as {
      name?: string;
      logoUrl?: string;
      primaryColor?: string;
    };

    const db = adminDb();
    const userSnap = await db.collection("users").doc(caller.uid).get();
    const orgId = userSnap.data()?.orgId as string | undefined;
    if (!orgId) throw new HttpError(404, "No organization found.");

    const orgRef = db.collection("organizations").doc(orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) throw new HttpError(404, "No organization found.");
    if (orgSnap.data()?.ownerUid !== caller.uid) throw new HttpError(403, "Only the owner can edit branding.");

    const update: Record<string, unknown> = {};
    if (name?.trim()) update.name = name.trim();
    if (logoUrl !== undefined) update["branding.logoUrl"] = logoUrl;
    if (primaryColor !== undefined) update["branding.primaryColor"] = primaryColor;

    await orgRef.update(update);
    await logAudit({ uid: caller.uid, email: caller.email, action: "org.updateBranding", target: orgId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
