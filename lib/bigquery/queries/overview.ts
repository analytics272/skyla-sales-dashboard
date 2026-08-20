// PRD §6.1 — Revenue & Occupancy Overview (sales_booking).
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause } from "./filters";
import { getAvailableRoomNights, rangesForFyAndMonths } from "./propertyWindows";
import { bookingCategorySqlExpr, BookingCategory } from "@/lib/reference/bookingSourceMap";
import { fyBounds, currentFYLabel, parseFyLabel, fyLabel } from "@/lib/reference/financialYear";
import { safeDivide } from "@/lib/format/currency";

export interface SourceBreakdown {
  category: BookingCategory;
  nights: number;
  revenue: number;
}

export interface YoyComparison {
  currentFY: string;
  currentRevenue: number;
  priorFY: string;
  priorRevenue: number;
  pctChange: number | null;
}

export interface OverviewKpis {
  roomRevenue: number;
  extrasRevenue: number;
  soldRoomNights: number;
  availableRoomNights: number;
  adr: number | null;
  occupancyPct: number | null;
  revPar: number | null;
  bySource: SourceBreakdown[];
  yoy: YoyComparison;
}

interface AggRow {
  room_revenue: number | null;
  extras_revenue: number | null;
  sold_room_nights: number;
}

interface SourceRow {
  category: BookingCategory;
  nights: number;
  revenue: number | null;
}

interface YoyRow {
  fy: string;
  revenue: number | null;
}

export async function getOverviewKpis(filter: KpiFilter): Promise<OverviewKpis> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");

  const [aggRows, sourceRows, availableRoomNights] = await Promise.all([
    runQuery<AggRow>(`
      SELECT
        SUM(DailyRevenue) AS room_revenue,
        SUM(DailyOtherRevenueInclusiveTax) AS extras_revenue,
        COUNT(*) AS sold_room_nights
      FROM ${table("sales_booking")}
      WHERE ${where}
    `, params),
    runQuery<SourceRow>(`
      SELECT
        ${bookingCategorySqlExpr("Source")} AS category,
        COUNT(*) AS nights,
        SUM(DailyRevenue) AS revenue
      FROM ${table("sales_booking")}
      WHERE ${where}
      GROUP BY category
      ORDER BY revenue DESC
    `, params),
    getAvailableRoomNights(resolved.properties, rangesForFyAndMonths(resolved.fy, resolved.months)),
  ]);

  const agg = aggRows[0] ?? { room_revenue: 0, extras_revenue: 0, sold_room_nights: 0 };
  const roomRevenue = agg.room_revenue ?? 0;
  const soldRoomNights = agg.sold_room_nights ?? 0;

  const yoy = await getYoyComparison(resolved.properties, filter.fy);

  return {
    roomRevenue,
    extrasRevenue: agg.extras_revenue ?? 0,
    soldRoomNights,
    availableRoomNights,
    adr: safeDivide(roomRevenue, soldRoomNights),
    occupancyPct: safeDivide(soldRoomNights, availableRoomNights),
    revPar: safeDivide(roomRevenue, availableRoomNights),
    bySource: sourceRows.map((r) => ({ category: r.category, nights: r.nights, revenue: r.revenue ?? 0 })),
    yoy,
  };
}

async function getYoyComparison(properties: string[], fy?: string): Promise<YoyComparison> {
  const currentFY = fy ?? currentFYLabel();
  const priorFY = fyLabel(parseFyLabel(currentFY) - 1);

  const current = fyBounds(currentFY);
  const prior = fyBounds(priorFY);
  const dateExpr = "CAST(StayDate AS DATE)";

  const rows = await runQuery<YoyRow>(`
    SELECT 'current' AS fy, SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND ${dateExpr} BETWEEN @curStart AND @curEnd
    UNION ALL
    SELECT 'prior' AS fy, SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND ${dateExpr} BETWEEN @priorStart AND @priorEnd
  `, {
    properties,
    curStart: current.start,
    curEnd: current.end,
    priorStart: prior.start,
    priorEnd: prior.end,
  });

  const currentRevenue = rows.find((r) => r.fy === "current")?.revenue ?? 0;
  const priorRevenue = rows.find((r) => r.fy === "prior")?.revenue ?? 0;
  const pctChange = safeDivide(currentRevenue - priorRevenue, priorRevenue);

  return { currentFY, currentRevenue, priorFY, priorRevenue, pctChange };
}
