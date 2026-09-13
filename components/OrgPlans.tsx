"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { getIdToken } from "@/lib/analyses";
import { ORG_PLANS, PLATFORM_FEE_PERCENT, annualUsd, ANNUAL_DISCOUNT_MONTHS, type OrgPlan, type BillingCycle } from "@/lib/pricing";
import { cn } from "@/lib/ui";

export const PLAN_LABEL: Record<OrgPlan["key"], string> = Object.fromEntries(
  ORG_PLANS.map((p) => [p.key, p.name])
) as Record<OrgPlan["key"], string>;

/** The 3 organization subscription tiers, with a real Stripe Checkout per plan. */
export function OrgPlans({ currentPlan, trialUsed }: { currentPlan?: OrgPlan["key"]; trialUsed?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  async function subscribe(planKey: OrgPlan["key"]) {
    setError("");
    setBusy(planKey);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: "org_plan", planKey, cycle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
      setBusy(null);
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Plans</h2>
        <span className="text-xs text-faint">Includes a {PLATFORM_FEE_PERCENT}% platform fee on credits, same as individual accounts</span>
      </div>
      <p className="text-sm text-muted">
        Credits cover both web-app analyses and API calls from the same pool. Buy more anytime from the wallet in
        Settings once subscribed.
      </p>
      {!trialUsed && !currentPlan && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-go/30 bg-go/8 px-3 py-2 text-sm text-go">
          <Icon name="spark" size={15} /> <strong>First plan starts with a 14-day free trial</strong> — cancel anytime before it ends and you won't be charged.
        </div>
      )}
      <div className="mt-4 inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
        <button
          onClick={() => setCycle("monthly")}
          className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", cycle === "monthly" ? "bg-brand text-white" : "text-muted hover:text-ink")}
        >
          Monthly
        </button>
        <button
          onClick={() => setCycle("annual")}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", cycle === "annual" ? "bg-brand text-white" : "text-muted hover:text-ink")}
        >
          Annual
          <span className={cn("rounded-full px-1.5 py-0.5 text-[0.65rem]", cycle === "annual" ? "bg-white/20" : "bg-go/15 text-go")}>
            {ANNUAL_DISCOUNT_MONTHS} months free
          </span>
        </button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {ORG_PLANS.map((plan) => {
          const active = currentPlan === plan.key;
          return (
            <div
              key={plan.key}
              className={cn(
                "flex flex-col rounded-xl border p-4",
                plan.highlight ? "border-brand ring-1 ring-brand" : "border-border",
                active && "bg-brand/5"
              )}
            >
              {plan.highlight && !active && <Badge tone="go" className="mb-2 self-start">Most popular</Badge>}
              {active && <Badge tone="go" className="mb-2 self-start">Current plan</Badge>}
              <div className="font-semibold">{plan.name}</div>
              {cycle === "monthly" ? (
                <div className="mt-1 num text-2xl font-semibold">
                  ${plan.monthlyUsd}<span className="text-sm font-normal text-faint"> /mo</span>
                </div>
              ) : (
                <div className="mt-1">
                  <div className="num text-2xl font-semibold">
                    ${Math.round(annualUsd(plan.monthlyUsd) / 12)}<span className="text-sm font-normal text-faint"> /mo</span>
                  </div>
                  <div className="text-xs text-faint">${annualUsd(plan.monthlyUsd)} billed annually</div>
                </div>
              )}
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted">
                <li className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-go" /> {plan.creditsPerMonth} credits / month</li>
                <li className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-go" /> {plan.seats === "unlimited" ? "Unlimited" : `Up to ${plan.seats}`} team seats</li>
                {plan.apiAccess && <li className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-go" /> API access included</li>}
              </ul>
              <Button
                variant={active ? "ghost" : "primary"}
                className="mt-4 w-full text-sm"
                onClick={() => subscribe(plan.key)}
                disabled={!!busy || active}
              >
                {active ? "Active" : busy === plan.key ? "Redirecting…" : "Choose plan"}
              </Button>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-center text-sm text-stop">{error}</p>}
    </div>
  );
}
