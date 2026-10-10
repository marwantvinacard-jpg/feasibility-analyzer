// POST /api/internal/run-analysis — { analysisId }. Called by Cloud Tasks (see
// lib/runDispatch.ts), never by browsers: it requires the X-Internal-Secret
// header. The analysis runs inside this request, so the server keeps full CPU
// for it. A duplicate delivery is harmless — the runner claims the record first.
//
// Replies 200 whenever the run was handled (including "the analysis failed",
// which is recorded and refunded); only an unexpected infrastructure error
// replies 500, so Cloud Tasks retries just those.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { executeAnalysis } from "@/lib/analysisRunner";
import { logError } from "@/lib/firebase/errorLog";

export const runtime = "nodejs";
export const maxDuration = 300;

function secretMatches(given: string | null): boolean {
  const expected = process.env.INTERNAL_TASK_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-internal-secret"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { analysisId } = (await req.json().catch(() => ({}))) as { analysisId?: unknown };
  if (typeof analysisId !== "string" || !analysisId) return NextResponse.json({ error: "analysisId is required." }, { status: 400 });
  try {
    const outcome = await executeAnalysis(analysisId);
    return NextResponse.json({ outcome });
  } catch (err) {
    await logError("internal.runAnalysis", err, { analysisId }).catch(() => {});
    return NextResponse.json({ error: "Run failed to execute" }, { status: 500 });
  }
}
