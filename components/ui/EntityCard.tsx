import ProgressBar from "./ProgressBar";

// Compact per-entity leaderboard card (redesign 2026-09-02: replaces
// multi-column tables — By Owner, Revenue Targets By Property — with a grid
// of visual cards, one per entity) — a headline figure, an optional
// achievement/progress bar, and a handful of secondary stats.
export default function EntityCard({
  name,
  headline,
  headlineLabel,
  progress,
  stats,
}: {
  name: string;
  headline: string;
  headlineLabel: string;
  progress?: { pct: number; label?: string; good?: number; warn?: number };
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{name}</p>
      <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{headlineLabel}</p>
      <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{headline}</p>
      {progress && (
        <div className="mt-2">
          <ProgressBar pct={progress.pct} good={progress.good} warn={progress.warn} />
          {progress.label && <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{progress.label}</p>}
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{s.label}</p>
            <p className="text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-100">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
