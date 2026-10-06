import { test } from "node:test";
import assert from "node:assert/strict";
import { revenueTrendScale } from "../lib/format/chartScale";

const L = 100_000;
const Cr = 100 * L;

test("monthly view (1 point): 1.7 Cr benchmark, 20 L steps, coarse below", () => {
  const s = revenueTrendScale(222 * L, 1);
  assert.equal(s.benchmark?.value, 170 * L);
  assert.deepEqual(s.ticks.slice(0, 4), [0, 50 * L, 100 * L, 120 * L]);
  assert.ok(s.ticks.includes(160 * L) && s.ticks.includes(180 * L) && s.ticks.includes(220 * L));
  assert.equal(s.domain[1], 240 * L);
  const fine = s.ticks.filter((t) => t >= 100 * L);
  fine.slice(1).forEach((t, i) => assert.equal(t - fine[i], 20 * L));
});

test("benchmark stays inside the domain even when data is below it", () => {
  const s = revenueTrendScale(146 * L, 1); // a This-Month view
  assert.equal(s.benchmark?.value, 170 * L);
  assert.equal(s.domain[1], 180 * L);
});

test("FY view (12 monthly points): 2.30 Cr benchmark, 50 L steps, visible between ticks", () => {
  const s = revenueTrendScale(222 * L, 12); // This FY, peak month 2.22 Cr
  assert.equal(s.benchmark?.value, 230 * L);
  assert.deepEqual(s.ticks, [0, 50 * L, 100 * L, 150 * L, 200 * L, 250 * L]);
  assert.equal(s.domain[1], 250 * L);
  assert.ok(!s.ticks.includes(230 * L)); // the benchmark is the dashed line, not a tick
});

test("FY view grows past the benchmark in 50 L steps", () => {
  const s = revenueTrendScale(262 * L, 12);
  assert.equal(s.domain[1], 300 * L);
  assert.ok(s.ticks.includes(250 * L) && s.ticks.includes(300 * L));
});

test("a small series (single property) gets a plain scale and no benchmark", () => {
  for (const points of [1, 12]) {
    const s = revenueTrendScale(40 * L, points);
    assert.equal(s.benchmark, null);
    assert.equal(s.ticks[0], 0);
    assert.ok(s.domain[1] >= 40 * L);
  }
});
