// PRD §6.1 — Revenue & Occupancy Overview (sales_booking).
// 2026-09-02: rewritten for the Today/This FY/Last Year period-tabs model —
// every KPI is now computed for both the active period's `current` and
// `previous` range in one pass, replacing the old FY-multi-select + separate
// getYoyComparison() call (comparison is no longer specifically "vs last
// FY" — it's "vs whatever the active tab's previous range is").
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause, buildPreviousScopeClause, SALES_BOOKING_STAY_FILTER, roomNightUnitsSqlExpr } from "./filters";
import { getAvailableRoomNights, getAvailableRoomNightsByProperty } from "./propertyWindows";
import { getLpOverviewTotals, getLpAdr, LP_PROPERTY } from "./lpMonthly";
import { bookingCategorySqlExpr, bookingIsUnmappedSqlExpr, BookingCategory } from "@/lib/reference/bookingSourceMap";
import { safeDivide } from "@/lib/format/currency";
import { getHistoricalOverrideForRange } from "@/lib/reference/historicalDashboardOverride";
import { HistoricalMonthData } from "@/lib/reference/historicalSheetData";

function sumHistorical(covered: Record<string, HistoricalMonthData>): { roomRevenue: number; soldRoomNights: number; availableRoomNights: number } {
  let roomRevenue = 0, soldRoomNights = 0, availableRoomNights = 0;
  for (const m of Object.values(covered)) {
    roomRevenue += m.revenue;
    soldRoomNights += m.soldRoomNights;
    availableRoomNights += m.availableRoomNights;
  }
  return { roomRevenue, soldRoomNights, availableRoomNights };
}

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
  soldRoomNights: ComparisonMetric;
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
  // Comparisons are strictly opt-in (compareYoY toggle) — no comparison is
  // computed, let alone queried, unless the user turned it on. Without it,
  // every `comparisonMetric` below gets a `null` previous and its pctChange
  // stays null, which is exactly what every StatTile's delta already checks
  // for before rendering — so this alone is enough to hide deltas by default,
  // with no UI-side change needed.
  const compare = filter.compareYoY ?? false;
  // LP (LP Integration PRD Addendum, 2026-08-26) has zero sales_booking rows —
  // its real numbers come from sales_booking_lp_monthly and are merged in
  // here additively when it's in the selected properties and not already
  // covered by the historical override below (both workbooks have full LP
  // rows too — see historicalSheetData.ts's own comment for why LP is
  // covered here at all, unlike the Reports tab's Folio Report, which
  // structurally has no LP column and never will).
  const includeLpBase = resolved.properties.includes(LP_PROPERTY);

  // 2026-09-21 — historical workbook override for a whole-month or whole-FY
  // selection fully inside FY24-25/FY25-26 (see historicalDashboardOverride.ts's
  // header comment for the exact rule). Only the top-line summary fields
  // below (roomRevenue/soldRoomNights/availableRoomNights, and everything
  // derived from them) are overridden — `bySource` has no reliable sheet
  // equivalent (neither workbook splits nights by category, and FY25-26's
  // has no B2B/B2C/OTA split at all) so it stays fully BigQuery-computed
  // for every requested property regardless of override coverage (LP's own
  // category slice is simply absent from bySource for a covered range,
  // same accepted limitation as every other overridden property). Properties
  // the workbook doesn't cover for this exact range (GB outside its active
  // window in either sheet; LP for any range outside both sheets' coverage)
  // fall back to BigQuery same as today — never zeroed, never partially summed.
  const historicalCurrent = getHistoricalOverrideForRange(resolved.properties, resolved.period.current);
  const historicalPrevious = compare ? getHistoricalOverrideForRange(resolved.properties, resolved.period.previous) : {};
  const uncoveredCurrentProps = resolved.properties.filter((p) => !(p in historicalCurrent));
  const uncoveredPreviousProps = resolved.properties.filter((p) => !(p in historicalPrevious));
  // LP's live query only runs when LP is requested AND not already covered
  // by history for that specific range (current/previous can differ).
  const includeLp = includeLpBase && !(LP_PROPERTY in historicalCurrent);
  const includeLpPrevious = includeLpBase && !(LP_PROPERTY in historicalPrevious);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", { ...resolved, properties: uncoveredCurrentProps }, "");
  const { clause: sourceWhere, params: sourceParams } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  // 2026-09-22 — per explicit user direction, the FY24-25 workbook's B2B
  // Achieved/B2C Achieved rows (the only one of the two with a category
  // split at all) override this breakdown's B2B/B2C REVENUE per covered
  // property — see getCategoryMix's identical, more-commented version in
  // guestDetail.ts (Bookings' own Revenue Mix) for the full reasoning,
  // including why OTA revenue and every category's nights stay live.
  const b2bSplitCoveredCurrent = new Set(Object.entries(historicalCurrent).filter(([, m]) => m.b2bRevenue !== undefined).map(([p]) => p));

  const [aggRows, prevAggRows, sourceRows, availableRoomNights, prevAvailableRoomNights, lpCurrent, lpPrevious] = await Promise.all([
    uncoveredCurrentProps.length === 0
      ? Promise.resolve([{ room_revenue: 0, extras_revenue: 0, sold_room_nights: 0 }])
      : runQuery<AggRow>(`
      SELECT SUM(DailyRevenue) AS room_revenue, SUM(DailyOtherRevenueExclusiveTax) AS extras_revenue, SUM(${roomNightUnitsSqlExpr()}) AS sold_room_nights
      FROM ${table("sales_booking")}
      WHERE ${where}
    `, params),
    compare
      ? (uncoveredPreviousProps.length === 0
          ? Promise.resolve([{ room_revenue: 0, extras_revenue: 0, sold_room_nights: 0 }])
          : (() => {
              const { clause: prevWhere, params: prevParams } = buildPreviousScopeClause(
                "Property", "CAST(StayDate AS DATE)", { ...resolved, properties: uncoveredPreviousProps }, "prev"
              );
              return runQuery<AggRow>(`
                SELECT SUM(DailyRevenue) AS room_revenue, SUM(DailyOtherRevenueExclusiveTax) AS extras_revenue, SUM(${roomNightUnitsSqlExpr()}) AS sold_room_nights
                FROM ${table("sales_booking")}
                WHERE ${prevWhere}
              `, prevParams);
            })())
      : Promise.resolve(null),
    runQuery<SourceRow & { property: string }>(`
      SELECT Property AS property, ${bookingCategorySqlExpr("Source")} AS category, SUM(${roomNightUnitsSqlExpr()}) AS nights, SUM(DailyRevenue) AS revenue
      FROM ${table("sales_booking")}
      WHERE ${sourceWhere}
      GROUP BY property, category
    `, sourceParams),
    getAvailableRoomNights(uncoveredCurrentProps, resolved.period.current),
    compare ? getAvailableRoomNights(uncoveredPreviousProps, resolved.period.previous) : Promise.resolve(null),
    includeLp ? getLpOverviewTotals(resolved.period.current) : null,
    includeLpPrevious && compare ? getLpOverviewTotals(resolved.period.previous) : null,
  ]);

  const agg = aggRows[0] ?? { room_revenue: 0, extras_revenue: 0, sold_room_nights: 0 };
  const histCurrent = sumHistorical(historicalCurrent);
  let roomRevenue = (agg.room_revenue ?? 0) + histCurrent.roomRevenue;
  let extrasRevenue = agg.extras_revenue ?? 0;
  let soldRoomNights = (agg.sold_room_nights ?? 0) + histCurrent.soldRoomNights;
  const availableRoomNightsTotal = availableRoomNights + histCurrent.availableRoomNights;

  const prevAgg = prevAggRows ? prevAggRows[0] ?? { room_revenue: 0, extras_revenue: 0, sold_room_nights: 0 } : null;
  const histPrevious = sumHistorical(historicalPrevious);
  let prevRoomRevenue: number | null = prevAgg ? (prevAgg.room_revenue ?? 0) + histPrevious.roomRevenue : null;
  let prevSoldRoomNights: number | null = prevAgg ? (prevAgg.sold_room_nights ?? 0) + histPrevious.soldRoomNights : null;
  const prevAvailableRoomNightsTotal: number | null = prevAvailableRoomNights !== null ? prevAvailableRoomNights + histPrevious.availableRoomNights : null;

  const bySourceMap = new Map<BookingCategory, { nights: number; revenue: number }>();
  const addSource = (category: BookingCategory, nights: number, revenue: number) => {
    const existing = bySourceMap.get(category) ?? { nights: 0, revenue: 0 };
    bySourceMap.set(category, { nights: existing.nights + nights, revenue: existing.revenue + revenue });
  };
  for (const r of sourceRows) {
    const useWorkbookRevenue = b2bSplitCoveredCurrent.has(r.property) && (r.category === "B2B" || r.category === "B2C");
    addSource(r.category, r.nights, useWorkbookRevenue ? 0 : r.revenue ?? 0);
  }
  for (const property of b2bSplitCoveredCurrent) {
    const m = historicalCurrent[property];
    addSource("B2B", 0, m.b2bRevenue ?? 0);
    addSource("B2C", 0, m.b2cRevenue ?? 0);
  }

  if (lpCurrent) {
    roomRevenue += lpCurrent.roomRevenue;
    extrasRevenue += lpCurrent.extrasRevenue;
    soldRoomNights += lpCurrent.soldRoomNights;
    for (const s of lpCurrent.bySource) {
      const existing = bySourceMap.get(s.category) ?? { nights: 0, revenue: 0 };
      bySourceMap.set(s.category, { nights: existing.nights + s.nights, revenue: existing.revenue + s.revenue });
    }
  }
  if (lpPrevious && prevRoomRevenue !== null && prevSoldRoomNights !== null) {
    prevRoomRevenue += lpPrevious.roomRevenue;
    prevSoldRoomNights += lpPrevious.soldRoomNights;
  }

  const bySource = [...bySourceMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const adr = safeDivide(roomRevenue, soldRoomNights);
  const occupancyPct = safeDivide(soldRoomNights, availableRoomNightsTotal);
  const revPar = safeDivide(roomRevenue, availableRoomNightsTotal);
  const prevAdr = prevRoomRevenue !== null && prevSoldRoomNights !== null ? safeDivide(prevRoomRevenue, prevSoldRoomNights) : null;
  const prevOccupancyPct = prevSoldRoomNights !== null && prevAvailableRoomNightsTotal !== null ? safeDivide(prevSoldRoomNights, prevAvailableRoomNightsTotal) : null;
  const prevRevPar = prevRoomRevenue !== null && prevAvailableRoomNightsTotal !== null ? safeDivide(prevRoomRevenue, prevAvailableRoomNightsTotal) : null;

  return {
    roomRevenue,
    extrasRevenue,
    soldRoomNights,
    availableRoomNights: availableRoomNightsTotal,
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
      soldRoomNights: comparisonMetric(soldRoomNights, prevSoldRoomNights),
    },
  };
}

