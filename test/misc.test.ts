import { test } from "node:test";
import assert from "node:assert/strict";
import { currencySymbol, CURRENCIES } from "@/lib/currencies";
import { isExportExempt, EXPORT_UNLOCK_PRICE_USD } from "@/lib/exportAccess";

test("currencySymbol: known codes resolve to their real symbol", () => {
  assert.equal(currencySymbol("USD"), "$");
  assert.equal(currencySymbol("SAR"), "﷼");
  assert.equal(currencySymbol("TND"), "د.ت");
});

test("currencySymbol: unknown code falls back to the code itself, never crashes", () => {
  assert.equal(currencySymbol("ZZZ"), "ZZZ");
  assert.equal(currencySymbol(undefined), "$");
});

test("currencySymbol: the list covers at least 100 currencies with unique codes", () => {
  assert.ok(CURRENCIES.length >= 100);
  const codes = new Set(CURRENCIES.map((c) => c.code));
  assert.equal(codes.size, CURRENCIES.length, "currency codes should be unique");
});

test("isExportExempt: the 3 named accounts are exempt, everyone else pays", () => {
  assert.equal(isExportExempt({ email: "sophie@feasibility.local" }), true);
  assert.equal(isExportExempt({ email: "tarek@feasibility.local" }), true);
  assert.equal(isExportExempt({ email: "marwan@feasibility.local" }), true);
  assert.equal(isExportExempt({ email: "SOPHIE@feasibility.local" }), true); // case-insensitive
  assert.equal(isExportExempt({ role: "admin", email: "anyone@else.com" }), true); // any admin
  assert.equal(isExportExempt({ email: "random@buyer.com" }), false);
  assert.equal(isExportExempt(null), false);
  assert.equal(isExportExempt(undefined), false);
});

test("EXPORT_UNLOCK_PRICE_USD: matches the agreed $3,000 price point", () => {
  assert.equal(EXPORT_UNLOCK_PRICE_USD, 3000);
});
