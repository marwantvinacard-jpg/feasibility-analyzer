// GET /api/health — for an external uptime monitor (Better Uptime, UptimeRobot,
// Pingdom, etc). Touches Firestore so a database outage shows up as unhealthy,
// not just "the Next.js process is alive."
//
// It READS (a doc that needn't exist) rather than writes, and reuses its answer
// for a few seconds: anyone can call this URL, so it mustn't let a stranger
// run up Firestore writes or hammer the database.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_MS = 15_000;
let last: { at: number; ok: boolean } | null = null;

export async function GET() {
  if (!last || Date.now() - last.at > CACHE_MS) {
    let ok = true;
    try {
      await adminDb().collection("_health").doc("check").get();
    } catch {
      ok = false;
    }
    last = { at: Date.now(), ok };
  }
  return last.ok
    ? NextResponse.json({ status: "ok", time: new Date().toISOString() })
    : NextResponse.json({ status: "degraded" }, { status: 503 });
}