export interface UnmappedSourceStats {
  count: number;
  revenue: number;
  /** Distinct raw Source values behind `count`/`revenue`, largest revenue first — enough to name the culprit in a caption without a separate drill-down UI. */
  sources: { source: string; count: number; revenue: number }[];
}

/**
 * 2026-09-08, data-quality warning (§1.3): `bookingCategorySqlExpr` silently
 * defaults any Source value it doesn't recognize to B2C — which is exactly
 * how `CS`/`Sales`/`TS`/`Walk in` went unnoticed for two years (₹13.5 Cr
 * combined, fixed this same day — see Skyla_Dashboard_KPI_Logic_Reference.md
 * revision history). `bookingIsUnmappedSqlExpr` already existed for this but
 * was never wired into anything. This surfaces it as a lightweight, purely
 * additive indicator — does NOT change how any booking is classified or
 * counted anywhere else; a Source already covered by the map (including the
 * fallback OTA/B2B pattern regexes bookingCategorySqlExpr also checks) never
 * shows up here, only genuinely unrecognized ones like the known `'33'`
 * data-entry glitch (§10).
 */
export async function getUnmappedSourceStats(filter: KpiFilter): Promise<UnmappedSourceStats> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  const rows = await runQuery<{ source: string | null; count: number; revenue: number | null }>(`
    SELECT Source AS source, COUNT(*) AS count, SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE ${where} AND ${bookingIsUnmappedSqlExpr("Source")}
    GROUP BY source
    ORDER BY revenue DESC
  `, params);
  const sources = rows.map((r) => ({ source: r.source ?? "(blank)", count: r.count, revenue: r.revenue ?? 0 }));
  return {
    count: sources.reduce((s, r) => s + r.count, 0),
    revenue: sources.reduce((s, r) => s + r.revenue, 0),
    sources,
  };
}

