// One-time: create the 3 organization subscription Products + Prices (both
// monthly and annual — 2 months free — recurring intervals) in your Stripe
// account, and print the Price IDs to put in .env.local.
//   STRIPE_SECRET_KEY=sk_... node scripts/setup-stripe-org-plans.mjs
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("Set STRIPE_SECRET_KEY first."); process.exit(1); }
const stripe = new Stripe(key);

// Keep in sync with lib/pricing.ts ORG_PLANS / annualUsd().
const ANNUAL_DISCOUNT_MONTHS = 2;
const PLANS = [
  { key: "starter", name: "FeasibilityAI Starter (Org)", monthlyUsd: 199, creditsPerMonth: 50 },
  { key: "growth", name: "FeasibilityAI Growth (Org)", monthlyUsd: 499, creditsPerMonth: 150 },
  { key: "enterprise", name: "FeasibilityAI Enterprise (Org)", monthlyUsd: 1499, creditsPerMonth: 500 },
];

console.log("Creating organization plan products + prices (monthly + annual)…\n");
const lines = [];
for (const plan of PLANS) {
  const product = await stripe.products.create({
    name: plan.name,
    description: `${plan.creditsPerMonth} analysis credits per month`,
  });
  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: plan.monthlyUsd * 100,
    recurring: { interval: "month" },
  });
  const annualPrice = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: plan.monthlyUsd * (12 - ANNUAL_DISCOUNT_MONTHS) * 100,
    recurring: { interval: "year" },
  });
  console.log(`${plan.name}: product=${product.id} monthly=${monthlyPrice.id} annual=${annualPrice.id}`);
  lines.push(`STRIPE_ORG_${plan.key.toUpperCase()}_PRICE_ID=${monthlyPrice.id}`);
  lines.push(`STRIPE_ORG_${plan.key.toUpperCase()}_ANNUAL_PRICE_ID=${annualPrice.id}`);
}

console.log("\nAdd these to .env.local and Vercel:\n");
console.log(lines.join("\n"));
