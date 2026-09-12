// POST /api/analysis/regenerate-narrative — re-writes the financial study's
// prose against whatever the current model is (edited or original). Costs one
// credit, same as any other AI call — the arithmetic never changes, only the
// commentary explaining it, so this is the one part of an edit that still
// needs the LLM.

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";
import { createLlm } from "@/lib/engine/factory";
import { generateStudy } from "@/lib/engine/study";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const db = adminDb();
  let caller;
  try {
    caller = await requireUser(req);
  } catch (err) {
    const e = err as HttpError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const ref = db.collection("analyses").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  const data = snap.data()!;
  if (data.uid !== caller.uid && !caller.admin) return NextResponse.json({ error: "Not your analysis." }, { status: 403 });
  const study = data.result?.study;
  if (!study) return NextResponse.json({ error: "This analysis has no financial study." }, { status: 400 });

  const userRef = db.collection("users").doc(caller.uid);
  let charged = false;
  try {
    charged = await db.runTransaction(async (tx) => {
      const u = (await tx.get(userRef)).data() as { credits?: number } | undefined;
      const credits = u?.credits ?? 0;
      if (credits < 1) throw new HttpError(402, "You're out of credits.");
      tx.update(userRef, { credits: credits - 1 });
      return true;
    });
  } catch (err) {
    const e = err as HttpError;
    return NextResponse.json({ error: e.message ?? "Not allowed" }, { status: e.status ?? 403 });
  }

  try {
    const llm = createLlm();
    const { study: fresh } = await generateStudy(llm, {
      input: data.input,
      model: study.model,
      stages: data.result.stages,
      riskScoring: data.result.riskScoring,
    });

    await ref.update({
      "result.study.narrative": fresh.narrative,
      "result.study.narrativeGeneratedAt": fresh.narrativeGeneratedAt,
    });
    await logAudit({ uid: caller.uid, email: caller.email, action: "analysis.regenerateNarrative", target: id });
    return NextResponse.json({ ok: true, narrative: fresh.narrative });
  } catch (err) {
    await Promise.allSettled([
      charged ? userRef.update({ credits: FieldValue.increment(1) }) : Promise.resolve(),
      logError("analysis.regenerateNarrative", err, { analysisId: id }),
    ]);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Regeneration failed" }, { status: 500 });
  }
}
