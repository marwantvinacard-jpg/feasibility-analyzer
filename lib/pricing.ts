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

/** The single subscription plan. Created once via scripts/setup-stripe.mjs. */
export const PRO_PLAN = {
  name: "Pro",
  monthlyUsd: 29,
  creditsPerMonth: 20,
};
