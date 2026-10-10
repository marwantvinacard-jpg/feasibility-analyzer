// GET /api/cron/stale-runs — run every 15 minutes by Cloud Scheduler on Firebase
// (scripts/setup-firebase-jobs.sh; daily via vercel.json on Vercel). Settles every analysis
// still "running" long after its server must have died (failed + refunded),
// for users who haven't opened the app since. Most stale runs are already
// settled sooner, when their owner opens the dashboard or the report.
//
// The caller must send `Authorization: Bearer $CRON_SECRET` (Cloud Scheduler is
// set up with that header; Vercel Cron sends it automatically). Without a
// CRON_SECRET configured, this route refuses to run.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { logError } from "@/lib/firebase/errorLog";
import { sweepStaleRuns } from "@/lib/runLifecycle";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const swept = await sweepStaleRuns(adminDb());
    return NextResponse.json({ swept });
  } catch (err) {
    await logError("cron.staleRuns", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
