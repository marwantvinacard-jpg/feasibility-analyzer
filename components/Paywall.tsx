"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { getIdToken } from "@/lib/analyses";
import { WALLET_TIERS, creditsForTopup, PRO_PLAN, type WalletTier } from "@/lib/pricing";

/** Shown when a user is out of credits. Starts a real Stripe Checkout session. */
export function Paywall({ credits }: { credits: number }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function checkout(kind: "wallet" | "subscription", amount?: WalletTier) {
    setError("");
    setBusy(kind + (amount ?? ""));
    try {
      const token = await getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind, amount }),
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <Badge tone="warn" className="mb-3">Out of credits</Badge>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          You've used all {credits === 0 ? "your" : credits} free credits
        </h1>
        <p className="mt-1.5 text-sm text-muted">Top up your wallet, or subscribe for a steady monthly allowance.</p>
      </div>

      <div className="card p-5">
        <div className="label mb-3">Top up your wallet — pay once, use anytime</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {WALLET_TIERS.map((amount) => (
            <button
              key={amount}
              onClick={() => checkout("wallet", amount)}
              disabled={!!busy}
              className="rounded-xl border border-border bg-surface-2 p-4 text-center transition hover:border-brand/50 disabled:opacity-60"
            >
              <div className="num text-2xl font-semibold">${amount}</div>
              <div className="mt-1 text-xs text-muted">{creditsForTopup(amount)} credits</div>
              {busy === "wallet" + amount && <div className="mt-2 text-xs text-faint">Redirecting…</div>}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="label mb-1">{PRO_PLAN.name} subscription</div>
            <div className="text-sm text-muted">{PRO_PLAN.creditsPerMonth} credits every month, auto-renewing.</div>
          </div>
          <div className="text-right">
            <div className="num text-2xl font-semibold">${PRO_PLAN.monthlyUsd}</div>
            <div className="text-xs text-faint">/ month</div>
          </div>
        </div>
        <Button className="mt-4 w-full" onClick={() => checkout("subscription")} disabled={!!busy}>
          {busy === "subscription" ? "Redirecting…" : <>Subscribe to {PRO_PLAN.name} <Icon name="arrow" size={16} /></>}
        </Button>
      </div>

      {error && <p className="text-center text-sm text-stop">{error}</p>}
      <p className="text-center text-xs text-faint">Payments are processed securely by Stripe. Cancel your subscription anytime.</p>
    </div>
  );
}
