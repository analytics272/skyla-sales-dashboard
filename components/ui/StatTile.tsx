import { CHART_DELTA_BAD, CHART_DELTA_GOOD } from "@/lib/design/tokens";

export interface StatTileProps {
  label: string;
  value: string;
  delta?: { pct: number; label: string; upIsGood?: boolean };
  sub?: string;
}

export default function StatTile({ label, value, delta, sub }: StatTileProps) {
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
    </div>
  );
}
