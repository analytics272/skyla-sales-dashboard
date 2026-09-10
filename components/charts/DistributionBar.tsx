"use client";

// One horizontal bar split into labelled segments — for showing how a total
// breaks down into parts that should be read together, not as separate cards
// (2026-09-10, "Final Dashboard Changes" item 5: Available / Sold / Unsold /
// Remaining room nights). Each segment's width is its share of the sum of all
// segment values; a caption line lists each segment's absolute value + share.

export interface DistributionSegment {
  label: string;
  value: number;
  color: string;
  /** optional sub-note under the label in the legend (e.g. "through yesterday") */
  note?: string;
}

export default function DistributionBar({
  segments,
  valueFormatter = (v) => v.toLocaleString("en-IN"),
}: {
  segments: DistributionSegment[];
  valueFormatter?: (v: number) => string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-md" role="img" aria-label={segments.map((s) => `${s.label} ${valueFormatter(s.value)}`).join(", ")}>
        {segments.map((s) => {
          const pct = total > 0 ? (Math.max(0, s.value) / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={s.label}
              title={`${s.label}: ${valueFormatter(s.value)} (${pct.toFixed(0)}%)`}
              className="flex items-center justify-center text-[11px] font-medium text-white"
              style={{ width: `${pct}%`, background: s.color, minWidth: pct > 6 ? undefined : 0 }}
            >
              {pct > 10 ? `${pct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {segments.map((s) => {
          const pct = total > 0 ? (Math.max(0, s.value) / total) * 100 : 0;
          return (
            <div key={s.label} className="flex items-start gap-1.5 text-xs">
              <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="min-w-0">
                <span className="text-zinc-600 dark:text-zinc-300">{s.label}</span>{" "}
                <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{valueFormatter(s.value)}</span>
                <span className="text-zinc-400 dark:text-zinc-500"> · {pct.toFixed(0)}%</span>
                {s.note ? <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">{s.note}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
