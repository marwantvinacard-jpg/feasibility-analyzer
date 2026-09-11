// One-time: create the Pro subscription Product + Price in your Stripe
// account, and print the Price ID to put in STRIPE_PRO_PRICE_ID.
//   STRIPE_SECRET_KEY=sk_... node scripts/setup-stripe.mjs
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("Set STRIPE_SECRET_KEY first."); process.exit(1); }
const stripe = new Stripe(key);

const product = await stripe.products.create({ name: "FeasibilityAI Pro", description: "20 analysis credits per month" });
const price = await stripe.prices.create({
  product: product.id,
  currency: "usd",
  unit_amount: 2900, // $29.00
  recurring: { interval: "month" },
});

console.log(`Product: ${product.id}`);
console.log(`Price:   ${price.id}`);
console.log(`\nAdd to .env.local and Vercel:\nSTRIPE_PRO_PRICE_ID=${price.id}`);
