// GET /api/analyses?clientId=... — list a browser's analyses. Firestore is
// server-only now, so the client reads through here.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ items: [] });
  try {
    const snap = await adminDb().collection("analyses").where("uid", "==", clientId).get();
    const items = snap.docs.map((d) => d.data());
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
