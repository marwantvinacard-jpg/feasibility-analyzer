// Client-safe pricing constants — no Stripe SDK import (that's server-only,
// see lib/stripe.ts). Shared by the paywall UI and the checkout/webhook routes.

/** Wallet top-up tiers offered in the UI, in whole USD. */
export const WALLET_TIERS = [20, 50, 100] as const;
export type WalletTier = (typeof WALLET_TIERS)[number];

/** Platform take-rate on wallet top-ups (we keep 20%, the rest buys credits). */
export const PLATFORM_FEE_PERCENT = 20;

/** USD price of one analysis credit, applied to the post-fee amount. */
export const USD_PER_CREDIT = 2;

/** How many credits a wallet top-up of `amountUsd` grants, after the platform fee. */
export function creditsForTopup(amountUsd: number): number {
  const net = amountUsd * (1 - PLATFORM_FEE_PERCENT / 100);
  return Math.floor(net / USD_PER_CREDIT);
}

/** The single individual subscription plan. Created once via scripts/setup-stripe.mjs. */
export const PRO_PLAN = {
  name: "Pro",
  monthlyUsd: 29,
  creditsPerMonth: 20,
};

/**
 * Organization (B2B) subscription tiers — what a feasibility company actually
 * buys. Same 20% platform take-rate baked into the included-credit pricing as
 * the individual wallet top-ups above (USD_PER_CREDIT already reflects it).
 * Stripe price IDs are created once via scripts/setup-stripe-org-plans.mjs.
 */
export interface OrgPlan {
  key: "starter" | "growth" | "enterprise";
  name: string;
  monthlyUsd: number;
  creditsPerMonth: number;
  seats: number | "unlimited";
  apiAccess: boolean;
  highlight?: boolean;
}

export const ORG_PLANS: OrgPlan[] = [
  { key: "starter", name: "Starter", monthlyUsd: 199, creditsPerMonth: 50, seats: 3, apiAccess: true },
  { key: "growth", name: "Growth", monthlyUsd: 499, creditsPerMonth: 150, seats: 10, apiAccess: true, highlight: true },
  { key: "enterprise", name: "Enterprise", monthlyUsd: 1499, creditsPerMonth: 500, seats: "unlimited", apiAccess: true },
];
