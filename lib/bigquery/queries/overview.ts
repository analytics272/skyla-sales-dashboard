// PRD §6.1 — Revenue & Occupancy Overview (sales_booking).
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause } from "./filters";
import { getAvailableRoomNights, rangesForFysAndMonths } from "./propertyWindows";
import { getLpOverviewTotals, getLpAdr, LP_PROPERTY } from "./lpMonthly";
import { bookingCategorySqlExpr, BookingCategory } from "@/lib/reference/bookingSourceMap";
import { fyBounds, currentFYLabel, parseFyLabel, fyLabel } from "@/lib/reference/financialYear";
import { safeDivide } from "@/lib/format/currency";

export interface SourceBreakdown {
  category: BookingCategory;
  nights: number;
  revenue: number;
}

export interface YoyMetric {
  current: number | null;
  prior: number | null;
  pctChange: number | null;
}

export interface YoyComparison {
  currentFY: string;
  currentRevenue: number;
  priorFY: string;
  priorRevenue: number;
  pctChange: number | null;
  adr: YoyMetric;
  occupancyPct: YoyMetric;
  revPar: YoyMetric;
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
  // LP (LP Integration PRD Addendum, 2026-08-26) has zero sales_booking rows —
  // its real numbers come from sales_booking_lp_monthly and are merged in
  // here additively when it's in the selected properties.
  const includeLp = resolved.properties.includes(LP_PROPERTY);

