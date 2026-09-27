// GET    /api/org/llm-key — owner-only masked preview + whether one is set.
// POST   /api/org/llm-key — owner sets the org's shared AI API key. Every
//        approved member's analyses then run on it instead of the platform
//        credit balance (a member's own personal BYOK key still wins).
// DELETE /api/org/llm-key — owner clears it, reverting members to BYOK/credits.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { checkRateLimit } from "@/lib/rateLimit";
import { saveOrgLlmKey, clearOrgLlmKey, getOrgLlmKeyPreview } from "@/lib/firebase/orgLlmKey";

export const runtime = "nodejs";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

async function requireOwnedOrg(caller: { uid: string }) {
  const db = adminDb();
  const userSnap = await db.collection("users").doc(caller.uid).get();
  const orgId = userSnap.data()?.orgId as string | undefined;
  if (!orgId) throw new HttpError(404, "No organization found. Create one first.");
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throw new HttpError(404, "No organization found.");
  if (orgSnap.data()?.ownerUid !== caller.uid) throw new HttpError(403, "Only the owner can manage the shared API key.");
  return { orgId };
}

export async function GET(req: Request) {
  try {
    const caller = await requireUser(req);
    const { orgId } = await requireOwnedOrg(caller);
    const preview = await getOrgLlmKeyPreview(orgId);
    return NextResponse.json({ set: !!preview, preview });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const rl = await checkRateLimit(`org-llm-key:${caller.uid}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.allowed) throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`);
    const { apiKey } = (await req.json()) as { apiKey?: string };
    if (!apiKey || apiKey.trim().length < 10) throw new HttpError(400, "A valid API key is required.");

    const { orgId } = await requireOwnedOrg(caller);
    await saveOrgLlmKey(orgId, apiKey.trim());
    await logAudit({ uid: caller.uid, email: caller.email, action: "org.setLlmKey", target: orgId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const caller = await requireUser(req);
    const { orgId } = await requireOwnedOrg(caller);
    await clearOrgLlmKey(orgId);
    await logAudit({ uid: caller.uid, email: caller.email, action: "org.clearLlmKey", target: orgId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
