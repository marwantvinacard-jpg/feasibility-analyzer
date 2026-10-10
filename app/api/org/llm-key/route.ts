// GET    /api/org/llm-key — owner only: { set, provider, last4, preview }, never the key.
// POST   /api/org/llm-key — { apiKey, provider? }: the owner sets the org's shared
//        AI key (provider defaults to OpenAI). It's checked with the provider,
//        encrypted and stored; every member's analyses then run on it instead of
//        the platform credit balance (a member's own personal key still wins).
// DELETE /api/org/llm-key — the owner clears it, reverting members to their own
//        key or credits.
// See lib/firebase/orgLlmKey.ts for how the key is protected.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError, type Caller } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";
import { checkRateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/engine/validateInput";
import { BYOK_PROVIDER_LABELS, ByokError, isByokProvider, last4, validateKeyFormat, verifyProviderKey } from "@/lib/byok";
import type { ByokProvider } from "@/lib/byokProviders";
import { saveOrgLlmKey, clearOrgLlmKey, getOrgLlmKeyInfo } from "@/lib/firebase/orgLlmKey";

export const runtime = "nodejs";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

/** The caller's org, if they own it. Setting a key also needs the org approved. */
async function requireOwnedOrg(caller: Caller, opts: { approved?: boolean } = {}): Promise<string> {
  const db = adminDb();
  const orgId = (await db.collection("users").doc(caller.uid).get()).data()?.orgId as string | undefined;
  if (!orgId) throw new HttpError(404, "No organization found. Create one first.");
  const org = (await db.collection("organizations").doc(orgId).get()).data();
  if (!org) throw new HttpError(404, "No organization found.");
  if (org.ownerUid !== caller.uid) throw new HttpError(403, "Only the owner can manage the shared API key.");
  if (opts.approved && org.status !== "approved") throw new HttpError(403, "Your organization isn't approved yet.");
  return orgId;
}

function describe(info: { provider: ByokProvider; last4: string } | null) {
  if (!info) return { set: false, provider: null, last4: null, preview: null };
  const label = BYOK_PROVIDER_LABELS[info.provider] ?? info.provider;
  return { set: true, provider: info.provider, last4: info.last4, preview: `${label} ••••${info.last4}` };
}

async function fail(err: unknown, context: string) {
  if (err instanceof HttpError || err instanceof ByokError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  await logError(context, err);
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const caller = await requireUser(req);
    const orgId = await requireOwnedOrg(caller);
    return NextResponse.json(describe(await getOrgLlmKeyInfo(orgId)));
  } catch (err) {
    return fail(err, "org.llmKey.get");
  }
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const rl = await checkRateLimit(`org-llm-key:${caller.uid}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.allowed) throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`);
    const body = await readJsonBody(req, 4_000);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    const { apiKey, provider = "openai" } = (body.body ?? {}) as { apiKey?: unknown; provider?: unknown };
    if (!isByokProvider(provider)) throw new ByokError(400, "Choose a provider.");
    const key = validateKeyFormat(apiKey);

    const orgId = await requireOwnedOrg(caller, { approved: true });
    await verifyProviderKey(provider, key);
    await saveOrgLlmKey(orgId, provider, key, caller.uid);
    // Never log the key — only which provider and its last 4 characters.
    await logAudit({ uid: caller.uid, email: caller.email, action: "org.setLlmKey", target: orgId, meta: { provider, last4: last4(key) } });
    return NextResponse.json(describe({ provider, last4: last4(key) }));
  } catch (err) {
    return fail(err, "org.llmKey.post");
  }
}

export async function DELETE(req: Request) {
  try {
    const caller = await requireUser(req);
    const orgId = await requireOwnedOrg(caller);
    await clearOrgLlmKey(orgId);
    await logAudit({ uid: caller.uid, email: caller.email, action: "org.clearLlmKey", target: orgId });
    return NextResponse.json(describe(null));
  } catch (err) {
    return fail(err, "org.llmKey.delete");
  }
}
