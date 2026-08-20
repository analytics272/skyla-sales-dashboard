// PRD §6.3 — Trends (by Financial Year), monthly x-axis.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter } from "./filters";
import { getAvailableRoomNightsByProperty } from "./propertyWindows";
import { bookingCategorySqlExpr, BookingCategory } from "@/lib/reference/bookingSourceMap";
import { fyLabelSqlExpr, fyMonthBounds } from "@/lib/reference/financialYear";
import { safeDivide } from "@/lib/format/currency";

export interface MonthlyTrendPoint {
  fy: string;
  month: number; // calendar month, 1-12
  monthName: string;
  soldRoomNights: number;
  revenue: number;
  availableRoomNights: number;
  occupancyPct: number | null;
  adr: number | null;
  revPar: number | null;
}

interface RawTrendRow {
  fy: string;
  month: number;
  month_name: string;
  nights: number;
  revenue: number | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function getMonthlyTrends(
  filter: Pick<KpiFilter, "properties">
): Promise<MonthlyTrendPoint[]> {
  const resolved = resolveFilter(filter);

  const rows = await runQuery<RawTrendRow>(`
    SELECT
      ${fyLabelSqlExpr("CAST(StayDate AS DATE)")} AS fy,
      EXTRACT(MONTH FROM CAST(StayDate AS DATE)) AS month,
      FORMAT_DATE('%B', CAST(StayDate AS DATE)) AS month_name,
      COUNT(*) AS nights,
      SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties)
    GROUP BY fy, month, month_name
    ORDER BY fy, month
  `, { properties: resolved.properties });

  const points: MonthlyTrendPoint[] = [];
  for (const r of rows) {
    const bounds = fyMonthBounds(r.fy, r.month);
    const byProperty = await getAvailableRoomNightsByProperty(resolved.properties, [bounds]);
    const availableRoomNights = Object.values(byProperty).reduce((s, n) => s + n, 0);
    const revenue = r.revenue ?? 0;

    points.push({
      fy: r.fy,
      month: r.month,
      monthName: r.month_name ?? MONTH_NAMES[r.month - 1],
      soldRoomNights: r.nights,
      revenue,
      availableRoomNights,
      occupancyPct: safeDivide(r.nights, availableRoomNights),
      adr: safeDivide(revenue, r.nights),
      revPar: safeDivide(revenue, availableRoomNights),
    });
  }
  return points;
}

export interface CategoryAdrPoint {
  fy: string;
  category: BookingCategory;
  nights: number;
  revenue: number;
  adr: number | null;
}

export async function getBusinessCategoryAdrTrend(
  filter: Pick<KpiFilter, "properties">
): Promise<CategoryAdrPoint[]> {
  const resolved = resolveFilter(filter);

  const rows = await runQuery<{ fy: string; category: BookingCategory; nights: number; revenue: number | null }>(`
    SELECT
      ${fyLabelSqlExpr("CAST(StayDate AS DATE)")} AS fy,
      ${bookingCategorySqlExpr("Source")} AS category,
      COUNT(*) AS nights,
      SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties)
    GROUP BY fy, category
    ORDER BY fy, category
  `, { properties: resolved.properties });

  return rows.map((r) => ({
    fy: r.fy,
    category: r.category,
    nights: r.nights,
    revenue: r.revenue ?? 0,
    adr: safeDivide(r.revenue ?? 0, r.nights),
  }));
}
