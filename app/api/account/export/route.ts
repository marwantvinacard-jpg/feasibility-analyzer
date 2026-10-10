// GET /api/account/export — everything we hold about the caller, as a JSON
// download (the "right of access" in the Privacy Policy). A saved AI key is
// described (provider + last 4) but never included.

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";

export const runtime = "nodejs";
export const maxDuration = 120;

const rows = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

export async function GET(req: Request) {
  try {
    const caller = await requireUser(req);
    const db = adminDb();
    const userRef = db.collection("users").doc(caller.uid);
    const [user, key, analyses, payments, invites, training] = await Promise.all([
      userRef.get(),
      userRef.collection("secrets").doc("llm").get(),
      db.collection("analyses").where("uid", "==", caller.uid).get(),
      db.collection("payments").where("uid", "==", caller.uid).get(),
      db.collection("orgInvites").where("uid", "==", caller.uid).get(),
      db.collection("trainingData").where("uid", "==", caller.uid).get(),
    ]);

    const analysesWithScenarios = await Promise.all(
      analyses.docs.map(async (d) => ({ id: d.id, ...d.data(), scenarios: rows(await d.ref.collection("scenarios").get()) }))
    );
    const orgId = user.data()?.orgId as string | undefined;
    const org = orgId ? (await db.collection("organizations").doc(orgId).get()).data() : undefined;
    const membership = orgId ? (await db.collection("organizations").doc(orgId).collection("members").doc(caller.uid).get()).data() : undefined;

    const exported = {
      exportedAt: new Date().toISOString(),
      account: { uid: caller.uid, email: caller.email, ...user.data() },
      ownAiKey: key.exists ? { provider: key.data()?.provider, last4: key.data()?.last4, note: "The key itself is never exported." } : null,
      organization: org ? { id: orgId, name: org.name, role: membership?.role ?? null } : null,
      analyses: analysesWithScenarios,
      payments: rows(payments),
      invitations: rows(invites),
      trainingData: rows(training),
    };

    await logAudit({ uid: caller.uid, email: caller.email, action: "account.exported" }).catch(() => {});
    return new NextResponse(JSON.stringify(exported, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="feasibilityai-data-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Couldn't prepare your data. Please try again." }, { status: 500 });
  }
}
