// 2026-09-21 — extends the Reports-tab-only historicalPropertyOverrides.ts
// mechanism dashboard-wide, per explicit user direction: "Overview, Bookings,
// Performance, Targets, etc all should keep those 2 sheets values... all
// filters should follow those 2 past FY numbers." Exact rule, as specified:
//   - Selected period === one whole calendar month inside FY24-25/FY25-26
//     -> use that month's workbook figure.
//   - Selected period === one of those FYs' exact full bounds
//     -> sum the 12 months' workbook figures.
//   - Anything else (Today, Last 7/30 Days, a partial-month Custom Range)
//     -> NOT covered, caller falls back to its normal BigQuery query. No
//     prorating, ever.
//   - FY 26-27 (or any other year) is never matched here at all.
//
// Coverage is per-property, not just per-range: a property missing from the
// workbook for part of a range (GB before Sep 2025 in FY25-26; GB in
// Feb/Mar 2025 in FY24-25 — genuinely inactive, no row at all) is NOT
// returned for that range, not returned as a zero or partial sum either —
// callers must fall back to BigQuery for exactly that property, and only
// that property, for that range. LP is never covered (see
// historicalSheetData.ts's own comment) — always falls back.
//
// This module only ANSWERS "what does the workbook say for these properties
// over this exact range" — it doesn't know how any given KPI function is
// shaped. Each integration point (getOverviewKpis, getAdrByProperty,
// getBookingStats, getRoomNightsGap, so far) splits its own requested
// property list into the covered/uncovered subsets, queries BigQuery for
// only the uncovered subset (never zero properties queried, never double-
// counted), and adds this module's sums for the covered subset on top —
// see each function's own "historical override" comment for the exact
// mechanics, since query shapes differ too much to share more than this.
import { DateRange, fyBounds } from "./financialYear";
import { HistoricalMonthData, getHistoricalMonthData } from "./historicalSheetData";

const COVERED_FYS = ["FY 24-25", "FY 25-26"];

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

/** "YYYY-MM" if `range` is exactly one full calendar month (1st through the month's last day), else null. */
function wholeCalendarMonth(range: DateRange): string | null {
  const start = new Date(`${range.start}T00:00:00`);
  if (start.getDate() !== 1) return null;
  const year = start.getFullYear();
  const month = start.getMonth() + 1;
  const expectedEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
  return range.end === expectedEnd ? range.start.slice(0, 7) : null;
}

/** The 12 "YYYY-MM" keys (Apr..Mar) making up a fiscal year, e.g. "FY 24-25" -> ["2024-04", ..., "2025-03"]. */
function monthsOfFy(fy: string): string[] {
  const { start } = fyBounds(fy);
  const startYear = parseInt(start.slice(0, 4), 10);
  return Array.from({ length: 12 }, (_, i) => {
    const calMonth = ((3 + i) % 12) + 1; // Apr(4)..Mar(3), 0-indexed i=0 -> 4
    const calYear = calMonth >= 4 ? startYear : startYear + 1;
    return `${calYear}-${String(calMonth).padStart(2, "0")}`;
  });
}

/** One of COVERED_FYS if `range` exactly matches that FY's bounds, else null. */
function wholePastFy(range: DateRange): string | null {
  return COVERED_FYS.find((fy) => {
    const b = fyBounds(fy);
    return b.start === range.start && b.end === range.end;
  }) ?? null;
}

function sumMonths(months: HistoricalMonthData[]): HistoricalMonthData {
  // b2bRevenue/b2cRevenue must stay `undefined` on the result unless EVERY
  // month being summed actually has them (FY24-25's data; FY25-26's never
  // does) — defaulting a missing month to 0 would make a FY25-26 property
  // look "B2B/B2C-split covered" to callers that check `!== undefined`
  // (getCategoryMix, getOverviewKpis's bySource), silently zeroing their
  // real B2B/B2C revenue instead of leaving it live. Caught live: KDP Apr
  // 2025's B2B/B2C category revenue was coming back as 0 before this fix.
  const hasSplit = months.length > 0 && months.every((m) => m.b2bRevenue !== undefined);
  const sums = months.reduce(
    (acc, m) => ({
      soldRoomNights: acc.soldRoomNights + m.soldRoomNights,
      availableRoomNights: acc.availableRoomNights + m.availableRoomNights,
      revenue: acc.revenue + m.revenue,
      b2bRevenue: (acc.b2bRevenue ?? 0) + (m.b2bRevenue ?? 0),
      b2cRevenue: (acc.b2cRevenue ?? 0) + (m.b2cRevenue ?? 0),
    }),
    { soldRoomNights: 0, availableRoomNights: 0, revenue: 0, b2bRevenue: 0, b2cRevenue: 0 }
  );
  return hasSplit ? sums : { soldRoomNights: sums.soldRoomNights, availableRoomNights: sums.availableRoomNights, revenue: sums.revenue };
}

/**
 * For each of `properties`, returns the workbook's own figures for `range`
 * IF `range` is a whole month or whole FY covered above AND that property
 * has a workbook row for every month in range — properties failing either
 * condition are simply absent from the result (not zeroed, not partially
 * summed). Returns `{}` (never null) when nothing in `properties` is
 * coverable, so callers can always do `Object.keys(covered).length` /
 * `properties.filter(p => !(p in covered))` without a null check.
 */
export function getHistoricalOverrideForRange(properties: string[], range: DateRange): Record<string, HistoricalMonthData> {
  const singleMonth = wholeCalendarMonth(range);
  const fy = singleMonth ? null : wholePastFy(range);
  if (!singleMonth && !fy) return {};

  const monthKeys = singleMonth ? [singleMonth] : monthsOfFy(fy!);
  const result: Record<string, HistoricalMonthData> = {};
  for (const property of properties) {
    const months: HistoricalMonthData[] = [];
    for (const mk of monthKeys) {
      const m = getHistoricalMonthData(property, mk);
      if (!m) break;
      months.push(m);
    }
    if (months.length === monthKeys.length) result[property] = sumMonths(months);
  }
  return result;
}
