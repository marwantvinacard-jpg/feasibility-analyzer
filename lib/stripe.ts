// Stripe server client. Server-only — never import from a client component
// (this pulls in the Stripe Node SDK). Pricing constants live in lib/pricing.ts
// (client-safe) and are re-exported here for convenience in server routes.
import Stripe from "stripe";

export {
  WALLET_TIERS,
  creditsForTopup,
  PRO_PLAN,
  ORG_PLANS,
  PLATFORM_FEE_PERCENT,
  USD_PER_CREDIT,
  type WalletTier,
  type OrgPlan,
} from "./pricing";

let stripeClient: Stripe | null = null;
export function stripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}
