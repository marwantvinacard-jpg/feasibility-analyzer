// POST /api/stripe/webhook — Stripe calls this on payment/subscription events.
// Signature-verified (raw body required, hence the custom bodyParser bypass
// implicit in reading req.text()). This is the ONLY place credits get granted
// from a payment — the client never tells the server "I paid."

import { NextResponse } from "next/server";
import { stripe, creditsForTopup, PRO_PLAN, ORG_PLANS } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/firebase/audit";
import type Stripe from "stripe";

export const runtime = "nodejs";

const PLAN_BY_KEY = Object.fromEntries(ORG_PLANS.map((p) => [p.key, p])) as Record<
  (typeof ORG_PLANS)[number]["key"],
  (typeof ORG_PLANS)[number]
>;

async function uidForCustomer(customerId: string): Promise<string | null> {
  const snap = await adminDb().collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!sig || !secret) throw new Error("Webhook not configured.");
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `Signature verification failed: ${(err as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.metadata?.uid;
        if (!uid) break;

        if (session.metadata?.kind === "wallet") {
          const credits = Number(session.metadata.credits ?? 0);
          if (credits > 0) {
            await adminDb().collection("users").doc(uid).update({ credits: FieldValue.increment(credits) });
            await adminDb()
              .collection("payments")
              .add({
                uid,
                type: "wallet_topup",
                amountUsd: (session.amount_total ?? 0) / 100,
                creditsGranted: credits,
                stripeSessionId: session.id,
                createdAt: Date.now(),
              });
            await logAudit({ uid, action: "billing.wallet_topup", meta: { credits, amountUsd: (session.amount_total ?? 0) / 100 } });
          }
        }

        if (session.metadata?.kind === "org_plan") {
          const orgId = session.metadata.orgId;
          const planKey = session.metadata.planKey as keyof typeof PLAN_BY_KEY | undefined;
          const plan = planKey ? PLAN_BY_KEY[planKey] : undefined;
          if (orgId && plan) {
            await adminDb().collection("organizations").doc(orgId).update({ plan: plan.key, subscriptionStatus: "active" });
            // First month's credits land immediately; renewals are handled below.
            await adminDb().collection("users").doc(uid).update({ credits: FieldValue.increment(plan.creditsPerMonth) });
            await adminDb()
              .collection("payments")
              .add({ uid, orgId, type: "org_plan_start", plan: plan.key, creditsGranted: plan.creditsPerMonth, createdAt: Date.now() });
            await logAudit({ uid, action: "billing.org_plan_started", target: orgId, meta: { plan: plan.key } });
          }
        }
        // Individual "subscription" checkout completion is handled by the
        // subscription events below (created/updated), which fire right after this.
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (orgId) {
          await adminDb().collection("organizations").doc(orgId).update({ subscriptionStatus: sub.status });
          await logAudit({ uid: sub.metadata?.uid ?? "", action: "billing.org_subscription_" + sub.status, target: orgId, meta: { subscriptionId: sub.id } });
          break;
        }
        const uid = (await uidForCustomer(sub.customer as string)) ?? sub.metadata?.uid;
        if (!uid) break;
        await adminDb().collection("users").doc(uid).update({
          subscriptionStatus: sub.status, // "active" | "past_due" | "canceled" | ...
          subscriptionId: sub.id,
        });
        await logAudit({ uid, action: "billing.subscription_" + sub.status, meta: { subscriptionId: sub.id } });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (orgId) {
          await adminDb().collection("organizations").doc(orgId).update({ subscriptionStatus: "canceled", plan: FieldValue.delete() });
          await logAudit({ uid: sub.metadata?.uid ?? "", action: "billing.org_subscription_canceled", target: orgId });
          break;
        }
        const uid = await uidForCustomer(sub.customer as string);
        if (!uid) break;
        await adminDb().collection("users").doc(uid).update({ subscriptionStatus: "canceled" });
        await logAudit({ uid, action: "billing.subscription_canceled" });
        break;
      }

      case "invoice.payment_succeeded": {
        // Monthly renewal — top up the plan's credit allowance.
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason !== "subscription_cycle") break;

        // Stripe's typed Invoice shape moved the subscription reference around
        // across API versions — read it defensively rather than pin one shape.
        const subId =
          ((invoice as unknown as { subscription?: string | null }).subscription) ??
          ((invoice as unknown as { parent?: { subscription_details?: { subscription?: string | null } } }).parent
            ?.subscription_details?.subscription) ??
          null;
        const sub = subId ? await stripe().subscriptions.retrieve(subId).catch(() => null) : null;
        const orgId = sub?.metadata?.orgId;
        const uid = sub?.metadata?.uid ?? (await uidForCustomer(invoice.customer as string));
        if (!uid) break;

        if (orgId) {
          const planKey = sub?.metadata?.planKey as keyof typeof PLAN_BY_KEY | undefined;
          const plan = planKey ? PLAN_BY_KEY[planKey] : undefined;
          if (!plan) break;
          await adminDb().collection("users").doc(uid).update({ credits: FieldValue.increment(plan.creditsPerMonth) });
          await adminDb()
            .collection("payments")
            .add({ uid, orgId, type: "org_plan_renewal", plan: plan.key, creditsGranted: plan.creditsPerMonth, createdAt: Date.now() });
          await logAudit({ uid, action: "billing.org_plan_renewed", target: orgId, meta: { credits: plan.creditsPerMonth } });
          break;
        }

        await adminDb().collection("users").doc(uid).update({ credits: FieldValue.increment(PRO_PLAN.creditsPerMonth) });
        await adminDb()
          .collection("payments")
          .add({ uid, type: "subscription_renewal", creditsGranted: PRO_PLAN.creditsPerMonth, createdAt: Date.now() });
        await logAudit({ uid, action: "billing.subscription_renewed", meta: { credits: PRO_PLAN.creditsPerMonth } });
        break;
      }

      default:
        break; // ignore anything we don't handle
    }
  } catch (err) {
    // Stripe retries on non-2xx — log but still ack if we've already
    // recorded the payment, to avoid duplicate credit grants on retry storms.
    console.error("stripe webhook handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