export interface PropertyAdr {
  property: string;
  revenue: number;
  nights: number;
  adr: number | null;
  availableRoomNights: number;
  occupancyPct: number | null;
}

// 2026-09-18: availableRoomNights/occupancyPct added alongside the existing
// revenue/ADR fields — see brandCategory.ts's getBrandOccupancy header
// comment for why (Overview's "ADR & Occupancy Ranking" card now shows
// Revenue/ADR/Occupancy as separate tabs under both By Property and By
// Brand, not one fixed metric per grouping).
/** ADR (+ revenue, occupancy) broken out per property, for the same scope as getOverviewKpis. */
export async function getAdrByProperty(filter: KpiFilter): Promise<PropertyAdr[]> {
  const resolved = resolveFilter(filter);
  // 2026-09-21 — same historical-workbook override as getOverviewKpis (see
  // that function's own comment, and historicalDashboardOverride.ts). This
  // function is already grouped by property, so the override is simpler:
  // query BigQuery only for the uncovered properties, then push a row
  // straight from the workbook for each covered one.
  const historical = getHistoricalOverrideForRange(resolved.properties, resolved.period.current);
  const uncoveredProps = resolved.properties.filter((p) => !(p in historical));
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", { ...resolved, properties: uncoveredProps }, "");
  const [rows, availableByProperty] = await Promise.all([
    uncoveredProps.length === 0
      ? Promise.resolve([])
      : runQuery<{ property: string; revenue: number | null; nights: number }>(`
      SELECT Property AS property, SUM(DailyRevenue) AS revenue, SUM(${roomNightUnitsSqlExpr()}) AS nights
      FROM ${table("sales_booking")}
      WHERE ${where}
      GROUP BY property
      ORDER BY revenue DESC
    `, params),
    getAvailableRoomNightsByProperty(uncoveredProps, resolved.period.current),
  ]);
  const result = rows.map((r) => {
    const available = availableByProperty[r.property] ?? 0;
    return {
      property: r.property,
      revenue: r.revenue ?? 0,
      nights: r.nights,
      adr: safeDivide(r.revenue ?? 0, r.nights),
      availableRoomNights: available,
      occupancyPct: safeDivide(r.nights, available),
    };
  });

  for (const [property, m] of Object.entries(historical)) {
    result.push({
      property,
      revenue: m.revenue,
      nights: m.soldRoomNights,
      adr: safeDivide(m.revenue, m.soldRoomNights),
      availableRoomNights: m.availableRoomNights,
      occupancyPct: safeDivide(m.soldRoomNights, m.availableRoomNights),
    });
  }

  // LP has zero sales_booking rows — its own row comes from sales_booking_lp_monthly instead, unless already covered by the historical override above (both workbooks have LP rows — see historicalSheetData.ts).
  if (resolved.properties.includes(LP_PROPERTY) && !(LP_PROPERTY in historical)) {
    const lp = await getLpAdr(resolved.period.current);
    if (lp.nights > 0 || lp.revenue > 0) {
      const lpAvailable = availableByProperty[LP_PROPERTY] ?? 0;
      result.push({ property: LP_PROPERTY, revenue: lp.revenue, nights: lp.nights, adr: lp.adr, availableRoomNights: lpAvailable, occupancyPct: safeDivide(lp.nights, lpAvailable) });
    }
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
      SELECT SUM(${roomNightUnitsSqlExpr()}) AS n FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end AND ${SALES_BOOKING_STAY_FILTER}
    `, { properties, start, end }),
    getAvailableRoomNights(properties, { start, end }),
  ]);
  return safeDivide(soldRows[0]?.n ?? 0, available);
}
