// PRD §6.3 — Trends (by Financial Year), monthly x-axis.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter } from "./filters";
import { getAvailableRoomNightsByProperty } from "./propertyWindows";
import { getLpMonthlyPoints, getLpCategoryByFy, LP_PROPERTY } from "./lpMonthly";
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
  // LP (LP Integration PRD Addendum, 2026-08-26) has zero sales_booking rows —
  // merged in from sales_booking_lp_monthly when selected. Not scoped by FY
  // here (getLpMonthlyPoints([]) = every FY LP has data for), matching this
  // function's own "always all FYs, Month filter doesn't apply" convention.
  const includeLp = resolved.properties.includes(LP_PROPERTY);

  const [rows, lpPoints] = await Promise.all([
    runQuery<RawTrendRow>(`
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
    `, { properties: resolved.properties }),
    includeLp ? getLpMonthlyPoints([]) : Promise.resolve([]),
  ]);

  const merged = new Map<string, { fy: string; month: number; monthName: string; nights: number; revenue: number }>();
  for (const r of rows) {
    merged.set(`${r.fy}|${r.month}`, {
      fy: r.fy,
      month: r.month,
      monthName: r.month_name ?? MONTH_NAMES[r.month - 1],
      nights: r.nights,
      revenue: r.revenue ?? 0,
    });
  }
  for (const lp of lpPoints) {
    const key = `${lp.fy}|${lp.month}`;
    const existing = merged.get(key);
    if (existing) {
      existing.nights += lp.soldRoomNights;
      existing.revenue += lp.revenue;
    } else {
      merged.set(key, { fy: lp.fy, month: lp.month, monthName: MONTH_NAMES[lp.month - 1], nights: lp.soldRoomNights, revenue: lp.revenue });
    }
  }

  const points: MonthlyTrendPoint[] = [];
  for (const m of merged.values()) {
    const bounds = fyMonthBounds(m.fy, m.month);
    const byProperty = await getAvailableRoomNightsByProperty(resolved.properties, [bounds]);
    const availableRoomNights = Object.values(byProperty).reduce((s, n) => s + n, 0);

    points.push({
      fy: m.fy,
      month: m.month,
      monthName: m.monthName,
      soldRoomNights: m.nights,
      revenue: m.revenue,
      availableRoomNights,
      occupancyPct: safeDivide(m.nights, availableRoomNights),
      adr: safeDivide(m.revenue, m.nights),
      revPar: safeDivide(m.revenue, availableRoomNights),
    });
  }
  return points.sort((a, b) => (a.fy === b.fy ? a.month - b.month : a.fy.localeCompare(b.fy)));
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
  const includeLp = resolved.properties.includes(LP_PROPERTY);

  const [rows, lpCategoryRows] = await Promise.all([
    runQuery<{ fy: string; category: BookingCategory; nights: number; revenue: number | null }>(`
      SELECT
        ${fyLabelSqlExpr("CAST(StayDate AS DATE)")} AS fy,
        ${bookingCategorySqlExpr("Source")} AS category,
        COUNT(*) AS nights,
        SUM(DailyRevenue) AS revenue
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties)
      GROUP BY fy, category
      ORDER BY fy, category
    `, { properties: resolved.properties }),
    includeLp ? getLpCategoryByFy([]) : Promise.resolve([]),
  ]);

  const merged = new Map<string, { fy: string; category: BookingCategory; nights: number; revenue: number }>();
  for (const r of rows) merged.set(`${r.fy}|${r.category}`, { fy: r.fy, category: r.category, nights: r.nights, revenue: r.revenue ?? 0 });
  for (const lp of lpCategoryRows) {
    const key = `${lp.fy}|${lp.category}`;
    const existing = merged.get(key);
    if (existing) {
      existing.nights += lp.nights;
      existing.revenue += lp.revenue;
    } else {
      merged.set(key, { fy: lp.fy, category: lp.category, nights: lp.nights, revenue: lp.revenue });
    }
  }

  return [...merged.values()].map((m) => ({ ...m, adr: safeDivide(m.revenue, m.nights) }));
}
