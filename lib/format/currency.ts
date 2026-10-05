// PRD §6.1 — legacy CASE logic: >=1Cr -> "X.XX Cr", >=1L -> "X.XX L", >=1K -> "X.XX K".
// `crDecimals` lets a headline tile show more precision for crore values (default 2) —
// e.g. 5,99,79,517 reads "6.00 Cr" at 2 decimals but "5.998 Cr" at 3.
export function formatIndianCurrency(amount: number, crDecimals = 2): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}${(abs / 1_00_00_000).toFixed(crDecimals)} Cr`;
  if (abs >= 1_00_000) return `${sign}${(abs / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(2)} K`;
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
