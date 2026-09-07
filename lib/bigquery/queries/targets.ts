// PRD §6.5 — Targets vs Achieved (leadership_targets). Company-wide, not
// property-scoped (no Property column on this table) — the Property filter
// doesn't apply here. Month_Number is already FY-relative (Apr=1 ... Mar=12).
//
// 2026-09-02: rewritten for the Today/This FY/Last Year period-tabs model.
// leadership_targets is FY+fiscal-month grain, not date grain, so instead of
// a date-range WHERE clause this resolves a single governing FY from the
// active period tab (the FY containing period.current.start — "Today" and
// "This FY" both resolve to the current FY, "Last Year" to the prior
// completed FY) and always sums that FY's full 12 months, exactly as before
// — Target sums the whole planned year, Achieved is naturally 0 for any
// month that hasn't happened yet, so the ratio is already the right
// to-date-vs-full-year-plan reading without any elapsed-months filtering.
import { runQuery, table } from "../client";
import {
  currentFYLabel, fyLabel, parseFyLabel, calendarMonthFromFiscal, isFutureFiscalMonth, fiscalMonthNumber,
  fyMonthOverlapFraction, DateRange,
} from "@/lib/reference/financialYear";
import { PeriodFilter, resolvePeriodFromFilter } from "@/lib/reference/period";
import { safeDivide } from "@/lib/format/currency";

export type TargetsFilter = PeriodFilter;

export { fiscalMonthNumber };

/** The single FY leadership_targets should be read from for the active period tab. */
export function resolveTargetsFy(filter: TargetsFilter): string {
  const period = resolvePeriodFromFilter(filter);
  return currentFYLabel(new Date(`${period.current.start}T00:00:00`));
}

/**
 * The display/proration range for every leadership_targets section below.
 * 2026-09-07, twelfth pass: simplified now that period.ts's This FY *is*
 * the full fiscal year (no more special case needed here) — every tab just
 * uses its own `current` range as-is. No to-date clamping is needed on this
 * side the way propertyTargets.ts needs one: leadership_targets' own
 * Achieved figures are pre-recorded per fiscal month and naturally read 0
 * for a month that hasn't happened yet (there's nothing to prematurely
 * "achieve" from a live query here), so including a not-yet-started month
 * in the sum never inflates anything the way a live sales_booking query
 * would.
 */
export function resolveTargetsRange(filter: TargetsFilter): DateRange {
  return resolvePeriodFromFilter(filter).current;
}

export interface CategoryAchievement {
  category: "B2B" | "B2C" | "OTA";
  target: number;
  achieved: number;
  achievedPct: number | null;
}

interface CategoryAchievementMonthRow {
  month_number: number;
  b2b_target: number | null;
  b2b_achieved: number | null;
  b2c_target: number | null;
  b2c_achieved: number | null;
  ota_target: number | null;
  ota_achieved: number | null;
}

/**
 * 2026-09-07: per-month rows, prorated by day-overlap with the active
 * period's range and summed — instead of always summing the whole FY's 12
 * months regardless of the period filter (see resolveTargetsRange).
 */
export async function getCategoryAchievement(filter: TargetsFilter): Promise<CategoryAchievement[]> {
  const fy = resolveTargetsFy(filter);
  const range = resolveTargetsRange(filter);
  const rows = await runQuery<CategoryAchievementMonthRow>(`
    SELECT Month_Number AS month_number,
      SUM(B2B_Target) AS b2b_target, SUM(B2B_Achieved) AS b2b_achieved,
      SUM(B2C_Target) AS b2c_target, SUM(B2C_Achieved) AS b2c_achieved,
      SUM(OTA_Target) AS ota_target, SUM(OTA_Achieved) AS ota_achieved
    FROM ${table("leadership_targets")}
    WHERE Financial_Year = @fy
    GROUP BY month_number
  `, { fy });

  const totals = { b2bT: 0, b2bA: 0, b2cT: 0, b2cA: 0, otaT: 0, otaA: 0 };
  for (const r of rows) {
    const frac = fyMonthOverlapFraction(fy, calendarMonthFromFiscal(r.month_number), range);
    if (frac <= 0) continue;
    totals.b2bT += (r.b2b_target ?? 0) * frac;
    totals.b2bA += (r.b2b_achieved ?? 0) * frac;
    totals.b2cT += (r.b2c_target ?? 0) * frac;
    totals.b2cA += (r.b2c_achieved ?? 0) * frac;
    totals.otaT += (r.ota_target ?? 0) * frac;
    totals.otaA += (r.ota_achieved ?? 0) * frac;
  }

  return [
    { category: "B2B", target: totals.b2bT, achieved: totals.b2bA, achievedPct: safeDivide(totals.b2bA, totals.b2bT) },
    { category: "B2C", target: totals.b2cT, achieved: totals.b2cA, achievedPct: safeDivide(totals.b2cA, totals.b2cT) },
    { category: "OTA", target: totals.otaT, achieved: totals.otaA, achievedPct: safeDivide(totals.otaA, totals.otaT) },
  ];
}

