// POST /api/analysis/delete — delete an analysis. No auth (the app has no login);
// scoped to the caller's browser clientId so one browser can't wipe another's.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id, clientId } = (await req.json()) as { id: string; clientId?: string };
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

    const ref = adminDb().collection("analyses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: true });
    if (clientId && snap.data()?.uid && snap.data()?.uid !== clientId) {
      return NextResponse.json({ error: "Not your analysis." }, { status: 403 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
