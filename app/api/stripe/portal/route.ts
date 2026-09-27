// POST /api/stripe/portal — opens Stripe's own Customer Portal, where a user
// can cancel their subscription, update payment method, or view invoices
// without any of that logic needing to live in this app. Requires a
// stripeCustomerId already on the user doc (set the first time they ever
// start a checkout) — someone who's never paid has nothing to manage here.

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logError } from "@/lib/firebase/errorLog";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const snap = await adminDb().collection("users").doc(caller.uid).get();
    const customerId = snap.data()?.stripeCustomerId as string | undefined;
    if (!customerId) throw new HttpError(400, "No billing account yet — start a purchase first.");

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    await logError("stripe.portal", err);
    return NextResponse.json({ error: "Could not open the billing portal. Please try again." }, { status: 500 });
  }
}
