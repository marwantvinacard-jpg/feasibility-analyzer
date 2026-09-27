// GET /api/health — for an external uptime monitor (Better Uptime, UptimeRobot,
// Pingdom, etc). Touches Firestore so a database outage shows up as unhealthy,
// not just "the Next.js process is alive."

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    await adminDb().collection("_health").doc("check").set({ at: Date.now() });
    return NextResponse.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
