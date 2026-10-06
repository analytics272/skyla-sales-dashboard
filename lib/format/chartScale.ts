// Revenue-trend y-axis scale with a visible benchmark line (display only — never touches the data).
//
// 2026-10-05, per explicit direction:
//   monthly view (one monthly point, e.g. This Month):  benchmark ₹1.70 Cr, ₹20 L steps around/above it
//   FY view (several monthly points, e.g. This FY):      benchmark ₹2.30 Cr, ₹50 L steps around/above it
// The FY view still plots MONTHLY revenue (peak ~2.2 Cr), so its benchmark has to live on
// that axis: the requested "₹23 Cr" can't share it (it would flatten every point), and the
// previous axis topped out at 2.30 Cr — treated as the intended figure. Change FY.benchmark
// below if a different number was meant. Below the fine-step zone the axis uses coarse steps.
const LAKH = 100_000;

export interface RevenueScale {
  ticks: number[];
  domain: [number, number];
  benchmark: { value: number; label: string } | null;
}

interface Mode {
  benchmark: number;
  fineStep: number;
  coarseStep: number;
  label: string;
}

const MONTHLY: Mode = { benchmark: 170 * LAKH, fineStep: 20 * LAKH, coarseStep: 50 * LAKH, label: "Benchmark ₹1.70 Cr" };
const FY: Mode = { benchmark: 230 * LAKH, fineStep: 50 * LAKH, coarseStep: 50 * LAKH, label: "Benchmark ₹2.30 Cr" };

/** A trend with at least this many monthly points is the FY view; fewer is the monthly view. */
export const FY_VIEW_MIN_POINTS = 3;
/** Below this share of the benchmark (e.g. a single property) the benchmark isn't meaningful — fall back to a plain scale. */
const MIN_SHARE_OF_BENCHMARK = 0.5;

export function revenueTrendScale(maxValue: number, pointCount: number): RevenueScale {
  const mode = pointCount >= FY_VIEW_MIN_POINTS ? FY : MONTHLY;

  if (maxValue < mode.benchmark * MIN_SHARE_OF_BENCHMARK) {
    const step = Math.max(10 * LAKH, Math.ceil(maxValue / 4 / (10 * LAKH)) * 10 * LAKH);
    const top = Math.max(step, Math.ceil(maxValue / step) * step);
    const ticks: number[] = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    return { ticks, domain: [0, top], benchmark: null };
  }

  const fineStart = Math.floor((mode.benchmark - 3 * mode.fineStep) / mode.fineStep) * mode.fineStep;
  const top = Math.max(Math.ceil(maxValue / mode.fineStep), Math.ceil(mode.benchmark / mode.fineStep)) * mode.fineStep;
  const ticks: number[] = [];
  for (let v = 0; v < fineStart; v += mode.coarseStep) ticks.push(v);
  for (let v = fineStart; v <= top + 1e-6; v += mode.fineStep) ticks.push(v);
  return { ticks, domain: [0, top], benchmark: { value: mode.benchmark, label: mode.label } };
}