export interface RevenueAchievement {
  target: number;
  achieved: number;
  achievedPct: number | null;
  targetWithRollOver: number;
}

export interface MonthlyRevenueTarget {
  monthNumber: number;
  month: string;
  deptTarget: number;
  targetWithRollOver: number;
  achievedRevenue: number;
}

interface RawTargetMonthRow {
  monthNumber: number;
  month: string;
  deptTarget: number;
  achieved: number;
}

async function getRawMonthlyRows(fy: string): Promise<RawTargetMonthRow[]> {
  const rows = await runQuery<{ month_number: number; month: string; dept_target: number | null; achieved: number | null }>(`
    SELECT Month_Number AS month_number, Month AS month,
      SUM(dept_Total_Target) AS dept_target,
      SUM(Revenue_Achieved) AS achieved
    FROM ${table("leadership_targets")}
    WHERE Financial_Year = @fy
    GROUP BY month_number, month
    ORDER BY month_number
  `, { fy });
  return rows.map((r) => ({ monthNumber: r.month_number, month: r.month, deptTarget: r.dept_target ?? 0, achieved: r.achieved ?? 0 }));
}

/**
 * The sheet's own Target_With_Roll_Over column is corrupted for every FY's
 * first month (verified against raw data: April's value comes out as just a
 * few lakh — nowhere near dept_Total_Target — while every other month exactly
 * equals `dept_Total_Target[N] + (dept_Total_Target[N-1] - Revenue_Achieved[N-1])`,
 * a single-month-lag carry of the *previous* month's own shortfall, not a
 * cumulative chain). So rollover is recomputed here from dept_Total_Target and
 * Revenue_Achieved directly, seeded from the prior FY's March row when one
 * exists (0 for the earliest FY in the data, e.g. FY 24-25's April).
 */
async function getPriorMarchShortfall(fy: string): Promise<number> {
  const priorFy = fyLabel(parseFyLabel(fy) - 1);
  const rows = await runQuery<{ dept_target: number | null; achieved: number | null }>(`
    SELECT SUM(dept_Total_Target) AS dept_target, SUM(Revenue_Achieved) AS achieved
    FROM ${table("leadership_targets")}
    WHERE Financial_Year = @priorFy AND Month_Number = 12
  `, { priorFy });
  const r = rows[0];
  if (!r || r.dept_target === null) return 0;
  return (r.dept_target ?? 0) - (r.achieved ?? 0);
}

/**
 * Rollover only carries between months that have actually happened — a month
 * that hasn't started yet always has Revenue_Achieved = 0, which isn't a real
 * "miss" to roll forward, it's just "hasn't happened". Without this guard,
 * every future month's 100% "shortfall" cascades fully into the next one, so
 * a whole-FY total (Target tile: flat sum of dept_Total_Target) and the
 * summed Target-with-rollover balloon to roughly 1.5x the flat target purely
 * from unstarted months compounding against each other — confirmed against
 * live data 2026-08-24 (28.00 Cr flat target vs 43.71 Cr summed rollover
 * before this fix; ~28.45 Cr after, which is the sane relationship). Once a
 * month is future, its own targetWithRollOver is just its flat dept target,
 * and it carries nothing forward to the month after it either. Under the
 * period-tabs model this still matters for "This FY" (the governing FY can
 * extend past today even though the period's own date range never does) —
 * "Last Year" resolves to a fully-elapsed FY, so the guard is simply always
 * false there and does nothing.
 */
function computeRollover(fy: string, rows: RawTargetMonthRow[], seedShortfall: number): MonthlyRevenueTarget[] {
  const result: MonthlyRevenueTarget[] = [];
  let carry = seedShortfall;
  for (const r of rows) {
    const future = isFutureFiscalMonth(fy, calendarMonthFromFiscal(r.monthNumber));
    const targetWithRollOver = future ? r.deptTarget : r.deptTarget + carry;
    result.push({
      monthNumber: r.monthNumber,
      month: r.month,
      deptTarget: r.deptTarget,
      targetWithRollOver,
      achievedRevenue: r.achieved,
    });
    carry = future ? 0 : r.deptTarget - r.achieved;
  }
  return result;
}

/** Monthly "Revenue Targets with Roll Over" — dept target vs target-with-rollover vs achieved, matching the legacy dashboard's 3-line view. */
/** Always computed across the FULL 12 fiscal months — the rollover cascade in computeRollover needs every prior month to get a later month's carry right, regardless of what the period filter narrows display down to. Callers needing a period-scoped view should filter/prorate this result, not re-fetch a partial range. */
export async function getMonthlyRevenueTargets(fy?: string): Promise<MonthlyRevenueTarget[]> {
  const resolvedFy = fy ?? currentFYLabel();
  const [rows, seedShortfall] = await Promise.all([getRawMonthlyRows(resolvedFy), getPriorMarchShortfall(resolvedFy)]);
  return computeRollover(resolvedFy, rows, seedShortfall);
}

