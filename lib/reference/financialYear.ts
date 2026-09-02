// PRD §3.5 — Financial Year is April-March, formatted "FY YY-YY".
//
// 2026-09-02: the old multi-select FY/Quarter/Month filter model (DateFilter,
// resolveSelectedFYs/Months, resolveMonthRanges, fiscalQuarterBounds, etc.)
// was removed as part of the period-tabs redesign — see `lib/reference/period.ts`
// for the new Today/This FY/Last Year model everything now scopes by. The
// pure FY-math helpers below are kept: they're still needed for FY *labels*
// (period.ts builds on fyBounds/fyLabel/fyStartYearOf) and for two tables
// that are natively keyed by fiscal month number rather than a date
// (`leadership_targets.Month_Number`, `sales_booking_lp_monthly.MonthNumber`).

export const FY_START_MONTH = 4; // April

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

/** Bounds for a single calendar month within a given FY (month determines which side of the FY boundary it falls on). Still used by Targets' monthly charts, which are inherently one-row-per-fiscal-month. */
export function fyMonthBounds(fy: string, calendarMonth: number): DateRange {
  const startYear = parseFyLabel(fy);
  const calendarYear = calendarMonth >= FY_START_MONTH ? startYear : startYear + 1;
  return {
    start: `${calendarYear}-${pad(calendarMonth)}-01`,
    end: `${calendarYear}-${pad(calendarMonth)}-${pad(lastDayOfMonth(calendarYear, calendarMonth))}`,
  };
}

/** True once a fiscal month's start date is still ahead of today — hasn't happened yet, nothing to plot as "actual". Still needed for the Targets tab's "This FY" view, whose governing FY can extend past today even though the new period model's own date ranges never do. */
export function isFutureFiscalMonth(fy: string, calendarMonth: number, today: Date = new Date()): boolean {
  return fyMonthBounds(fy, calendarMonth).start > today.toISOString().slice(0, 10);
}

/** Fiscal month number (1-12, Apr=1...Mar=12, as used by leadership_targets.Month_Number and sales_booking_lp_monthly.MonthNumber) -> calendar month (1-12). */
export function calendarMonthFromFiscal(fiscalMonth: number): number {
  return fiscalMonth <= 9 ? fiscalMonth + 3 : fiscalMonth - 9;
}

/** Calendar month (1-12) -> fiscal month number (1-12, Apr=1...Mar=12) — the inverse of calendarMonthFromFiscal. */
export function fiscalMonthNumber(calendarMonth: number): number {
  return calendarMonth >= 4 ? calendarMonth - 3 : calendarMonth + 9;
}

// --- SQL expression builders (dateExpr must already evaluate to a DATE) ---

export function fyStartYearSqlExpr(dateExpr: string): string {
  return `(EXTRACT(YEAR FROM ${dateExpr}) - IF(EXTRACT(MONTH FROM ${dateExpr}) >= ${FY_START_MONTH}, 0, 1))`;
}

export function fyLabelSqlExpr(dateExpr: string): string {
  const start = fyStartYearSqlExpr(dateExpr);
  return `CONCAT('FY ', LPAD(CAST(MOD(${start}, 100) AS STRING), 2, '0'), '-', LPAD(CAST(MOD(${start} + 1, 100) AS STRING), 2, '0'))`;
}

export function monthNameSqlExpr(dateExpr: string): string {
  return `FORMAT_DATE('%B', ${dateExpr})`;
}
