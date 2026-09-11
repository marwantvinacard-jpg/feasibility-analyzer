// Named stress-test scenarios, saved server-side under the analysis they
// belong to — so a "what we'd present to the bank" scenario survives beyond
// one browser tab and can be reviewed by a teammate.
// GET  /api/scenarios?analysisId=...          -> list (owner or admin)
// POST /api/scenarios { analysisId,name,knobs} -> create (owner or admin)
// DELETE /api/scenarios?analysisId=..&scenarioId=.. -> remove (owner or admin)

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";

export const runtime = "nodejs";

async function assertOwnerOrAdmin(caller: { uid: string; admin: boolean }, analysisId: string) {
  const snap = await adminDb().collection("analyses").doc(analysisId).get();
  if (!snap.exists) throw new HttpError(404, "Analysis not found.");
  if (snap.data()?.uid !== caller.uid && !caller.admin) throw new HttpError(403, "Not your analysis.");
}

export async function GET(req: Request) {
  try {
    const caller = await requireUser(req);
    const analysisId = new URL(req.url).searchParams.get("analysisId");
    if (!analysisId) throw new HttpError(400, "analysisId required.");
    await assertOwnerOrAdmin(caller, analysisId);

    const snap = await adminDb().collection("analyses").doc(analysisId).collection("scenarios").get();
    return NextResponse.json({ items: snap.docs.map((d) => d.data()) });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { analysisId, name, knobs } = (await req.json()) as {
      analysisId: string;
      name: string;
      knobs: Record<string, number>;
    };
    if (!analysisId || !name || !knobs) throw new HttpError(400, "analysisId, name and knobs are required.");
    await assertOwnerOrAdmin(caller, analysisId);

    const ref = adminDb().collection("analyses").doc(analysisId).collection("scenarios").doc();
    const doc = { id: ref.id, name: name.slice(0, 80), knobs, createdAt: Date.now(), createdBy: caller.email ?? caller.uid };
    await ref.set(doc);
    await logAudit({ uid: caller.uid, email: caller.email, action: "scenario.save", target: analysisId, meta: { name } });
    return NextResponse.json({ item: doc });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const caller = await requireUser(req);
    const url = new URL(req.url);
    const analysisId = url.searchParams.get("analysisId");
    const scenarioId = url.searchParams.get("scenarioId");
    if (!analysisId || !scenarioId) throw new HttpError(400, "analysisId and scenarioId required.");
    await assertOwnerOrAdmin(caller, analysisId);

    await adminDb().collection("analyses").doc(analysisId).collection("scenarios").doc(scenarioId).delete();
    await logAudit({ uid: caller.uid, email: caller.email, action: "scenario.delete", target: analysisId, meta: { scenarioId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
