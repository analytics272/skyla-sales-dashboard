// Compact benchmark/achievement bar (redesign §12) — green/amber/red by how
// close `pct` is to 100%, matching the reference dashboard's Target
// Achievement and Property Performance rows.
export default function ProgressBar({
  pct,
  good = 0.9,
  warn = 0.6,
  height = 6,
  color: fixedColor,
}: {
  /** Fraction, not clamped for display width beyond 100% but the fill itself is capped at 100%. */
  pct: number;
  good?: number;
  warn?: number;
  height?: number;
  /** Overrides the good/warn/bad semantic coloring with one fixed color — for a bar that isn't a "target achievement" read (e.g. booking pace, where a low value for a future month is normal, not bad). */
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  const color = fixedColor ?? (pct >= good ? "var(--chart-delta-good)" : pct >= warn ? "#d97706" : "var(--chart-delta-bad)");
  return (
    <div className="w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" style={{ height }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${clamped * 100}%`, background: color }} />
    </div>
  );
}
