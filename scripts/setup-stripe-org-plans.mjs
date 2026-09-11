// One-time: create the 3 organization subscription Products + Prices in your
// Stripe account, and print the Price IDs to put in .env.local.
//   STRIPE_SECRET_KEY=sk_... node scripts/setup-stripe-org-plans.mjs
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("Set STRIPE_SECRET_KEY first."); process.exit(1); }
const stripe = new Stripe(key);

// Keep in sync with lib/pricing.ts ORG_PLANS.
const PLANS = [
  { key: "starter", name: "FeasibilityAI Starter (Org)", monthlyUsd: 199, creditsPerMonth: 50 },
  { key: "growth", name: "FeasibilityAI Growth (Org)", monthlyUsd: 499, creditsPerMonth: 150 },
  { key: "enterprise", name: "FeasibilityAI Enterprise (Org)", monthlyUsd: 1499, creditsPerMonth: 500 },
];

console.log("Creating organization plan products + prices…\n");
const lines = [];
for (const plan of PLANS) {
  const product = await stripe.products.create({
    name: plan.name,
    description: `${plan.creditsPerMonth} analysis credits per month`,
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: plan.monthlyUsd * 100,
    recurring: { interval: "month" },
  });
  const envKey = `STRIPE_ORG_${plan.key.toUpperCase()}_PRICE_ID`;
  console.log(`${plan.name}: product=${product.id} price=${price.id}`);
  lines.push(`${envKey}=${price.id}`);
}

console.log("\nAdd these to .env.local and Vercel:\n");
console.log(lines.join("\n"));
