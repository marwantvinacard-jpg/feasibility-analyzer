// POST /api/stripe/webhook — Stripe calls this on payment/subscription events.
// Signature-verified (raw body required, hence the custom bodyParser bypass
// implicit in reading req.text()). This is the ONLY place credits get granted
// from a payment — the client never tells the server "I paid."

import { NextResponse } from "next/server";
import { stripe, creditsForTopup, PRO_PLAN, ORG_PLANS, orgTrialCredits } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { logAudit } from "@/lib/firebase/audit";
import { logError } from "@/lib/firebase/errorLog";
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

  // Idempotency: Stripe redelivers on any non-2xx response (and can occasionally
  // redeliver even after a 2xx), and a captured signed payload could be replayed
  // within its timestamp tolerance. Without this guard a retry after a partial
  // failure — or a replay — would grant credits twice for the same event.
  const eventRef = adminDb().collection("processedStripeEvents").doc(event.id);
  const alreadyProcessed = await eventRef.get().then((s) => s.exists);
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, deduped: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.async_payment_failed": {
        // A bank transfer / debit that was pending at checkout didn't go through.
        const session = event.data.object as Stripe.Checkout.Session;
        await logAudit({ uid: session.metadata?.uid ?? "", action: "billing.async_payment_failed", meta: { kind: session.metadata?.kind, sessionId: session.id } });
        break;
      }

      // Slower payment methods (SEPA, ACH…) complete checkout while still
      // "unpaid" and send async_payment_succeeded once the money arrives. Grants
      // happen only when paid — they used to happen at checkout regardless.
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.metadata?.uid;
        if (!uid) break;
        const paid = session.payment_status === "paid";

        if (session.metadata?.kind === "wallet" && paid) {
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

        if (session.metadata?.kind === "unlock_export" && paid) {
          const analysisId = session.metadata.analysisId;
          const analysisRef = analysisId ? adminDb().collection("analyses").doc(analysisId) : null;
          if (analysisRef && !(await analysisRef.get()).exists) {
            // Paid for a study that was deleted meanwhile: record the payment and
            // flag it for a refund, instead of failing (and being retried) forever.
            await adminDb().collection("payments").add({
              uid,
              type: "export_unlock",
              analysisId,
              amountUsd: (session.amount_total ?? 0) / 100,
              stripeSessionId: session.id,
              needsRefund: true,
              note: "The analysis was deleted before the unlock was applied.",
              createdAt: Date.now(),
            });
            await logError("stripe.unlockDeletedAnalysis", new Error("Export unlock paid for a deleted analysis — refund it"), { uid, analysisId, sessionId: session.id });
          } else if (analysisRef) {
            await analysisRef.update({ exportUnlocked: true });
            await adminDb()
              .collection("payments")
              .add({
                uid,
                type: "export_unlock",
                analysisId,
                amountUsd: (session.amount_total ?? 0) / 100,
                stripeSessionId: session.id,
                createdAt: Date.now(),
              });
            await logAudit({ uid, action: "billing.export_unlocked", target: analysisId, meta: { amountUsd: (session.amount_total ?? 0) / 100 } });
          }
        }

        if (session.metadata?.kind === "org_plan") {
          const orgId = session.metadata.orgId;
          const planKey = session.metadata.planKey as keyof typeof PLAN_BY_KEY | undefined;
          const plan = planKey ? PLAN_BY_KEY[planKey] : undefined;
          if (orgId && plan) {
            // Paid now → the first month's credits. Free trial (nothing charged)
            // → a small trial allowance only; the full month arrives with the
            // first real payment at the end of the trial (a subscription_cycle
            // invoice, handled below like any renewal).
            const paidNow = paid && (session.amount_total ?? 0) > 0;
            const isTrial = session.payment_status === "no_payment_required";
            // Paid by a slow method that hasn't cleared yet: grant nothing now;
            // the first invoice being paid (below) grants the month.
            if (!paidNow && !isTrial) break;
            const credits = paidNow ? plan.creditsPerMonth : orgTrialCredits(plan);
            await adminDb()
              .collection("organizations")
              .doc(orgId)
              .update({ plan: plan.key, subscriptionStatus: paidNow ? "active" : "trialing", ...(paidNow ? { firstMonthGranted: true } : {}) });
            await adminDb().collection("users").doc(uid).update({ credits: FieldValue.increment(credits) });
            await adminDb()
              .collection("payments")
              .add({
                uid,
                orgId,
                type: paidNow ? "org_plan_start" : "org_plan_trial",
                plan: plan.key,
                amountUsd: (session.amount_total ?? 0) / 100,
                creditsGranted: credits,
                createdAt: Date.now(),
              });
            await logAudit({
              uid,
              action: paidNow ? "billing.org_plan_started" : "billing.org_trial_started",
              target: orgId,
              meta: { plan: plan.key, credits },
            });
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
        // Top up the plan's monthly credit allowance: on each renewal, and —
        // for Pro — on the FIRST paid invoice too. Pro used to wait for the
        // first renewal, so a new subscriber paid and got 0 credits for a month.
        // A $0 first invoice (a trial) grants nothing.
        const invoice = event.data.object as Stripe.Invoice;
        const isRenewal = invoice.billing_reason === "subscription_cycle";
        const isFirstPayment = invoice.billing_reason === "subscription_create" && (invoice.amount_paid ?? 0) > 0;
        if (!isRenewal && !isFirstPayment) break;

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
          // An org's first month is normally granted at checkout (above). Only if
          // that checkout was paid by a method that cleared later does the first
          // invoice grant it — once, tracked by firstMonthGranted.
          if (!isRenewal) {
            const orgRef = adminDb().collection("organizations").doc(orgId);
            const granted = await adminDb().runTransaction(async (tx) => {
              const org = await tx.get(orgRef);
              if (!org.exists || org.data()?.firstMonthGranted) return false;
              tx.update(orgRef, { firstMonthGranted: true, subscriptionStatus: "active" });
              return true;
            });
            if (!granted) break;
          }
          const planKey = sub?.metadata?.planKey as keyof typeof PLAN_BY_KEY | undefined;
          const plan = planKey ? PLAN_BY_KEY[planKey] : undefined;
          if (!plan) break;
          await adminDb().collection("users").doc(uid).update({ credits: FieldValue.increment(plan.creditsPerMonth) });
          await adminDb()
            .collection("payments")
            .add({
              uid,
              orgId,
              type: isRenewal ? "org_plan_renewal" : "org_plan_start",
              plan: plan.key,
              amountUsd: (invoice.amount_paid ?? 0) / 100,
              creditsGranted: plan.creditsPerMonth,
              createdAt: Date.now(),
            });
          await logAudit({ uid, action: isRenewal ? "billing.org_plan_renewed" : "billing.org_plan_started", target: orgId, meta: { credits: plan.creditsPerMonth } });
          break;
        }

        await adminDb().collection("users").doc(uid).update({ credits: FieldValue.increment(PRO_PLAN.creditsPerMonth) });
        await adminDb()
          .collection("payments")
          .add({
            uid,
            type: isRenewal ? "subscription_renewal" : "subscription_start",
            amountUsd: (invoice.amount_paid ?? 0) / 100,
            creditsGranted: PRO_PLAN.creditsPerMonth,
            stripeInvoiceId: invoice.id,
            createdAt: Date.now(),
          });
        await logAudit({
          uid,
          action: isRenewal ? "billing.subscription_renewed" : "billing.subscription_started",
          meta: { credits: PRO_PLAN.creditsPerMonth },
        });
        break;
      }

      default:
        break; // ignore anything we don't handle
    }
  } catch (err) {
    // Stripe retries on non-2xx, which is exactly what we want on a genuine
    // failure — don't mark the event processed, so the retry can complete it.
    await logError("stripe.webhook", err, { eventType: event.type, eventId: event.id });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  // Only mark processed after the handler above completed without throwing —
  // this is what makes the dedupe check at the top safe.
  await eventRef.set({ type: event.type, processedAt: Date.now() });

  return NextResponse.json({ received: true });
}
