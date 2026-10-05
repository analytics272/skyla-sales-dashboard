import { test } from "node:test";
import assert from "node:assert/strict";
import { formatIndianCurrency } from "../lib/format/currency";

test("crore values truncate to 2 decimals instead of rounding up", () => {
  assert.equal(formatIndianCurrency(5_99_79_517), "5.99 Cr");
  assert.equal(formatIndianCurrency(59_889_810), "5.98 Cr");
});

test("exact values and float noise are preserved", () => {
  assert.equal(formatIndianCurrency(18_000_000), "1.80 Cr");
  assert.equal(formatIndianCurrency(24_000_000), "2.40 Cr");
  assert.equal(formatIndianCurrency(6_000_000), "60.00 L");
  assert.equal(formatIndianCurrency(1_46_46_610), "1.46 Cr");
});

test("lakh, thousand, sub-thousand and negatives", () => {
  assert.equal(formatIndianCurrency(5_945_482), "59.45 L");
  assert.equal(formatIndianCurrency(12_999), "12.99 K");
  assert.equal(formatIndianCurrency(999), "999.00");
  assert.equal(formatIndianCurrency(-5_99_79_517), "-5.99 Cr");
});
