// POST   /api/org/keys — create an API key (owner only). Returns the raw key
//        exactly once; only its SHA-256 hash is ever stored.
// DELETE /api/org/keys — revoke a key (owner only).
//
// Keys look like "fsa_live_<40 random hex chars>" — the "fsa_live_" prefix
// makes them recognizable in logs/scanners the way "sk_live_" style keys are.

import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import type { ApiKeyDoc } from "@/lib/orgTypes";

export const runtime = "nodejs";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function requireOwnedOrg(caller: { uid: string }, requireApproved = false) {
  const db = adminDb();
  const userSnap = await db.collection("users").doc(caller.uid).get();
  const orgId = userSnap.data()?.orgId as string | undefined;
  if (!orgId) throw new HttpError(404, "No organization found. Create one first.");
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throw new HttpError(404, "No organization found.");
  if (orgSnap.data()?.ownerUid !== caller.uid) throw new HttpError(403, "Only the owner can manage API keys.");
  if (requireApproved && orgSnap.data()?.status !== "approved") {
    throw new HttpError(403, "Your organization is awaiting admin approval before API access can be used.");
  }
  return { db, orgId, orgRef };
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { label } = (await req.json()) as { label?: string };

    const { orgRef } = await requireOwnedOrg(caller, true);

    const raw = `fsa_live_${randomBytes(24).toString("hex")}`;
    const keyRef = orgRef.collection("apiKeys").doc();
    const doc: ApiKeyDoc = {
      id: keyRef.id,
      label: label?.trim() || "Untitled key",
      keyPrefix: raw.slice(0, 16),
      createdAt: Date.now(),
      createdBy: caller.email ?? caller.uid,
    };
    await keyRef.set({ ...doc, keyHash: hashKey(raw) });

    await logAudit({ uid: caller.uid, email: caller.email, action: "org.createApiKey", target: keyRef.id });
    return NextResponse.json({ key: raw, meta: doc });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const caller = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");
    if (!keyId) throw new HttpError(400, "id is required.");

    const { orgRef, orgId } = await requireOwnedOrg(caller);
    await orgRef.collection("apiKeys").doc(keyId).update({ revoked: true });

    await logAudit({ uid: caller.uid, email: caller.email, action: "org.revokeApiKey", target: keyId, meta: { orgId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
