import { STALE_THRESHOLD_DAYS, type DataFreshness } from "@/lib/bigquery/queries/syncStatus";

function statusLine(s: DataFreshness): { text: string; severity: "error" | "stale" } | null {
  if (s.errored) return { text: `${s.label}: sync check failed — the underlying query errored (likely a schema change upstream)`, severity: "error" };
  if (s.lastDataDate === null) return { text: `${s.label}: no data found`, severity: "error" };
  if (s.daysStale !== null && s.daysStale > STALE_THRESHOLD_DAYS) {
    return { text: `${s.label}: last data is from ${s.lastDataDate} (${s.daysStale} days ago)`, severity: "stale" };
  }
  return null;
}

/**
 * Renders nothing when every source is fresh — this is deliberately quiet
 * by default (2026-09-26), matching the rest of this dashboard's convention
 * of only surfacing a caption/warning when there's actually something to
 * say (e.g. UnmappedSourceStats on Overview). Only appears when at least
 * one of this tab's own data sources (see syncStatus.ts's
 * TAB_FRESHNESS_SOURCES) is stale, errored, or has never had any data —
 * exactly the failure mode that let `lead_tracker`'s sync silently break
 * the Leads page for two weeks before anyone noticed by cross-checking the
 * source sheet by hand.
 */
export default function SyncFreshnessBanner({ sources }: { sources: DataFreshness[] }) {
  const lines = sources.map(statusLine).filter((l): l is NonNullable<typeof l> => l !== null);
  if (lines.length === 0) return null;

  const hasError = lines.some((l) => l.severity === "error");

  return (
    <div
      className={
        "mb-4 rounded-lg border px-4 py-3 text-sm " +
        (hasError
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200")
      }
    >
      <p className="font-semibold">{hasError ? "Data sync issue" : "Data may be out of date"}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {lines.map((l) => (
          <li key={l.text}>{l.text}</li>
        ))}
      </ul>
    </div>
  );
}