  const [aggRows, sourceRows, availableRoomNights, lpTotals] = await Promise.all([
    runQuery<AggRow>(`
      SELECT
        SUM(DailyRevenue) AS room_revenue,
        SUM(DailyOtherRevenueExclusiveTax) AS extras_revenue,
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
    getAvailableRoomNights(resolved.properties, rangesForFysAndMonths(resolved.fys, resolved.months)),
    includeLp ? getLpOverviewTotals(resolved.fys, resolved.months) : null,
  ]);

  const agg = aggRows[0] ?? { room_revenue: 0, extras_revenue: 0, sold_room_nights: 0 };
  let roomRevenue = agg.room_revenue ?? 0;
  let extrasRevenue = agg.extras_revenue ?? 0;
  let soldRoomNights = agg.sold_room_nights ?? 0;

  const bySourceMap = new Map<BookingCategory, { nights: number; revenue: number }>();
  for (const r of sourceRows) bySourceMap.set(r.category, { nights: r.nights, revenue: r.revenue ?? 0 });

  if (lpTotals) {
    roomRevenue += lpTotals.roomRevenue;
    extrasRevenue += lpTotals.extrasRevenue;
    soldRoomNights += lpTotals.soldRoomNights;
    for (const s of lpTotals.bySource) {
      const existing = bySourceMap.get(s.category) ?? { nights: 0, revenue: 0 };
      bySourceMap.set(s.category, { nights: existing.nights + s.nights, revenue: existing.revenue + s.revenue });
    }
  }

  const bySource = [...bySourceMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // With multiple FYs selected, YoY compares the latest selected FY against the year before it.
  const latestSelectedFy = [...resolved.fys].sort().at(-1);
  const yoy = await getYoyComparison(resolved.properties, latestSelectedFy);

  return {
    roomRevenue,
    extrasRevenue,
    soldRoomNights,
    availableRoomNights,
    adr: safeDivide(roomRevenue, soldRoomNights),
    occupancyPct: safeDivide(soldRoomNights, availableRoomNights),
    revPar: safeDivide(roomRevenue, availableRoomNights),
    bySource,
    yoy,
  };
}

export interface PropertyAdr {
  property: string;
  revenue: number;
  nights: number;
  adr: number | null;
}

/** ADR broken out per property, for the same scope as getOverviewKpis. */
export async function getAdrByProperty(filter: KpiFilter): Promise<PropertyAdr[]> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  const rows = await runQuery<{ property: string; revenue: number | null; nights: number }>(`
    SELECT Property AS property, SUM(DailyRevenue) AS revenue, COUNT(*) AS nights
    FROM ${table("sales_booking")}
    WHERE ${where}
    GROUP BY property
    ORDER BY revenue DESC
  `, params);
  const result = rows.map((r) => ({ property: r.property, revenue: r.revenue ?? 0, nights: r.nights, adr: safeDivide(r.revenue ?? 0, r.nights) }));

  // LP has zero sales_booking rows — its own row comes from sales_booking_lp_monthly instead.
  if (resolved.properties.includes(LP_PROPERTY)) {
    const lp = await getLpAdr(resolved.fys, resolved.months);
    if (lp.nights > 0 || lp.revenue > 0) result.push({ property: LP_PROPERTY, revenue: lp.revenue, nights: lp.nights, adr: lp.adr });
  }

  return result.sort((a, b) => b.revenue - a.revenue);
}

export interface OccupancyPace {
  /** Single calendar month — the last one that's fully finished. Not cumulative FY-to-date. */
  lastMonth: number | null;
  lastMonthLabel: string; // e.g. "July 2026"
  /** Current calendar month, whole-month basis — nights already on the books (past + future days within this month) ÷ the month's available room nights. Will keep rising until the month ends. */
  presentMonth: number | null;
  presentMonthLabel: string; // e.g. "August 2026 (in progress)"
  /** Next calendar month's forward booking pace — same "still rising" caveat as presentMonth, just one month further out. */
  nextMonth: number | null;
  nextMonthLabel: string; // e.g. "September 2026"
}

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(d: Date): string {
  return `${MONTH_NAMES_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * A real-time "where do we stand right now" pace indicator — always relative
 * to today's actual date, independent of the FY/Month filter (which is about
 * historical reporting periods, not "right now"). Only the Property filter
 * applies. Implementation call: the PRD doesn't define this metric; this
 * mirrors a standard hotel revenue-management pace view: last month (single,
 * finished), this month (in progress, whole-month basis), next month (early
 * pickup) — three consecutive, non-overlapping calendar months.
 */
export async function getOccupancyPace(properties: string[]): Promise<OccupancyPace> {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const presentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const presentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  const [lastMonth, presentMonth, nextMonth] = await Promise.all([
    occupancyForRange(properties, iso(lastMonthStart), iso(lastMonthEnd)),
    occupancyForRange(properties, iso(presentMonthStart), iso(presentMonthEnd)),
    occupancyForRange(properties, iso(nextMonthStart), iso(nextMonthEnd)),
  ]);

  return {
    lastMonth,
    lastMonthLabel: monthLabel(lastMonthStart),
    presentMonth,
    presentMonthLabel: `${monthLabel(presentMonthStart)} (in progress)`,
    nextMonth,
    nextMonthLabel: monthLabel(nextMonthStart),
  };
}

async function occupancyForRange(properties: string[], start: string, end: string): Promise<number | null> {
  const [soldRows, available] = await Promise.all([
    runQuery<{ n: number }>(`
      SELECT COUNT(*) AS n FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end
    `, { properties, start, end }),
    getAvailableRoomNights(properties, [{ start, end }]),
  ]);
  return safeDivide(soldRows[0]?.n ?? 0, available);
}

export interface LastMonthCategorySnapshot {
  label: string; // e.g. "July 2026"
  items: SourceBreakdown[];
  totalRevenue: number;
}

/**
 * B2B/B2C/OTA revenue split for last calendar month specifically (not the
 * filter's FY/Month scope) — a "how did we do recently" read that sits above
 * the period-total hero figure, same real-time convention as getOccupancyPace.
 */
export async function getLastMonthCategoryBreakdown(properties: string[]): Promise<LastMonthCategorySnapshot> {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const rows = await runQuery<SourceRow>(`
    SELECT ${bookingCategorySqlExpr("Source")} AS category, COUNT(*) AS nights, SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end
    GROUP BY category
    ORDER BY revenue DESC
  `, { properties, start: iso(start), end: iso(end) });

  const items = rows.map((r) => ({ category: r.category, nights: r.nights, revenue: r.revenue ?? 0 }));
  return { label: monthLabel(start), items, totalRevenue: items.reduce((s, i) => s + i.revenue, 0) };
}

function yoyMetric(current: number | null, prior: number | null): YoyMetric {
  return { current, prior, pctChange: current !== null && prior !== null ? safeDivide(current - prior, prior) : null };
}

async function getYoyComparison(properties: string[], fy?: string): Promise<YoyComparison> {
  const currentFY = fy ?? currentFYLabel();
  const priorFY = fyLabel(parseFyLabel(currentFY) - 1);

  const current = fyBounds(currentFY);
  const prior = fyBounds(priorFY);
  const dateExpr = "CAST(StayDate AS DATE)";
  const includeLp = properties.includes(LP_PROPERTY);

  const [rows, currentAvailable, priorAvailable, lpCurrent, lpPrior] = await Promise.all([
    runQuery<YoyRow & { nights: number }>(`
      SELECT 'current' AS fy, SUM(DailyRevenue) AS revenue, COUNT(*) AS nights
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties) AND ${dateExpr} BETWEEN @curStart AND @curEnd
      UNION ALL
      SELECT 'prior' AS fy, SUM(DailyRevenue) AS revenue, COUNT(*) AS nights
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties) AND ${dateExpr} BETWEEN @priorStart AND @priorEnd
    `, {
      properties,
      curStart: current.start,
      curEnd: current.end,
      priorStart: prior.start,
      priorEnd: prior.end,
    }),
    getAvailableRoomNights(properties, [current]),
    getAvailableRoomNights(properties, [prior]),
    includeLp ? getLpOverviewTotals([currentFY], []) : null,
    includeLp ? getLpOverviewTotals([priorFY], []) : null,
  ]);

  const currentRevenue = (rows.find((r) => r.fy === "current")?.revenue ?? 0) + (lpCurrent?.roomRevenue ?? 0);
  const priorRevenue = (rows.find((r) => r.fy === "prior")?.revenue ?? 0) + (lpPrior?.roomRevenue ?? 0);
  const currentNights = (rows.find((r) => r.fy === "current")?.nights ?? 0) + (lpCurrent?.soldRoomNights ?? 0);
  const priorNights = (rows.find((r) => r.fy === "prior")?.nights ?? 0) + (lpPrior?.soldRoomNights ?? 0);
  const pctChange = safeDivide(currentRevenue - priorRevenue, priorRevenue);

  return {
    currentFY,
    currentRevenue,
    priorFY,
    priorRevenue,
    pctChange,
    adr: yoyMetric(safeDivide(currentRevenue, currentNights), safeDivide(priorRevenue, priorNights)),
    occupancyPct: yoyMetric(safeDivide(currentNights, currentAvailable), safeDivide(priorNights, priorAvailable)),
    revPar: yoyMetric(safeDivide(currentRevenue, currentAvailable), safeDivide(priorRevenue, priorAvailable)),
  };
}
