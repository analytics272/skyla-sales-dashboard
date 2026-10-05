// PRD §6.1 — legacy CASE logic: >=1Cr -> "X.XX Cr", >=1L -> "X.XX L", >=1K -> "X.XX K".
// 2026-10-05: truncates to 2 decimals instead of rounding, so ₹5,99,79,517 reads
// "5.99 Cr" (not "6.00 Cr") — a displayed figure never overstates the real one.
// The 1e-9 absorbs float error (e.g. 1.8 Cr stays 1.80, not 1.79).
const trunc2 = (v: number) => (Math.floor(v * 100 + 1e-9) / 100).toFixed(2);

export function formatIndianCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}${trunc2(abs / 1_00_00_000)} Cr`;
  if (abs >= 1_00_000) return `${sign}${trunc2(abs / 1_00_000)} L`;
  if (abs >= 1_000) return `${sign}${trunc2(abs / 1_000)} K`;
  return `${sign}${abs.toFixed(2)}`;
}

export function formatPercent(fraction: number, decimals = 1): string {
  if (!isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(decimals)}%`;
}

export function safeDivide(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

/**
 * The one YoY comparison format used everywhere on the dashboard (per the
 * Looker Studio reference): arrow + relative % change + prior-period label +
 * prior-period absolute value, e.g. "▲ 12% vs FY 25-26 (₹3.2 Cr)".
 */
export function formatYoyLine(
  current: number | null,
  prior: number | null,
  pctChange: number | null,
  priorLabel: string,
  valueFormatter: (v: number) => string
): string {
  if (current === null || prior === null || pctChange === null) return "";
  const arrow = pctChange >= 0 ? "▲" : "▼";
  return `${arrow} ${formatPercent(Math.abs(pctChange), 0)} vs ${priorLabel} (${valueFormatter(prior)})`;
}
