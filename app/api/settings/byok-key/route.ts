// POST   /api/settings/byok-key — encrypt and store the caller's own AI key.
// GET    /api/settings/byok-key — return a masked preview only (never the raw key).
// DELETE /api/settings/byok-key — remove the stored key.

import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";
import { saveByokKey, clearByokKey, getByokKeyPreview } from "@/lib/firebase/byokKey";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const caller = await requireUser(req);
    const preview = await getByokKeyPreview(caller.uid);
    return NextResponse.json({ preview });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    await logError("settings.byokKey.get", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { key } = (await req.json().catch(() => ({}))) as { key?: string };
    const trimmed = key?.trim();
    if (!trimmed || trimmed.length < 8) throw new HttpError(400, "That doesn't look like a valid API key.");
    await saveByokKey(caller.uid, trimmed);
    await logAudit({ uid: caller.uid, email: caller.email, action: "settings.byokKeySaved" });
    return NextResponse.json({ ok: true, preview: `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}` });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    await logError("settings.byokKey.post", err);
    return NextResponse.json({ error: "Could not save the key." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const caller = await requireUser(req);
    await clearByokKey(caller.uid);
    await logAudit({ uid: caller.uid, email: caller.email, action: "settings.byokKeyRemoved" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    await logError("settings.byokKey.delete", err);
    return NextResponse.json({ error: "Could not remove the key." }, { status: 500 });
  }
}
