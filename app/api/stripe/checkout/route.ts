// POST /api/stripe/checkout — start a Stripe Checkout session for either a
// one-time wallet top-up ($20/$50/$100 -> credits, minus our 20% take) or the
// Pro subscription. Returns the Checkout URL; the client redirects to it.

import { NextResponse } from "next/server";
import { stripe, WALLET_TIERS, creditsForTopup, type WalletTier } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";

export const runtime = "nodejs";

async function getOrCreateCustomer(uid: string, email?: string): Promise<string> {
  const ref = adminDb().collection("users").doc(uid);
  const snap = await ref.get();
  const existing = snap.data()?.stripeCustomerId as string | undefined;
  if (existing) return existing;

  const customer = await stripe().customers.create({ email, metadata: { uid } });
  await ref.set({ stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { kind, amount } = (await req.json()) as { kind: "wallet" | "subscription"; amount?: WalletTier };

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const customerId = await getOrCreateCustomer(caller.uid, caller.email);

    if (kind === "wallet") {
      if (!amount || !WALLET_TIERS.includes(amount)) throw new HttpError(400, "Invalid top-up amount.");
      const credits = creditsForTopup(amount);
      const session = await stripe().checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount * 100,
              product_data: { name: `FeasibilityAI wallet top-up — ${credits} credits` },
            },
            quantity: 1,
          },
        ],
        metadata: { uid: caller.uid, kind: "wallet", credits: String(credits) },
        success_url: `${origin}/app?topup=success`,
        cancel_url: `${origin}/app/new?topup=cancelled`,
      });
      await logAudit({ uid: caller.uid, email: caller.email, action: "billing.checkout_started", meta: { kind, amount, credits } });
      return NextResponse.json({ url: session.url });
    }

    if (kind === "subscription") {
      const priceId = process.env.STRIPE_PRO_PRICE_ID;
      if (!priceId) throw new HttpError(500, "Subscription plan is not configured yet.");
      const session = await stripe().checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { uid: caller.uid, kind: "subscription" },
        success_url: `${origin}/app?subscribed=success`,
        cancel_url: `${origin}/app/new?subscribed=cancelled`,
      });
      await logAudit({ uid: caller.uid, email: caller.email, action: "billing.checkout_started", meta: { kind } });
      return NextResponse.json({ url: session.url });
    }

    throw new HttpError(400, "Unknown checkout kind.");
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 500 });
  }
}
