"use client";

// Heatmap (redesign 2026-09-02, fourth pass) — for a metric across two
// categorical dimensions (e.g. Owner × Lead Source) where a grid of colored
// cells reads the pattern ("who's strong on which channel") in one glance,
// something a set of grouped/stacked bars would need several charts to show.
// No native Recharts heatmap — a plain CSS grid with color-scaled cells is
// simpler and just as legible for a matrix this size.
export interface HeatmapCell {
  row: string;
  col: string;
  value: number;
}

function colorFor(value: number, max: number): string {
  if (max <= 0) return "var(--chart-gridline)";
  const t = Math.min(1, value / max);
  // Interpolate from a pale teal to a solid teal — reads as "more = darker",
  // consistent with the dashboard's teal accent everywhere else.
  const lightness = 92 - t * 55;
  return `hsl(175, 45%, ${lightness}%)`;
}

export default function Heatmap({
  rows,
  cols,
  cells,
  valueFormatter,
}: {
  rows: string[];
  cols: string[];
  cells: HeatmapCell[];
  valueFormatter: (v: number) => string;
}) {
  const lookup = new Map(cells.map((c) => [`${c.row}|${c.col}`, c.value]));
  const max = Math.max(0, ...cells.map((c) => c.value));

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `120px repeat(${cols.length}, minmax(64px, 1fr))` }}>
        <div />
        {cols.map((c) => (
          <div key={c} className="truncate px-1 pb-1 text-center text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {c}
          </div>
        ))}
        {rows.map((r) => (
          <div key={r} className="contents">
            <div className="flex items-center truncate pr-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
              {r}
            </div>
            {cols.map((c) => {
              const value = lookup.get(`${r}|${c}`) ?? 0;
              return (
                <div
                  key={c}
                  title={`${r} · ${c}: ${valueFormatter(value)}`}
                  className="flex items-center justify-center rounded text-[11px] font-medium text-zinc-800"
                  style={{ background: colorFor(value, max), minHeight: 32 }}
                >
                  {value > 0 ? valueFormatter(value) : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
