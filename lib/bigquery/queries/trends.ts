// PRD §6.3 — Trends, monthly x-axis.
// 2026-09-02: rewritten for the Today/This FY/Last Year period-tabs model —
// instead of "one line per selected FY", Trends now shows a single line for
// the active period's months, grouped by calendar month within
// resolved.period.current (naturally a single point under "Today").
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter } from "./filters";
import { getAvailableRoomNightsByProperty } from "./propertyWindows";
import { getLpMonthlyPoints, getLpCategoryMix, LP_PROPERTY } from "./lpMonthly";
import { bookingCategorySqlExpr, BookingCategory } from "@/lib/reference/bookingSourceMap";
import { DateRange } from "@/lib/reference/financialYear";
import { safeDivide } from "@/lib/format/currency";

export interface MonthlyTrendPoint {
  monthStartDate: string; // ISO date, 1st of month — sort/x-axis key
  monthLabel: string; // e.g. "Apr 2025"
  soldRoomNights: number;
  revenue: number;
  availableRoomNights: number;
  occupancyPct: number | null;
  adr: number | null;
  revPar: number | null;
}

interface RawTrendRow {
  month_start: string;
  nights: number;
  revenue: number | null;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabelOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

async function fetchMonthlyPoints(properties: string[], range: DateRange, includeLp: boolean): Promise<MonthlyTrendPoint[]> {
  const [rows, lpPoints] = await Promise.all([
    runQuery<RawTrendRow>(`
      SELECT
        CAST(DATE_TRUNC(CAST(StayDate AS DATE), MONTH) AS STRING) AS month_start,
        COUNT(*) AS nights,
        SUM(DailyRevenue) AS revenue
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end
      GROUP BY month_start
      ORDER BY month_start
    `, { properties, start: range.start, end: range.end }),
    includeLp ? getLpMonthlyPoints(range) : Promise.resolve([]),
  ]);

  const merged = new Map<string, { nights: number; revenue: number }>();
  for (const r of rows) merged.set(r.month_start, { nights: r.nights, revenue: r.revenue ?? 0 });
  for (const lp of lpPoints) {
    const existing = merged.get(lp.monthStartDate);
    if (existing) {
      existing.nights += lp.soldRoomNights;
      existing.revenue += lp.revenue;
    } else {
      merged.set(lp.monthStartDate, { nights: lp.soldRoomNights, revenue: lp.revenue });
    }
  }

  const points: MonthlyTrendPoint[] = [];
  for (const [monthStart, m] of merged) {
    const monthEnd = new Date(`${monthStart}T00:00:00`);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    const clampedEnd = monthEnd.toISOString().slice(0, 10) < range.end ? monthEnd.toISOString().slice(0, 10) : range.end;
    const clampedStart = monthStart > range.start ? monthStart : range.start;
    const byProperty = await getAvailableRoomNightsByProperty(properties, { start: clampedStart, end: clampedEnd });
    const availableRoomNights = Object.values(byProperty).reduce((s, n) => s + n, 0);

    points.push({
      monthStartDate: monthStart,
      monthLabel: monthLabelOf(monthStart),
      soldRoomNights: m.nights,
      revenue: m.revenue,
      availableRoomNights,
      occupancyPct: safeDivide(m.nights, availableRoomNights),
      adr: safeDivide(m.revenue, m.nights),
      revPar: safeDivide(m.revenue, availableRoomNights),
    });
  }
  return points.sort((a, b) => a.monthStartDate.localeCompare(b.monthStartDate));
}

export interface TrendSeries {
  current: MonthlyTrendPoint[];
  previous: MonthlyTrendPoint[];
}

export async function getMonthlyTrends(filter: KpiFilter): Promise<TrendSeries> {
  const resolved = resolveFilter(filter);
  const includeLp = resolved.properties.includes(LP_PROPERTY);
  const [current, previous] = await Promise.all([
    fetchMonthlyPoints(resolved.properties, resolved.period.current, includeLp),
    fetchMonthlyPoints(resolved.properties, resolved.period.previous, includeLp),
  ]);
  return { current, previous };
}

export interface CategoryAdrStat {
  category: BookingCategory;
  nights: number;
  revenue: number;
  adr: number | null;
}

async function fetchCategoryMix(properties: string[], range: DateRange, includeLp: boolean): Promise<CategoryAdrStat[]> {
  const [rows, lpRows] = await Promise.all([
    runQuery<{ category: BookingCategory; nights: number; revenue: number | null }>(`
      SELECT ${bookingCategorySqlExpr("Source")} AS category, COUNT(*) AS nights, SUM(DailyRevenue) AS revenue
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end
      GROUP BY category
    `, { properties, start: range.start, end: range.end }),
    includeLp ? getLpCategoryMix(range) : Promise.resolve([]),
  ]);

  const merged = new Map<BookingCategory, { nights: number; revenue: number }>();
  for (const r of rows) merged.set(r.category, { nights: r.nights, revenue: r.revenue ?? 0 });
  for (const lp of lpRows) {
    const existing = merged.get(lp.category);
    if (existing) {
      existing.nights += lp.nights;
      existing.revenue += lp.revenue;
    } else {
      merged.set(lp.category, { nights: lp.nights, revenue: lp.revenue });
    }
  }
  return [...merged.entries()].map(([category, v]) => ({ category, ...v, adr: safeDivide(v.revenue, v.nights) }));
}

/** Business-category (B2B/B2C/OTA) revenue/nights/ADR for the active period only — used for Trends' category chart. */
export async function getBusinessCategoryAdr(filter: KpiFilter): Promise<CategoryAdrStat[]> {
  const resolved = resolveFilter(filter);
  const includeLp = resolved.properties.includes(LP_PROPERTY);
  return fetchCategoryMix(resolved.properties, resolved.period.current, includeLp);
}
