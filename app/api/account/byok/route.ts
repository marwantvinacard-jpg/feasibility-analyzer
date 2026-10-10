// Bring-your-own-key management for the signed-in user.
//   GET    /api/account/byok — { hasKey, provider, last4 } (never the key itself)
//   POST   /api/account/byok — { provider, apiKey }: check it with the provider,
//                              encrypt it, store it, switch the account to BYOK.
//   DELETE /api/account/byok — remove the stored key, back to platform credits.
// See lib/byok.ts for how the key is protected.

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireApprovedUser, requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { readJsonBody } from "@/lib/engine/validateInput";
import {
  ByokError,
  encryptSecret,
  isByokProvider,
  last4,
  validateKeyFormat,
  verifyProviderKey,
} from "@/lib/byok";

export const runtime = "nodejs";

const secretRef = (uid: string) => adminDb().collection("users").doc(uid).collection("secrets").doc("llm");

function fail(err: unknown) {
  if (err instanceof HttpError || err instanceof ByokError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const caller = await requireUser(req);
    const snap = await secretRef(caller.uid).get();
    if (!snap.exists) return NextResponse.json({ hasKey: false });
    return NextResponse.json({ hasKey: true, provider: snap.data()?.provider, last4: snap.data()?.last4 });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const caller = await requireApprovedUser(req);
    const body = await readJsonBody(req, 4_000);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    const { provider, apiKey } = (body.body ?? {}) as { provider?: unknown; apiKey?: unknown };
    if (!isByokProvider(provider)) throw new ByokError(400, "Choose a provider.");
    const key = validateKeyFormat(apiKey);

    const encrypted = encryptSecret(key, caller.uid); // fails fast if the server isn't configured
    await verifyProviderKey(provider, key);

    const now = Date.now();
    const db = adminDb();
    const batch = db.batch();
    batch.set(secretRef(caller.uid), { ...encrypted, provider, last4: last4(key), updatedAt: now });
    batch.set(
      db.collection("users").doc(caller.uid),
      { keyMode: "byok", byokProvider: provider, byokLast4: last4(key) },
      { merge: true }
    );
    await batch.commit();

    // Never log the key — only which provider and its last 4 characters.
    await logAudit({ uid: caller.uid, email: caller.email, action: "byok.saved", meta: { provider, last4: last4(key) } });
    return NextResponse.json({ hasKey: true, provider, last4: last4(key) });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const caller = await requireUser(req);
    const db = adminDb();
    const batch = db.batch();
    batch.delete(secretRef(caller.uid));
    batch.set(
      db.collection("users").doc(caller.uid),
      { keyMode: "platform", byokProvider: FieldValue.delete(), byokLast4: FieldValue.delete() },
      { merge: true }
    );
    await batch.commit();
    await logAudit({ uid: caller.uid, email: caller.email, action: "byok.removed" });
    return NextResponse.json({ hasKey: false });
  } catch (err) {
    return fail(err);
  }
}
