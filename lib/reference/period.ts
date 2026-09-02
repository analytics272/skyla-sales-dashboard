// Global comparison-period model (2026-09-02 redesign, extended 2026-09-02
// later the same day to match the reference dashboard's exact tab set) —
// replaces the old Property/FY/Quarter/Month filter combination. Every KPI
// query resolves a `current` date range plus a `previous` (comparison) date
// range from whichever tab is active, instead of a multi-select
// FY/Quarter/Month combination. Property remains a separate, independent
// multi-select filter (unchanged).
import { DateRange, currentFYLabel, fyStartYearOf, fyLabel, fyBounds } from "./financialYear";

export type PeriodKey = "today" | "this_month" | "last_7_days" | "last_30_days" | "this_fy" | "last_year" | "custom";

// Order and labels match the reference dashboard (skyla-fnb.lovable.app)
// exactly, plus "Last Year" (requested in addition, not in the reference,
// placed right after "This FY" — same pill styling, not the default tab).
export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_month", label: "This Month" },
  { key: "last_7_days", label: "Last 7 Days" },
  { key: "last_30_days", label: "Last 30 Days" },
  { key: "this_fy", label: "This FY" },
  { key: "last_year", label: "Last Year" },
  { key: "custom", label: "Custom Range" },
];

export function isPeriodKey(v: string | undefined | null): v is PeriodKey {
  return PERIOD_OPTIONS.some((p) => p.key === v);
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

function trailingWindow(days: 7 | 30, todayIso: string, label: string): PeriodDef {
  const start = addDays(todayIso, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return {
    key: days === 7 ? "last_7_days" : "last_30_days",
    current: { start, end: todayIso },
    previous: { start: prevStart, end: prevEnd },
    currentLabel: label,
    previousLabel: "Preceding period",
  };
}

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Resolves the current/previous date ranges for a period tab, as of a given
 * date (defaults to today — parameterized for testability).
 *
 * - "today": current = today only; previous = yesterday.
 * - "this_month": current = calendar-month-start .. today; previous = the
 *   same elapsed span one calendar month earlier (apples-to-apples, not a
 *   partial-vs-full-month comparison).
 * - "last_7_days" / "last_30_days": current = the trailing N days ending
 *   today (inclusive); previous = the N days immediately before that window.
 * - "this_fy": current = FY-start .. today (year-to-date); previous = the
 *   exact same elapsed span one year earlier.
 * - "last_year": current = the last fully-completed FY (Apr-Mar); previous =
 *   the FY before that. Both spans complete, ordinary FY-over-FY.
 * - "custom": current = the caller-supplied range; previous = an
 *   immediately-preceding window of the same length (a defensible default
 *   comparison the reference dashboard doesn't specify beyond "Custom Range"
 *   existing as an option).
 */
export function resolvePeriod(key: PeriodKey, asOf: Date = new Date(), custom?: DateRange): PeriodDef {
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

  if (key === "this_month") {
    const monthStart = `${asOf.getFullYear()}-${pad(asOf.getMonth() + 1)}-01`;
    const monthName = MONTH_NAMES_FULL[asOf.getMonth()];
    const prevMonthStart = addMonths(monthStart, -1);
    return {
      key,
      current: { start: monthStart, end: todayIso },
      previous: { start: prevMonthStart, end: addMonths(todayIso, -1) },
      currentLabel: `${monthName} (to date)`,
      previousLabel: `${MONTH_NAMES_FULL[new Date(`${prevMonthStart}T00:00:00`).getMonth()]} (to date)`,
    };
  }

  if (key === "last_7_days") return trailingWindow(7, todayIso, "Last 7 Days");
  if (key === "last_30_days") return trailingWindow(30, todayIso, "Last 30 Days");

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

  if (key === "last_year") {
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

  // "custom"
  const range = custom ?? { start: todayIso, end: todayIso };
  const span = daySpan(range.start, range.end);
  return {
    key,
    current: range,
    previous: { start: addDays(range.start, -span), end: addDays(range.start, -1) },
    currentLabel: `${range.start} to ${range.end}`,
    previousLabel: "Preceding period",
  };
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
}

/** Resolves a filter's period, threading the custom range through when present — the one place every query file should call from, instead of resolvePeriod() directly, so "custom" is never silently dropped. */
export function resolvePeriodFromFilter(filter: PeriodFilter): PeriodDef {
  const key = filter.period ?? "this_fy";
  const custom = key === "custom" && filter.customStart && filter.customEnd ? { start: filter.customStart, end: filter.customEnd } : undefined;
  return resolvePeriod(key, new Date(), custom);
}
