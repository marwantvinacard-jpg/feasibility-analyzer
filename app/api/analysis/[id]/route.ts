// GET /api/analysis/[id] — fetch one analysis (used for polling live progress).
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const snap = await adminDb().collection("analyses").doc(id).get();
    return NextResponse.json({ item: snap.exists ? snap.data() : null });
  } catch {
    return NextResponse.json({ item: null }, { status: 200 });
  }
}
