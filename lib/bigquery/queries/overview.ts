// PRD §6.1 — Revenue & Occupancy Overview (sales_booking).
// 2026-09-02: rewritten for the Today/This FY/Last Year period-tabs model —
// every KPI is now computed for both the active period's `current` and
// `previous` range in one pass, replacing the old FY-multi-select + separate
// getYoyComparison() call (comparison is no longer specifically "vs last
// FY" — it's "vs whatever the active tab's previous range is").
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause, buildPreviousScopeClause } from "./filters";
import { getAvailableRoomNights } from "./propertyWindows";
import { getLpOverviewTotals, getLpAdr, LP_PROPERTY } from "./lpMonthly";
import { bookingCategorySqlExpr, BookingCategory } from "@/lib/reference/bookingSourceMap";
import { safeDivide } from "@/lib/format/currency";

export interface SourceBreakdown {
  category: BookingCategory;
  nights: number;
  revenue: number;
}

export interface ComparisonMetric {
  current: number | null;
  previous: number | null;
  pctChange: number | null;
}

export interface PeriodComparison {
  currentLabel: string;
  previousLabel: string;
  revenue: ComparisonMetric;
  adr: ComparisonMetric;
  occupancyPct: ComparisonMetric;
  revPar: ComparisonMetric;
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
  comparison: PeriodComparison;
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

function comparisonMetric(current: number | null, previous: number | null): ComparisonMetric {
  return { current, previous, pctChange: current !== null && previous !== null ? safeDivide(current - previous, previous) : null };
}

export async function getOverviewKpis(filter: KpiFilter): Promise<OverviewKpis> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  const { clause: prevWhere, params: prevParams } = buildPreviousScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "prev");
  // LP (LP Integration PRD Addendum, 2026-08-26) has zero sales_booking rows —
  // its real numbers come from sales_booking_lp_monthly and are merged in
  // here additively when it's in the selected properties.
  const includeLp = resolved.properties.includes(LP_PROPERTY);

  const [aggRows, prevAggRows, sourceRows, availableRoomNights, prevAvailableRoomNights, lpCurrent, lpPrevious] = await Promise.all([
    runQuery<AggRow>(`
      SELECT SUM(DailyRevenue) AS room_revenue, SUM(DailyOtherRevenueExclusiveTax) AS extras_revenue, COUNT(*) AS sold_room_nights
      FROM ${table("sales_booking")}
      WHERE ${where}
    `, params),
    runQuery<AggRow>(`
      SELECT SUM(DailyRevenue) AS room_revenue, SUM(DailyOtherRevenueExclusiveTax) AS extras_revenue, COUNT(*) AS sold_room_nights
      FROM ${table("sales_booking")}
      WHERE ${prevWhere}
    `, prevParams),
    runQuery<SourceRow>(`
      SELECT ${bookingCategorySqlExpr("Source")} AS category, COUNT(*) AS nights, SUM(DailyRevenue) AS revenue
      FROM ${table("sales_booking")}
      WHERE ${where}
      GROUP BY category
      ORDER BY revenue DESC
    `, params),
    getAvailableRoomNights(resolved.properties, resolved.period.current),
    getAvailableRoomNights(resolved.properties, resolved.period.previous),
    includeLp ? getLpOverviewTotals(resolved.period.current) : null,
    includeLp ? getLpOverviewTotals(resolved.period.previous) : null,
  ]);

  const agg = aggRows[0] ?? { room_revenue: 0, extras_revenue: 0, sold_room_nights: 0 };
  let roomRevenue = agg.room_revenue ?? 0;
  let extrasRevenue = agg.extras_revenue ?? 0;
  let soldRoomNights = agg.sold_room_nights ?? 0;

  const prevAgg = prevAggRows[0] ?? { room_revenue: 0, extras_revenue: 0, sold_room_nights: 0 };
  let prevRoomRevenue = prevAgg.room_revenue ?? 0;
  let prevSoldRoomNights = prevAgg.sold_room_nights ?? 0;

  const bySourceMap = new Map<BookingCategory, { nights: number; revenue: number }>();
  for (const r of sourceRows) bySourceMap.set(r.category, { nights: r.nights, revenue: r.revenue ?? 0 });

  if (lpCurrent) {
    roomRevenue += lpCurrent.roomRevenue;
    extrasRevenue += lpCurrent.extrasRevenue;
    soldRoomNights += lpCurrent.soldRoomNights;
    for (const s of lpCurrent.bySource) {
      const existing = bySourceMap.get(s.category) ?? { nights: 0, revenue: 0 };
      bySourceMap.set(s.category, { nights: existing.nights + s.nights, revenue: existing.revenue + s.revenue });
    }
  }
  if (lpPrevious) {
    prevRoomRevenue += lpPrevious.roomRevenue;
    prevSoldRoomNights += lpPrevious.soldRoomNights;
  }

  const bySource = [...bySourceMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const adr = safeDivide(roomRevenue, soldRoomNights);
  const occupancyPct = safeDivide(soldRoomNights, availableRoomNights);
  const revPar = safeDivide(roomRevenue, availableRoomNights);
  const prevAdr = safeDivide(prevRoomRevenue, prevSoldRoomNights);
  const prevOccupancyPct = safeDivide(prevSoldRoomNights, prevAvailableRoomNights);
  const prevRevPar = safeDivide(prevRoomRevenue, prevAvailableRoomNights);

  return {
    roomRevenue,
    extrasRevenue,
    soldRoomNights,
    availableRoomNights,
    adr,
    occupancyPct,
    revPar,
    bySource,
    comparison: {
      currentLabel: resolved.period.currentLabel,
      previousLabel: resolved.period.previousLabel,
      revenue: comparisonMetric(roomRevenue, prevRoomRevenue),
      adr: comparisonMetric(adr, prevAdr),
      occupancyPct: comparisonMetric(occupancyPct, prevOccupancyPct),
      revPar: comparisonMetric(revPar, prevRevPar),
    },
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
    const lp = await getLpAdr(resolved.period.current);
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
 * to today's actual date, independent of the active period tab (which is
 * about historical reporting periods, not "right now"). Only the Property
 * filter applies. Implementation call: the PRD doesn't define this metric;
 * this mirrors a standard hotel revenue-management pace view: last month
 * (single, finished), this month (in progress, whole-month basis), next
 * month (early pickup) — three consecutive, non-overlapping calendar months.
 */
export async function getOccupancyPace(properties: string[]): Promise<OccupancyPace> {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const presentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [lastMonth, presentMonth, nextMonth] = await Promise.all([
    occupancyForRange(properties, iso(lastMonthStart), iso(lastMonthEnd)),
    occupancyForRange(properties, iso(presentMonthStart), iso(new Date(today.getFullYear(), today.getMonth() + 1, 0))),
    occupancyForRange(properties, iso(nextMonthStart), iso(new Date(today.getFullYear(), today.getMonth() + 2, 0))),
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
    getAvailableRoomNights(properties, { start, end }),
  ]);
  return safeDivide(soldRows[0]?.n ?? 0, available);
}
