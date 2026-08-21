// PRD §3.5 — Financial Year is April-March, formatted "FY YY-YY".
// User-confirmed: Quarter filter is fiscal-aligned (Q1=Apr-Jun ... Q4=Jan-Mar).

export const FY_START_MONTH = 4; // April

export interface DateFilter {
  fys?: string[]; // ["FY 25-26", ...] — multi-select; [] or undefined = default to the current FY
  quarter?: 1 | 2 | 3 | 4; // fiscal quarter (convenience shortcut for its 3 months)
  months?: number[]; // calendar months, 1-12, multi-select — narrows within each selected FY
}

export interface DateRange {
  start: string; // ISO date, inclusive
  end: string; // ISO date, inclusive
}

/** FY start year for a JS Date, e.g. Aug 2026 -> 2026, Feb 2026 -> 2025. */
export function fyStartYearOf(date: Date): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return m >= FY_START_MONTH ? y : y - 1;
}

export function fyLabel(startYear: number): string {
  const endYear = startYear + 1;
  return `FY ${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

export function currentFYLabel(asOf: Date = new Date()): string {
  return fyLabel(fyStartYearOf(asOf));
}

/** Fiscal quarter (1-4) for a calendar month (1-12): Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar. */
export function fiscalQuarterOfMonth(calendarMonth: number): 1 | 2 | 3 | 4 {
  if (calendarMonth >= 4 && calendarMonth <= 6) return 1;
  if (calendarMonth >= 7 && calendarMonth <= 9) return 2;
  if (calendarMonth >= 10 && calendarMonth <= 12) return 3;
  return 4;
}

export function parseFyLabel(fy: string): number {
  const m = /^FY\s*(\d{2})-(\d{2})$/.exec(fy.trim());
  if (!m) throw new Error(`Invalid FY label: ${fy}`);
  const startYY = parseInt(m[1], 10);
  // Anchor century off "today" so FY labels resolve correctly indefinitely.
  const currentCentury = Math.floor(new Date().getFullYear() / 100) * 100;
  return currentCentury + startYY;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Full FY bounds: "FY 25-26" -> { start: 2025-04-01, end: 2026-03-31 }. */
export function fyBounds(fy: string): DateRange {
  const startYear = parseFyLabel(fy);
  return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` };
}

const QUARTER_MONTHS: Record<1 | 2 | 3 | 4, number[]> = {
  1: [4, 5, 6],
  2: [7, 8, 9],
  3: [10, 11, 12],
  4: [1, 2, 3],
};

/** Bounds for a fiscal quarter within a given FY. Q4 (Jan-Mar) falls in the FY's end calendar year. */
export function fiscalQuarterBounds(fy: string, quarter: 1 | 2 | 3 | 4): DateRange {
  const startYear = parseFyLabel(fy);
  const calendarYear = quarter === 4 ? startYear + 1 : startYear;
  const months = QUARTER_MONTHS[quarter];
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  return {
    start: `${calendarYear}-${pad(firstMonth)}-01`,
    end: `${calendarYear}-${pad(lastMonth)}-${pad(lastDayOfMonth(calendarYear, lastMonth))}`,
  };
}

/** Bounds for a single calendar month within a given FY (month determines which side of the FY boundary it falls on). */
export function fyMonthBounds(fy: string, calendarMonth: number): DateRange {
  const startYear = parseFyLabel(fy);
  const calendarYear = calendarMonth >= FY_START_MONTH ? startYear : startYear + 1;
  return {
    start: `${calendarYear}-${pad(calendarMonth)}-01`,
    end: `${calendarYear}-${pad(calendarMonth)}-${pad(lastDayOfMonth(calendarYear, calendarMonth))}`,
  };
}

/** FYs selected by the filter — always at least one (defaults to the current FY when none are explicitly selected, same as the old single-select behavior). */
export function resolveSelectedFYs(filter: DateFilter): string[] {
  if (filter.fys && filter.fys.length > 0) return [...new Set(filter.fys)];
  return [currentFYLabel()];
}

/** The most recent of the selected FYs — for charts that are inherently single-FY (a 12-month x-axis) even though the global filter now allows selecting several. */
export function latestSelectedFy(filter: DateFilter): string {
  return [...resolveSelectedFYs(filter)].sort().at(-1)!;
}

/** Calendar months (1-12) selected by the filter; [] means "whole FY, no narrowing". Explicit `months` wins over `quarter` if both are set. */
export function resolveSelectedMonths(filter: DateFilter): number[] {
  if (filter.months && filter.months.length > 0) return [...new Set(filter.months)];
  if (filter.quarter) return QUARTER_MONTHS[filter.quarter];
  return [];
}

/**
 * One DateRange per (selected FY × selected month) combination — never
 * collapsed to an outer span, since neither the FY set nor the month set is
 * guaranteed contiguous (e.g. FY24-25 + FY26-27 skips FY25-26; Apr + Dec skips
 * May-Nov). Needed anywhere a "sum across the selection" calculation depends
 * on which specific days are included (Available Room Nights).
 */
export function resolveMonthRanges(filter: DateFilter): DateRange[] {
  const fys = resolveSelectedFYs(filter);
  const months = resolveSelectedMonths(filter);
  const ranges: DateRange[] = [];
  for (const fy of fys) {
    if (months.length === 0) ranges.push(fyBounds(fy));
    else for (const m of months) ranges.push(fyMonthBounds(fy, m));
  }
  return ranges;
}

// --- SQL expression builders (dateExpr must already evaluate to a DATE) ---

export function fyStartYearSqlExpr(dateExpr: string): string {
  return `(EXTRACT(YEAR FROM ${dateExpr}) - IF(EXTRACT(MONTH FROM ${dateExpr}) >= ${FY_START_MONTH}, 0, 1))`;
}

export function fyLabelSqlExpr(dateExpr: string): string {
  const start = fyStartYearSqlExpr(dateExpr);
  return `CONCAT('FY ', LPAD(CAST(MOD(${start}, 100) AS STRING), 2, '0'), '-', LPAD(CAST(MOD(${start} + 1, 100) AS STRING), 2, '0'))`;
}

export function fiscalQuarterSqlExpr(dateExpr: string): string {
  return `CASE
    WHEN EXTRACT(MONTH FROM ${dateExpr}) IN (4,5,6) THEN 1
    WHEN EXTRACT(MONTH FROM ${dateExpr}) IN (7,8,9) THEN 2
    WHEN EXTRACT(MONTH FROM ${dateExpr}) IN (10,11,12) THEN 3
    ELSE 4
  END`;
}

export function monthNameSqlExpr(dateExpr: string): string {
  return `FORMAT_DATE('%B', ${dateExpr})`;
}
