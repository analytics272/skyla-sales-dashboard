"use client";

// The Looker Studio reference pattern: a compact row above a per-FY chart
// showing each FY's headline number, with an arrow + relative % vs the FY
// immediately before it. The first FY in the list has nothing to compare
// against, so it shows no badge — matching the reference exactly.
export interface FyComparisonPoint {
  fy: string;
  value: number | null;
}

export default function FyComparisonStrip({
  points,
  valueFormatter,
}: {
  points: FyComparisonPoint[];
  valueFormatter: (v: number) => string;
}) {
  return (
    <div className="mb-3 grid gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
      {points.map((p, i) => {
        const prev = i > 0 ? points[i - 1] : null;
        const pctChange = prev && prev.value !== null && prev.value !== 0 && p.value !== null ? (p.value - prev.value) / prev.value : null;
        return (
          <div key={p.fy} className="text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{p.fy}</p>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{p.value !== null ? valueFormatter(p.value) : "—"}</p>
            {pctChange !== null && (
              <p className={`text-[11px] font-medium ${pctChange >= 0 ? "text-[var(--chart-delta-good)]" : "text-[var(--chart-delta-bad)]"}`}>
                {pctChange >= 0 ? "▲" : "▼"} {Math.abs(pctChange * 100).toFixed(0)}%
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
