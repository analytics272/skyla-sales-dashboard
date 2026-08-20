// PRD §6.1 — legacy CASE logic: >=1Cr -> "X.XX Cr", >=1L -> "X.XX L", >=1K -> "X.XX K".
export function formatIndianCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}${(abs / 1_00_00_000).toFixed(2)} Cr`;
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
