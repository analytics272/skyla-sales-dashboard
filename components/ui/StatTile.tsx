import { CHART_DELTA_BAD, CHART_DELTA_GOOD } from "@/lib/design/tokens";
import ProgressBar from "./ProgressBar";

export interface StatTileProps {
  label: string;
  value: string;
  delta?: { pct: number; label: string; upIsGood?: boolean };
  sub?: string;
  /** A second caption line with more visual weight than `sub` — bold, darker — for a figure that deserves to stand out next to its parent metric (e.g. a data-quality error rate) rather than read as a faint footnote. */
  subBold?: string;
  /** Compact benchmark/achievement bar under the value (redesign §12) — e.g. "97% of target". `good`/`warn` set the color thresholds (fraction 0-1, default 0.9/0.6). */
  progress?: { pct: number; label?: string; good?: number; warn?: number };
}

export default function StatTile({ label, value, delta, sub, subBold, progress }: StatTileProps) {
  const deltaColor = delta
    ? (delta.pct >= 0) === (delta.upIsGood ?? true)
      ? CHART_DELTA_GOOD
      : CHART_DELTA_BAD
    : undefined;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      {delta && (
        <p className="mt-1 text-xs font-medium" style={{ color: deltaColor }}>
          {delta.pct >= 0 ? "▲" : "▼"} {Math.abs(delta.pct).toFixed(1)}% {delta.label}
        </p>
      )}
      {sub && <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>}
      {subBold && <p className="mt-1 text-xs font-bold text-zinc-700 dark:text-zinc-200">{subBold}</p>}
      {progress && (
        <div className="mt-2.5">
          <ProgressBar pct={progress.pct} good={progress.good} warn={progress.warn} />
          {progress.label && <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{progress.label}</p>}
        </div>
      )}
    </div>
  );
}
