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
  /** Short label for the current range, e.g. "Today", "FY 26-27", "September". */
  currentLabel: string;
  /** Short label for the previous range, e.g. "Preceding period", "2025-09-01 to 2025-09-30 (last year)". */
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
 * - "this_month": current = the FULL calendar month (1st .. last day).
 * - "last_7_days" / "last_30_days": current = the trailing N days ending
 *   today (inclusive) — these are inherently backward-looking windows, not
 *   "a unit that's still in progress", so there's no full-vs-to-date
 *   ambiguity to resolve here the way there is for this_month/this_fy.
 * - "this_fy": current = the FULL fiscal year (FY-start .. FY-end).
 * - "custom": current = the caller-supplied range.
 *
 * 2026-09-07, twelfth pass: this_fy used to stop at today ("year-to-date"),
 * which made it silently show a different, smaller total than typing the
 * identical FY as a Custom Range (confirmed live: This FY's 10.12 Cr vs a
 * 2026-04-01–2027-03-31 custom range's 11.48 Cr — same fiscal year, two
 * different numbers, reported as a bug). Same fix as this_month got in the
 * ninth pass, for the same reason: sales_booking carries real, already-
 * confirmed advance bookings past today, and there's no principled reason
 * "This FY" should truncate at today when Custom Range never does and
 * This Month no longer does either — every period tab now means exactly
 * what typing its own bounds as a Custom Range would mean.
 *
 * This does NOT reintroduce the to-date-vs-target problem the eleventh pass
 * fixed on the Performance page: `current` here is genuinely the whole
 * window (matching every other tab and Custom Range), and callers that
 * specifically need "how much of this window has actually elapsed as of
 * today" — i.e. an achieved-vs-target reading for a range that might extend
 * into the future — should call `clampRangeToToday(current)` themselves
 * (see getPropertyTargetComparison) rather than relying on `current` itself
 * to already stop at today. That's a narrower, more honest fix than making
 * the shared period model silently behave differently depending on which
 * page happens to be reading it.
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
    const monthEnd = addDays(addMonths(monthStart, 1), -1);
    current = { start: monthStart, end: monthEnd };
    currentLabel = MONTH_NAMES_FULL[asOf.getMonth()];
  } else if (key === "last_7_days") {
    current = { start: addDays(todayIso, -6), end: todayIso };
    currentLabel = "Last 7 Days";
  } else if (key === "last_30_days") {
    current = { start: addDays(todayIso, -29), end: todayIso };
    currentLabel = "Last 30 Days";
  } else if (key === "this_fy") {
    const fy = currentFYLabel(asOf);
    current = fyBounds(fy);
    currentLabel = fy;
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

/**
 * Clamps a range's end to today (or `asOf`) if it extends past it — for a
 * caller that needs "how much of this window has actually elapsed" rather
 * than the window itself. Every period tab's `current` (This FY, This
 * Month, Custom Range, ...) can legitimately extend into the future now
 * (sales_booking carries real advance bookings), which is correct for a
 * plain "total for this window" reading but wrong for an achieved-vs-target
 * pacing metric — that always means "realized so far", never "including
 * bookings for days that haven't happened yet". No-op if the range doesn't
 * extend past today.
 */
export function clampRangeToToday(range: DateRange, asOf: Date = new Date()): DateRange {
  const todayIso = toIso(asOf);
  return { start: range.start, end: range.end < todayIso ? range.end : todayIso };
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
