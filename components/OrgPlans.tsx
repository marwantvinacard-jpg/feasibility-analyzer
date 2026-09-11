"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { getIdToken } from "@/lib/analyses";
import { ORG_PLANS, PLATFORM_FEE_PERCENT, type OrgPlan } from "@/lib/pricing";
import { cn } from "@/lib/ui";

export const PLAN_LABEL: Record<OrgPlan["key"], string> = Object.fromEntries(
  ORG_PLANS.map((p) => [p.key, p.name])
) as Record<OrgPlan["key"], string>;

/** The 3 organization subscription tiers, with a real Stripe Checkout per plan. */
export function OrgPlans({ currentPlan }: { currentPlan?: OrgPlan["key"] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function subscribe(planKey: OrgPlan["key"]) {
    setError("");
    setBusy(planKey);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: "org_plan", planKey }),
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
              <div className="mt-1 num text-2xl font-semibold">
                ${plan.monthlyUsd}<span className="text-sm font-normal text-faint"> /mo</span>
              </div>
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
