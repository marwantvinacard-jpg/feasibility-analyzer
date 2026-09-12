import { test } from "node:test";
import assert from "node:assert/strict";
import { creditsForTopup, PLATFORM_FEE_PERCENT, USD_PER_CREDIT, WALLET_TIERS, ORG_PLANS } from "@/lib/pricing";

test("creditsForTopup: applies exactly the documented 20% platform fee", () => {
  assert.equal(PLATFORM_FEE_PERCENT, 20);
  // $20 in, 20% fee -> $16 net -> /$2 per credit -> 8 credits
  assert.equal(creditsForTopup(20), Math.floor((20 * 0.8) / USD_PER_CREDIT));
  assert.equal(creditsForTopup(50), Math.floor((50 * 0.8) / USD_PER_CREDIT));
  assert.equal(creditsForTopup(100), Math.floor((100 * 0.8) / USD_PER_CREDIT));
});

test("creditsForTopup: every wallet tier yields a positive whole number of credits", () => {
  for (const tier of WALLET_TIERS) {
    const credits = creditsForTopup(tier);
    assert.ok(Number.isInteger(credits) && credits > 0, `tier $${tier} yielded ${credits} credits`);
  }
});

test("ORG_PLANS: exactly 3 tiers, strictly increasing price and credits", () => {
  assert.equal(ORG_PLANS.length, 3);
  for (let i = 1; i < ORG_PLANS.length; i++) {
    assert.ok(ORG_PLANS[i].monthlyUsd > ORG_PLANS[i - 1].monthlyUsd, "plans should be priced in ascending order");
    assert.ok(ORG_PLANS[i].creditsPerMonth > ORG_PLANS[i - 1].creditsPerMonth, "higher tiers should include more credits");
  }
  assert.ok(ORG_PLANS.every((p) => p.apiAccess), "every org plan should include API access");
});
