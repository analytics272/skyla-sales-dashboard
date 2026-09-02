// Global comparison-period model (2026-09-02 redesign, extended twice more
// the same day). Two independent axes:
//  - `PeriodKey`: which window is "now" — Today / This Month / Last 7 Days /
//    Last 30 Days / This FY / Custom Range (single-select, matches the
//    reference dashboard's own tab set exactly).
//  - `compareYoY`: a toggle, not a 7th tab — when off (default), the
//    comparison is the immediately-preceding window of the same length; when
//    on, the comparison is the exact same window shifted back one year (same
//    dates, same span), so "This Month + compare-to-last-year" reads as
//    "September 2026 vs September 2025", not "vs August 2026". Applies to
//    whichever period tab is active — it's a modifier, not its own tab.
import { DateRange, currentFYLabel, fyStartYearOf, fyLabel, fyBounds } from "./financialYear";

export type PeriodKey = "today" | "this_month" | "last_7_days" | "last_30_days" | "this_fy" | "custom";

// Order and labels match the reference dashboard (skyla-fnb.lovable.app) exactly.
export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_month", label: "This Month" },
  { key: "last_7_days", label: "Last 7 Days" },
  { key: "last_30_days", label: "Last 30 Days" },
  { key: "this_fy", label: "This FY" },
  { key: "custom", label: "Custom Range" },
];

export function isPeriodKey(v: string | undefined | null): v is PeriodKey {
  return PERIOD_OPTIONS.some((p) => p.key === v);
}

export interface PeriodDef {
  key: PeriodKey;
  /** What the active tab is scoped to right now — the primary range every KPI sums/averages over. */
  current: DateRange;
  /** The comparison range — the preceding window, or the same window one year back when compareYoY is on. Same span length as `current` either way. */
  previous: DateRange;
  /** Short label for the current range, e.g. "Today", "FY 25-26 (to date)". */
  currentLabel: string;
  /** Short label for the previous range, e.g. "Yesterday", "FY 24-25 (to date)". */
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

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return toIso(d);
}

function addYears(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return toIso(d);
}

function daySpan(start: string, end: string): number {
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime();
  return Math.round(ms / 86400000) + 1;
}

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The immediately-preceding window of the same length as [start, end] (default comparison, compareYoY off). */
function precedingWindow(start: string, end: string): DateRange {
  const span = daySpan(start, end);
  return { start: addDays(start, -span), end: addDays(start, -1) };
}

/** The exact same window, shifted back one calendar year (compareYoY on). */
function sameWindowLastYear(start: string, end: string): DateRange {
  return { start: addYears(start, -1), end: addYears(end, -1) };
}

/**
 * Resolves the current/comparison date ranges for a period tab, as of a
 * given date (defaults to today — parameterized for testability).
 *
 * - "today": current = today only.
 * - "this_month": current = calendar-month-start .. today (to-date, not the
 *   full month — comparing a partial month to a full one would mislead).
 * - "last_7_days" / "last_30_days": current = the trailing N days ending
 *   today (inclusive).
 * - "this_fy": current = FY-start .. today (year-to-date).
 * - "custom": current = the caller-supplied range.
 *
 * For every key, `previous` is either the immediately-preceding window of
 * the same length (compareYoY off — the default) or the identical window
 * shifted back exactly one year (compareYoY on), per `compareYoY`.
 */
export function resolvePeriod(key: PeriodKey, asOf: Date = new Date(), custom?: DateRange, compareYoY = false): PeriodDef {
  const todayIso = toIso(asOf);
  let current: DateRange;
  let currentLabel: string;

  if (key === "today") {
    current = { start: todayIso, end: todayIso };
    currentLabel = "Today";
  } else if (key === "this_month") {
    const monthStart = `${asOf.getFullYear()}-${pad(asOf.getMonth() + 1)}-01`;
    current = { start: monthStart, end: todayIso };
    currentLabel = `${MONTH_NAMES_FULL[asOf.getMonth()]} (to date)`;
  } else if (key === "last_7_days") {
    current = { start: addDays(todayIso, -6), end: todayIso };
    currentLabel = "Last 7 Days";
  } else if (key === "last_30_days") {
    current = { start: addDays(todayIso, -29), end: todayIso };
    currentLabel = "Last 30 Days";
  } else if (key === "this_fy") {
    const fy = currentFYLabel(asOf);
    current = { start: fyBounds(fy).start, end: todayIso };
    currentLabel = `${fy} (to date)`;
  } else {
    // "custom"
    current = custom ?? { start: todayIso, end: todayIso };
    currentLabel = `${current.start} to ${current.end}`;
  }

  const previous = compareYoY ? sameWindowLastYear(current.start, current.end) : precedingWindow(current.start, current.end);
  const previousLabel = compareYoY ? `${previous.start} to ${previous.end} (last year)` : "Preceding period";
  return { key, current, previous, currentLabel, previousLabel };
}

export function periodLabel(key: PeriodKey): string {
  return PERIOD_OPTIONS.find((p) => p.key === key)?.label ?? key;
}

/** Shared shape every filter interface extends for period scoping. */
export interface PeriodFilter {
  period?: PeriodKey;
  /** Only meaningful when period === "custom" — ISO dates. */
  customStart?: string;
  customEnd?: string;
  /** Compare-to-last-year toggle (default off = compare to the preceding window). Applies to whichever period tab is active. */
  compareYoY?: boolean;
}

/** Resolves a filter's period, threading the custom range and compare-mode through — the one place every query file should call from, instead of resolvePeriod() directly, so neither is ever silently dropped. */
export function resolvePeriodFromFilter(filter: PeriodFilter): PeriodDef {
  const key = filter.period ?? "this_fy";
  const custom = key === "custom" && filter.customStart && filter.customEnd ? { start: filter.customStart, end: filter.customEnd } : undefined;
  return resolvePeriod(key, new Date(), custom, filter.compareYoY ?? false);
}
