// PRD §6.5 — Targets vs Achieved (leadership_targets). Company-wide, not
// property-scoped (no Property column on this table) — global Property filter
// doesn't apply here. Month_Number is already FY-relative (Apr=1 ... Mar=12),
// matching fiscal quarters directly: Q1=1-3, Q2=4-6, Q3=7-9, Q4=10-12.
import { runQuery, table } from "../client";
import { currentFYLabel, DateFilter, resolveSelectedFYs, resolveSelectedMonths } from "@/lib/reference/financialYear";
import { safeDivide } from "@/lib/format/currency";

export type TargetsFilter = DateFilter;

function fiscalMonthNumber(calendarMonth: number): number {
  return calendarMonth >= 4 ? calendarMonth - 3 : calendarMonth + 9;
}

function whereForFilter(filter: TargetsFilter): { clause: string; params: Record<string, unknown> } {
  const fys = resolveSelectedFYs(filter);
  const params: Record<string, unknown> = { fys };
  const conditions = ["Financial_Year IN UNNEST(@fys)"];

  const months = resolveSelectedMonths(filter);
  if (months.length > 0) {
    params.monthNums = months.map(fiscalMonthNumber);
    conditions.push("Month_Number IN UNNEST(@monthNums)");
  }

  return { clause: conditions.join(" AND "), params };
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
  const { clause, params } = whereForFilter(filter);
  const rows = await runQuery<CategoryAchievementRow>(`
    SELECT
      SUM(B2B_Target) AS b2b_target, SUM(B2B_Achieved) AS b2b_achieved,
      SUM(B2C_Target) AS b2c_target, SUM(B2C_Achieved) AS b2c_achieved,
      SUM(OTA_Target) AS ota_target, SUM(OTA_Achieved) AS ota_achieved
    FROM ${table("leadership_targets")}
    WHERE ${clause}
  `, params);

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

export async function getRevenueAchievement(filter: TargetsFilter): Promise<RevenueAchievement> {
  const { clause, params } = whereForFilter(filter);
  const rows = await runQuery<{ target: number | null; achieved: number | null; target_with_roll_over: number | null }>(`
    SELECT
      SUM(dept_Total_Target) AS target,
      SUM(Revenue_Achieved) AS achieved,
      SUM(Target_With_Roll_Over) AS target_with_roll_over
    FROM ${table("leadership_targets")}
    WHERE ${clause}
  `, params);

  const r = rows[0] ?? { target: 0, achieved: 0, target_with_roll_over: 0 };
  const target = r.target ?? 0;
  const achieved = r.achieved ?? 0;
  return { target, achieved, achievedPct: safeDivide(achieved, target), targetWithRollOver: r.target_with_roll_over ?? 0 };
}

export interface MonthlyRevenueTarget {
  monthNumber: number;
  month: string;
  deptTarget: number;
  targetWithRollOver: number;
  achievedRevenue: number;
}

/** Monthly "Revenue Targets with Roll Over" — dept target vs target-with-rollover vs achieved, matching the legacy dashboard's 3-line view. */
export async function getMonthlyRevenueTargets(fy?: string): Promise<MonthlyRevenueTarget[]> {
  const rows = await runQuery<{
    month_number: number;
    month: string;
    dept_target: number | null;
    target_with_roll_over: number | null;
    achieved: number | null;
  }>(`
    SELECT Month_Number AS month_number, Month AS month,
      SUM(dept_Total_Target) AS dept_target,
      SUM(Target_With_Roll_Over) AS target_with_roll_over,
      SUM(Revenue_Achieved) AS achieved
    FROM ${table("leadership_targets")}
    WHERE Financial_Year = @fy
    GROUP BY month_number, month
    ORDER BY month_number
  `, { fy: fy ?? currentFYLabel() });

  return rows.map((r) => ({
    monthNumber: r.month_number,
    month: r.month,
    deptTarget: r.dept_target ?? 0,
    targetWithRollOver: r.target_with_roll_over ?? 0,
    achievedRevenue: r.achieved ?? 0,
  }));
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
