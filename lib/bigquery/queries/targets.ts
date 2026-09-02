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
import { currentFYLabel, fyLabel, parseFyLabel, calendarMonthFromFiscal, isFutureFiscalMonth, fiscalMonthNumber } from "@/lib/reference/financialYear";
import { PeriodFilter, resolvePeriodFromFilter } from "@/lib/reference/period";
import { safeDivide } from "@/lib/format/currency";

export type TargetsFilter = PeriodFilter;

export { fiscalMonthNumber };

/** The single FY leadership_targets should be read from for the active period tab. */
export function resolveTargetsFy(filter: TargetsFilter): string {
  const period = resolvePeriodFromFilter(filter);
  return currentFYLabel(new Date(`${period.current.start}T00:00:00`));
}

export interface CategoryAchievement {
  category: "B2B" | "B2C" | "OTA";
  target: number;
  achieved: number;
  achievedPct: number | null;
}

interface CategoryAchievementRow {
  b2b_target: number | null;
  b2b_achieved: number | null;
  b2c_target: number | null;
  b2c_achieved: number | null;
  ota_target: number | null;
  ota_achieved: number | null;
}

export async function getCategoryAchievement(filter: TargetsFilter): Promise<CategoryAchievement[]> {
  const fy = resolveTargetsFy(filter);
  const rows = await runQuery<CategoryAchievementRow>(`
    SELECT
      SUM(B2B_Target) AS b2b_target, SUM(B2B_Achieved) AS b2b_achieved,
      SUM(B2C_Target) AS b2c_target, SUM(B2C_Achieved) AS b2c_achieved,
      SUM(OTA_Target) AS ota_target, SUM(OTA_Achieved) AS ota_achieved
    FROM ${table("leadership_targets")}
    WHERE Financial_Year = @fy
  `, { fy });

  const r = rows[0] ?? {
    b2b_target: 0, b2b_achieved: 0, b2c_target: 0, b2c_achieved: 0, ota_target: 0, ota_achieved: 0,
  };

  return [
    { category: "B2B", target: r.b2b_target ?? 0, achieved: r.b2b_achieved ?? 0, achievedPct: safeDivide(r.b2b_achieved ?? 0, r.b2b_target ?? 0) },
    { category: "B2C", target: r.b2c_target ?? 0, achieved: r.b2c_achieved ?? 0, achievedPct: safeDivide(r.b2c_achieved ?? 0, r.b2c_target ?? 0) },
    { category: "OTA", target: r.ota_target ?? 0, achieved: r.ota_achieved ?? 0, achievedPct: safeDivide(r.ota_achieved ?? 0, r.ota_target ?? 0) },
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
export async function getMonthlyRevenueTargets(fy?: string): Promise<MonthlyRevenueTarget[]> {
  const resolvedFy = fy ?? currentFYLabel();
  const [rows, seedShortfall] = await Promise.all([getRawMonthlyRows(resolvedFy), getPriorMarchShortfall(resolvedFy)]);
  return computeRollover(resolvedFy, rows, seedShortfall);
}

function summarize(data: MonthlyRevenueTarget[]): RevenueAchievement {
  let target = 0;
  let achieved = 0;
  let targetWithRollOver = 0;
  for (const r of data) {
    target += r.deptTarget;
    achieved += r.achievedRevenue;
    targetWithRollOver += r.targetWithRollOver;
  }
  return { target, achieved, achievedPct: safeDivide(achieved, target), targetWithRollOver };
}

/** Whole-FY summary — target sums the full planned year, achieved is naturally 0 for any month that hasn't happened, so this is already a "to-date vs full-year-plan" reading. Prefer this over re-fetching when `getMonthlyRevenueTargets` was already called for the chart. */
export function summarizeRevenueAchievement(data: MonthlyRevenueTarget[]): RevenueAchievement {
  return summarize(data);
}

/** Convenience wrapper that fetches its own data. */
export async function getRevenueAchievement(filter: TargetsFilter): Promise<RevenueAchievement> {
  const fy = resolveTargetsFy(filter);
  const data = await getMonthlyRevenueTargets(fy);
  return summarize(data);
}

export interface MonthlyAdrTarget {
  fy: string;
  monthNumber: number;
  month: string; // e.g. "Apr 25"
  targetAdr: number;
  achievedAdr: number;
}

export async function getAdrTargetVsAchieved(fy?: string): Promise<MonthlyAdrTarget[]> {
  const rows = await runQuery<{ fy: string; month_number: number; month: string; target_adr: number | null; achieved_adr: number | null }>(`
    SELECT Financial_Year AS fy, Month_Number AS month_number, Month AS month,
      AVG(Target_ADR) AS target_adr, AVG(Achieved_ADR) AS achieved_adr
    FROM ${table("leadership_targets")}
    WHERE Financial_Year = @fy
    GROUP BY fy, month_number, month
    ORDER BY month_number
  `, { fy: fy ?? currentFYLabel() });

  return rows.map((r) => ({
    fy: r.fy,
    monthNumber: r.month_number,
    month: r.month,
    targetAdr: r.target_adr ?? 0,
    achievedAdr: r.achieved_adr ?? 0,
  }));
}

export interface MonthlyOccupancyTarget {
  fy: string;
  monthNumber: number;
  month: string;
  targetOccupancyPct: number;
  achievedOccupancyPct: number;
}

export async function getOccupancyTargetVsAchieved(fy?: string): Promise<MonthlyOccupancyTarget[]> {
  const rows = await runQuery<{ fy: string; month_number: number; month: string; target_occ: number | null; achieved_occ: number | null }>(`
    SELECT Financial_Year AS fy, Month_Number AS month_number, Month AS month,
      AVG(Target_Occupancy_Percent) AS target_occ, AVG(Achieved_Occupancy_Percent) AS achieved_occ
    FROM ${table("leadership_targets")}
    WHERE Financial_Year = @fy
    GROUP BY fy, month_number, month
    ORDER BY month_number
  `, { fy: fy ?? currentFYLabel() });

  return rows.map((r) => ({
    fy: r.fy,
    monthNumber: r.month_number,
    month: r.month,
    targetOccupancyPct: r.target_occ ?? 0,
    achievedOccupancyPct: r.achieved_occ ?? 0,
  }));
}