/**
 * 2026-09-07: prorates each month by its day-overlap with `range` before
 * summing, instead of always summing the full FY regardless of the period
 * filter (see resolveTargetsRange — "This FY" passes the whole FY's bounds
 * here, which is a no-op prorate-wise and preserves the original
 * to-date-vs-full-year-plan reading; every other tab narrows both sides to
 * its own range). `data` should be the *full* 12-month array from
 * getMonthlyRevenueTargets — proration happens here, not by pre-filtering
 * the array, so the rollover cascade upstream is never affected by what's
 * being displayed.
 */
export function summarizeRevenueAchievement(data: MonthlyRevenueTarget[], fy: string, range: DateRange): RevenueAchievement {
  let target = 0;
  let achieved = 0;
  let targetWithRollOver = 0;
  for (const r of data) {
    const frac = fyMonthOverlapFraction(fy, calendarMonthFromFiscal(r.monthNumber), range);
    if (frac <= 0) continue;
    target += r.deptTarget * frac;
    achieved += r.achievedRevenue * frac;
    targetWithRollOver += r.targetWithRollOver * frac;
  }
  return { target, achieved, achievedPct: safeDivide(achieved, target), targetWithRollOver };
}

/** Filters a monthly-grain array down to just the months `range` actually touches — for trend-chart display once the period filter has narrowed below "the whole FY" ("This FY" itself touches every month up to today, so nothing is dropped for the default tab). No proration: a monthly figure is what it is, it isn't divisible mid-month for a chart point the way a summary total is above. */
export function filterMonthlyToRange<T extends { monthNumber: number }>(data: T[], fy: string, range: DateRange): T[] {
  return data.filter((r) => fyMonthOverlapFraction(fy, calendarMonthFromFiscal(r.monthNumber), range) > 0);
}

/** Convenience wrapper that fetches its own data. */
export async function getRevenueAchievement(filter: TargetsFilter): Promise<RevenueAchievement> {
  const fy = resolveTargetsFy(filter);
  const range = resolveTargetsRange(filter);
  const data = await getMonthlyRevenueTargets(fy);
  return summarizeRevenueAchievement(data, fy, range);
}

export interface MonthlyAdrTarget {
  fy: string;
  monthNumber: number;
  month: string; // e.g. "Apr 25"
  targetAdr: number;
  achievedAdr: number;
}

/** `range`, when given, filters the returned months down to whatever the period filter touches (see filterMonthlyToRange) — omit it to get the full FY (e.g. for a caller that wants to do its own filtering). */
export async function getAdrTargetVsAchieved(fy?: string, range?: DateRange): Promise<MonthlyAdrTarget[]> {
  const resolvedFy = fy ?? currentFYLabel();
  const rows = await runQuery<{ fy: string; month_number: number; month: string; target_adr: number | null; achieved_adr: number | null }>(`
    SELECT Financial_Year AS fy, Month_Number AS month_number, Month AS month,
      AVG(Target_ADR) AS target_adr, AVG(Achieved_ADR) AS achieved_adr
    FROM ${table("leadership_targets")}
    WHERE Financial_Year = @fy
    GROUP BY fy, month_number, month
    ORDER BY month_number
  `, { fy: resolvedFy });

  const result = rows.map((r) => ({
    fy: r.fy,
    monthNumber: r.month_number,
    month: r.month,
    targetAdr: r.target_adr ?? 0,
    achievedAdr: r.achieved_adr ?? 0,
  }));
  return range ? filterMonthlyToRange(result, resolvedFy, range) : result;
}

export interface MonthlyOccupancyTarget {
  fy: string;
  monthNumber: number;
  month: string;
  targetOccupancyPct: number;
  achievedOccupancyPct: number;
}

export async function getOccupancyTargetVsAchieved(fy?: string, range?: DateRange): Promise<MonthlyOccupancyTarget[]> {
  const resolvedFy = fy ?? currentFYLabel();
  const rows = await runQuery<{ fy: string; month_number: number; month: string; target_occ: number | null; achieved_occ: number | null }>(`
    SELECT Financial_Year AS fy, Month_Number AS month_number, Month AS month,
      AVG(Target_Occupancy_Percent) AS target_occ, AVG(Achieved_Occupancy_Percent) AS achieved_occ
    FROM ${table("leadership_targets")}
    WHERE Financial_Year = @fy
    GROUP BY fy, month_number, month
    ORDER BY month_number
  `, { fy: resolvedFy });

  const mapped = rows.map((r) => ({
    fy: r.fy,
    monthNumber: r.month_number,
    month: r.month,
    targetOccupancyPct: r.target_occ ?? 0,
    achievedOccupancyPct: r.achieved_occ ?? 0,
  }));
  return range ? filterMonthlyToRange(mapped, resolvedFy, range) : mapped;
}
