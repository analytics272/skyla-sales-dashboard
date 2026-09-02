// Global comparison-period model (2026-09-02 redesign) — replaces the old
// Property/FY/Quarter/Month filter combination with three period tabs
// (Today / This FY / Last Year), matching the reference dashboard
// (skyla-fnb.lovable.app). Every KPI query now resolves a `current` date
// range plus a `previous` (comparison) date range from whichever tab is
// active, instead of a multi-select FY/Quarter/Month combination. Property
// remains a separate, independent multi-select filter (unchanged).
import { DateRange, currentFYLabel, fyStartYearOf, fyLabel, fyBounds } from "./financialYear";

export type PeriodKey = "today" | "this_fy" | "last_year";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_fy", label: "This FY" },
  { key: "last_year", label: "Last Year" },
];

export function isPeriodKey(v: string | undefined | null): v is PeriodKey {
  return v === "today" || v === "this_fy" || v === "last_year";
}

export interface PeriodDef {
  key: PeriodKey;
  /** What the active tab is scoped to right now — the primary range every KPI sums/averages over. */
  current: DateRange;
  /** The equivalent prior period, used for every "vs previous" comparison. Same span length as `current`. */
  previous: DateRange;
  /** Short label for the current range, e.g. "Today", "FY 25-26 (to date)", "FY 24-25". */
  currentLabel: string;
  /** Short label for the previous range, e.g. "Yesterday", "FY 24-25 (to date)", "FY 23-24". */
  previousLabel: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

function addYears(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return toIso(d);
}

/**
 * Resolves the current/previous date ranges for a period tab, as of a given
 * date (defaults to today — parameterized for testability).
 *
 * - "today": current = today only; previous = yesterday. Simple day-over-day
 *   pace read, matching the reference dashboard's own "Today" tab.
 * - "this_fy": current = FY-start .. today (year-to-date, not the full FY —
 *   comparing a partial year to a full year would be misleading); previous =
 *   the exact same elapsed span one year earlier, so it's a true apples-to-
 *   apples year-to-date comparison, not full-FY-vs-partial-FY.
 * - "last_year": current = the last fully-completed FY (Apr-Mar); previous =
 *   the FY before that. Both spans are complete, ordinary FY-over-FY.
 */
export function resolvePeriod(key: PeriodKey, asOf: Date = new Date()): PeriodDef {
  const todayIso = toIso(asOf);

  if (key === "today") {
    return {
      key,
      current: { start: todayIso, end: todayIso },
      previous: { start: addDays(todayIso, -1), end: addDays(todayIso, -1) },
      currentLabel: "Today",
      previousLabel: "Yesterday",
    };
  }

  if (key === "this_fy") {
    const fy = currentFYLabel(asOf);
    const { start: fyStart } = fyBounds(fy);
    return {
      key,
      current: { start: fyStart, end: todayIso },
      previous: { start: addYears(fyStart, -1), end: addYears(todayIso, -1) },
      currentLabel: `${fy} (to date)`,
      previousLabel: `${fyLabel(fyStartYearOf(asOf) - 1)} (to date)`,
    };
  }

  // "last_year": the most recently completed FY, vs the one before it.
  const lastCompletedFyStartYear = fyStartYearOf(asOf) - 1;
  const priorFyStartYear = lastCompletedFyStartYear - 1;
  return {
    key,
    current: fyBounds(fyLabel(lastCompletedFyStartYear)),
    previous: fyBounds(fyLabel(priorFyStartYear)),
    currentLabel: fyLabel(lastCompletedFyStartYear),
    previousLabel: fyLabel(priorFyStartYear),
  };
}

export function periodLabel(key: PeriodKey): string {
  return PERIOD_OPTIONS.find((p) => p.key === key)?.label ?? key;
}
