// PATCH /api/analysis/model — save a hand-edited financial model and recompute
// its projections deterministically server-side. No LLM call, no credit cost —
// this is pure arithmetic (lib/engine/projections.ts), the same code path the
// stress-test dashboard already uses. The narrative is left untouched (it was
// written for the pre-edit numbers); the UI flags it as stale until the user
// explicitly pays to regenerate it.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";
import { FinancialModelSchema } from "@/lib/engine/financialModel";
import { buildProjections } from "@/lib/engine/projections";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  try {
    const caller = await requireUser(req);
    const { id, model: rawModel } = (await req.json()) as { id: string; model: unknown };
    if (!id) throw new HttpError(400, "id is required.");

    let model;
    try {
      model = FinancialModelSchema.parse(rawModel);
    } catch (e) {
      throw new HttpError(400, `Invalid financial model: ${e instanceof Error ? e.message : "validation failed"}`);
    }

    const db = adminDb();
    const ref = db.collection("analyses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "Analysis not found.");
    const data = snap.data()!;
    if (data.uid !== caller.uid && !caller.admin) throw new HttpError(403, "Not your analysis.");
    if (!data.result?.study) throw new HttpError(400, "This analysis has no financial study to edit.");

    // Never trust client-computed numbers — recompute from the edited model,
    // exactly like the original generation and the stress-test dashboard do.
    const projections = buildProjections(model, {
      monthlyCost: Number(data.input?.monthly_cost) || 0,
      monthlyRevenue: Number(data.input?.monthly_revenue) || 0,
    });

    const now = Date.now();
    await ref.update({
      "result.study.model": model,
      "result.study.projections": projections,
      "result.study.modelEditedAt": now,
      "result.study.modelEditedBy": caller.email ?? caller.uid,
    });

    await logAudit({ uid: caller.uid, email: caller.email, action: "analysis.editModel", target: id });
    return NextResponse.json({ ok: true, projections });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    await logError("analysis.model.patch", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
