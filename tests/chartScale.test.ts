import { test } from "node:test";
import assert from "node:assert/strict";
import { revenueTrendScale } from "../lib/format/chartScale";

const L = 100_000;
const Cr = 100 * L;

test("monthly scale: 1.7 Cr benchmark, 20 L steps, coarse below", () => {
  const s = revenueTrendScale(222 * L);
  assert.equal(s.benchmark?.value, 170 * L);
  assert.deepEqual(s.ticks.slice(0, 4), [0, 50 * L, 100 * L, 120 * L]);
  assert.ok(s.ticks.includes(160 * L) && s.ticks.includes(180 * L) && s.ticks.includes(220 * L));
  assert.equal(s.domain[1], 240 * L);
  const fine = s.ticks.filter((t) => t >= 100 * L);
  fine.slice(1).forEach((t, i) => assert.equal(t - fine[i], 20 * L));
});

test("benchmark stays inside the domain even when data is below it", () => {
  const s = revenueTrendScale(146 * L); // a This-Month view
  assert.equal(s.benchmark?.value, 170 * L);
  assert.equal(s.domain[1], 180 * L);
});

test("FY scale: 23 Cr benchmark, 50 L steps near/above it", () => {
  const s = revenueTrendScale(25 * Cr);
  assert.equal(s.benchmark?.value, 23 * Cr);
  assert.deepEqual(s.ticks.slice(0, 5), [0, 5 * Cr, 10 * Cr, 15 * Cr, 20 * Cr]);
  assert.ok(s.ticks.includes(23 * Cr) && s.ticks.includes(23 * Cr + 50 * L) && s.ticks.includes(25 * Cr));
  assert.equal(s.domain[1], 25 * Cr);
});

test("a small series (single property) gets a plain scale and no benchmark", () => {
  const s = revenueTrendScale(40 * L);
  assert.equal(s.benchmark, null);
  assert.equal(s.ticks[0], 0);
  assert.ok(s.domain[1] >= 40 * L);
});
