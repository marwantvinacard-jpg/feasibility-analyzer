// POST /api/stripe/checkout — start a Stripe Checkout session for either a
// one-time wallet top-up ($20/$50/$100 -> credits, minus our 20% take) or the
// Pro subscription. Returns the Checkout URL; the client redirects to it.

import { NextResponse } from "next/server";
import { stripe, WALLET_TIERS, creditsForTopup, ORG_PLANS, type WalletTier } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { logAudit } from "@/lib/firebase/audit";
import type { OrgPlanKey } from "@/lib/orgTypes";
import { EXPORT_UNLOCK_PRICE_USD, isExportExempt } from "@/lib/exportAccess";
import { logError } from "@/lib/firebase/errorLog";

export const runtime = "nodejs";

/** Subscription states that count as "already subscribed". */
const LIVE_SUBSCRIPTION: unknown[] = ["active", "trialing", "past_due", "incomplete"];

async function getOrCreateCustomer(uid: string, email?: string): Promise<string> {
  const ref = adminDb().collection("users").doc(uid);
  const snap = await ref.get();
  const existing = snap.data()?.stripeCustomerId as string | undefined;
  if (existing) {
    // A stored customer can stop existing in Stripe (switching test -> live
    // keys, a deleted customer). That used to make every checkout fail with
    // "No such customer" — create a fresh one instead.
    const found = await stripe()
      .customers.retrieve(existing)
      .catch((e: { code?: string }) => (e?.code === "resource_missing" ? null : Promise.reject(e)));
    if (found && !("deleted" in found && found.deleted)) return existing;
  }

  const customer = await stripe().customers.create({ email, metadata: { uid } });
  await ref.set({ stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
}

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { kind, amount, planKey, analysisId, cycle } = (await req.json()) as {
      kind: "wallet" | "subscription" | "org_plan" | "unlock_export";
      amount?: WalletTier;
      planKey?: OrgPlanKey;
      analysisId?: string;
      cycle?: "monthly" | "annual";
    };

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    // Looked up only once a purchase has passed its checks (not for refused ones).
    const customer = () => getOrCreateCustomer(caller.uid, caller.email);

    if (kind === "wallet") {
      if (!amount || !WALLET_TIERS.includes(amount)) throw new HttpError(400, "Invalid top-up amount.");
      const credits = creditsForTopup(amount);
      const session = await stripe().checkout.sessions.create({
        mode: "payment",
        customer: await customer(),
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
      // One live subscription per user — a double click (or "upgrading" through
      // checkout) used to create two, both billed.
      const status = (await adminDb().collection("users").doc(caller.uid).get()).data()?.subscriptionStatus;
      if (LIVE_SUBSCRIPTION.includes(status)) {
        throw new HttpError(409, "You already have an active Pro subscription.");
      }
      const priceId = process.env.STRIPE_PRO_PRICE_ID;
      if (!priceId) throw new HttpError(500, "Subscription plan is not configured yet.");
      const session = await stripe().checkout.sessions.create({
        mode: "subscription",
        customer: await customer(),
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { uid: caller.uid, kind: "subscription" },
        // Copied onto the Subscription so invoice webhooks can find the user
        // even if the customer -> user mapping is ever missing.
        subscription_data: { metadata: { uid: caller.uid, kind: "subscription" } },
        success_url: `${origin}/app?subscribed=success`,
        cancel_url: `${origin}/app/new?subscribed=cancelled`,
      });
      await logAudit({ uid: caller.uid, email: caller.email, action: "billing.checkout_started", meta: { kind } });
      return NextResponse.json({ url: session.url });
    }

    if (kind === "org_plan") {
      const plan = ORG_PLANS.find((p) => p.key === planKey);
      if (!plan) throw new HttpError(400, "Unknown plan.");

      const db = adminDb();
      const userSnap = await db.collection("users").doc(caller.uid).get();
      const orgId = userSnap.data()?.orgId as string | undefined;
      if (!orgId) throw new HttpError(404, "No organization found.");
      const orgSnap = await db.collection("organizations").doc(orgId).get();
      if (!orgSnap.exists) throw new HttpError(404, "No organization found.");
      if (orgSnap.data()?.ownerUid !== caller.uid) throw new HttpError(403, "Only the owner can change the plan.");
      if (LIVE_SUBSCRIPTION.includes(orgSnap.data()?.subscriptionStatus)) {
        throw new HttpError(409, "Your organization already has an active plan. Contact us to change plans.");
      }
      if (orgSnap.data()?.status !== "approved") {
        throw new HttpError(403, "Your organization must be approved before subscribing to a plan.");
      }

      const billingCycle = cycle === "annual" ? "annual" : "monthly";
      const priceEnvKey =
        billingCycle === "annual"
          ? `STRIPE_ORG_${plan.key.toUpperCase()}_ANNUAL_PRICE_ID`
          : `STRIPE_ORG_${plan.key.toUpperCase()}_PRICE_ID`;
      const priceId = process.env[priceEnvKey];
      if (!priceId) throw new HttpError(500, `The ${plan.name} plan (${billingCycle}) is not configured yet (${priceEnvKey}).`);

      // First-ever subscription for this org gets a 14-day free trial. Marking
      // trialUsed the moment the trial is offered (not only on completion)
      // keeps this un-exploitable via cancel-and-resubscribe.
      const eligibleForTrial = !orgSnap.data()?.trialUsed;
      if (eligibleForTrial) await db.collection("organizations").doc(orgId).update({ trialUsed: true });

      const session = await stripe().checkout.sessions.create({
        mode: "subscription",
        customer: await customer(),
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { uid: caller.uid, kind: "org_plan", orgId, planKey: plan.key, cycle: billingCycle },
        // Checkout session metadata isn't reliably copied onto the resulting
        // Subscription object — set it explicitly so the webhook can find
        // orgId/planKey from subscription and invoice events, not just this
        // one checkout.session.completed event.
        subscription_data: {
          metadata: { uid: caller.uid, kind: "org_plan", orgId, planKey: plan.key, cycle: billingCycle },
          ...(eligibleForTrial ? { trial_period_days: 14 } : {}),
        },
        success_url: `${origin}/app/org?subscribed=success`,
        cancel_url: `${origin}/app/org?subscribed=cancelled`,
      });
      await logAudit({ uid: caller.uid, email: caller.email, action: "billing.checkout_started", meta: { kind, planKey, orgId, cycle: billingCycle } });
      return NextResponse.json({ url: session.url });
    }

    if (kind === "unlock_export") {
      if (!analysisId) throw new HttpError(400, "analysisId is required.");
      if (isExportExempt({ email: caller.email, role: caller.admin ? "admin" : undefined })) {
        throw new HttpError(400, "This account already has free export — no payment needed.");
      }

      const db = adminDb();
      const analysisRef = db.collection("analyses").doc(analysisId);
      const analysisSnap = await analysisRef.get();
      if (!analysisSnap.exists) throw new HttpError(404, "Analysis not found.");
      if (analysisSnap.data()?.uid !== caller.uid) throw new HttpError(403, "You don't own this analysis.");
      if (analysisSnap.data()?.exportUnlocked) throw new HttpError(400, "This study's export is already unlocked.");

      const session = await stripe().checkout.sessions.create({
        mode: "payment",
        customer: await customer(),
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: EXPORT_UNLOCK_PRICE_USD * 100,
              product_data: { name: "FeasibilityAI — full study export unlock" },
            },
            quantity: 1,
          },
        ],
        metadata: { uid: caller.uid, kind: "unlock_export", analysisId },
        success_url: `${origin}/app/analysis/${analysisId}?export=success`,
        cancel_url: `${origin}/app/analysis/${analysisId}?export=cancelled`,
      });
      await logAudit({ uid: caller.uid, email: caller.email, action: "billing.checkout_started", meta: { kind, analysisId } });
      return NextResponse.json({ url: session.url });
    }

    throw new HttpError(400, "Unknown checkout kind.");
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    // Stripe's raw error text (internal ids, config details) stays in our logs.
    await logError("stripe.checkout", err).catch(() => {});
    return NextResponse.json({ error: "Checkout couldn't be started. Please try again." }, { status: 500 });
  }
}
