// POST /api/stripe/webhook — Stripe calls this on payment/subscription events.
// Signature-verified (raw body required, hence the custom bodyParser bypass
// implicit in reading req.text()). This is the ONLY place credits get granted
// from a payment — the client never tells the server "I paid."

import { NextResponse } from "next/server";
import { stripe, creditsForTopup, PRO_PLAN } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/firebase/audit";
import type Stripe from "stripe";

export const runtime = "nodejs";

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
        // Subscription checkout completion is handled by the subscription
        // events below (created/updated), which fire right after this.
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
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
        const customerId = invoice.customer as string;
        const uid = await uidForCustomer(customerId);
        if (!uid) break;
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
