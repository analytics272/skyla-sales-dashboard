// Revenue Targets by Property (Targets tab) — the fixed FY 26-27 per-property
// targets from lib/reference/propertyTargets.ts, compared against real
// achieved figures queried live from sales_booking (PMS data). Per user
// direction 2026-08-25: targets are static reference values, achieved is
// always live BigQuery.
import { runQuery, table } from "../client";
import { PROPERTY_TARGETS_FY27, PROPERTY_TARGETS_FY } from "@/lib/reference/propertyTargets";
import { fyBounds, fyMonthOverlapFraction, DateRange } from "@/lib/reference/financialYear";
import { PeriodFilter, resolvePeriodFromFilter } from "@/lib/reference/period";
import { getAvailableRoomNightsByProperty } from "./propertyWindows";
import { safeDivide } from "@/lib/format/currency";

export interface PropertyTargetComparison {
  property: string;
  targetRevenue: number;
  achievedRevenue: number;
  achievedPct: number | null;
  targetOccPct: number | null;
  achievedOccPct: number | null;
  targetArr: number | null;
  achievedArr: number | null;
}

export interface PropertyTargetComparisonResult {
  rows: PropertyTargetComparison[];
  /**
   * Computed from the true underlying totals (summed sold/available nights
   * and revenue across every included property), not by averaging each
   * property's own Occ%/ARR ratio — averaging ratios across properties with
   * very different room counts would misrepresent the combined figure.
   */
  total: PropertyTargetComparison;
}

interface AchievedRow {
  property: string;
  revenue: number | null;
  nights: number;
}

/**
 * 2026-09-07: the period filter now applies here too. The "This FY" tab
 * keeps the original whole-FY-26-27 comparison (annual-attainment reading —
 * "38% of this year's 28 Cr goal" is the number leadership actually wants
 * from that tab, not a target re-prorated down to "today's slice of the
 * year", which would land near 100% by construction and stop meaning
 * anything). Every other tab (Today/This Month/Last 7/30 Days/Custom Range)
 * scopes both sides to that tab's actual date range: the achieved side is a
 * live sales_booking query (already fully re-scopable), and each of the
 * fixed 12 monthly target rows below is prorated by its day-overlap with
 * the selected range via fyMonthOverlapFraction (0 for a month the range
 * doesn't touch, 1 for a month it fully contains, a fraction in between).
 * `properties` still fully respects the global Property filter, as before.
 */
export async function getPropertyTargetComparison(properties: string[], filter: PeriodFilter): Promise<PropertyTargetComparisonResult> {
  const period = resolvePeriodFromFilter(filter);
  const range: DateRange = period.key === "this_fy" ? fyBounds(PROPERTY_TARGETS_FY) : period.current;

  const [achievedRows, availableByProperty] = await Promise.all([
    runQuery<AchievedRow>(`
      SELECT Property AS property, SUM(DailyRevenue) AS revenue, COUNT(*) AS nights
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties)
        AND CAST(StayDate AS DATE) BETWEEN @start AND @end
      GROUP BY property
    `, { properties, start: range.start, end: range.end }),
    getAvailableRoomNightsByProperty(properties, range),
  ]);

  let totalTargetRevenue = 0;
  let totalAchievedRevenue = 0;
  let totalTargetSoldNights = 0;
  let totalTargetAvailable = 0;
  let totalAchievedNights = 0;
  let totalAvailable = 0;

  const rows = properties.map((code) => {
    const targets = PROPERTY_TARGETS_FY27[code] ?? [];
    let targetRevenue = 0;
    let targetSoldNights = 0;
    let targetAvailable = 0;
    for (const t of targets) {
      const frac = fyMonthOverlapFraction(PROPERTY_TARGETS_FY, t.calendarMonth, range);
      if (frac <= 0) continue;
      targetRevenue += t.revenue * frac;
      targetSoldNights += t.available * t.occPct * frac;
      targetAvailable += t.available * frac;
    }

    const achieved = achievedRows.find((r) => r.property === code);
    const achievedRevenue = achieved?.revenue ?? 0;
    const achievedNights = achieved?.nights ?? 0;
    const available = availableByProperty[code] ?? 0;

    totalTargetRevenue += targetRevenue;
    totalAchievedRevenue += achievedRevenue;
    totalTargetSoldNights += targetSoldNights;
    totalTargetAvailable += targetAvailable;
    totalAchievedNights += achievedNights;
    totalAvailable += available;

    return {
      property: code,
      targetRevenue,
      achievedRevenue,
      achievedPct: safeDivide(achievedRevenue, targetRevenue),
      targetOccPct: safeDivide(targetSoldNights, targetAvailable),
      achievedOccPct: safeDivide(achievedNights, available),
      targetArr: safeDivide(targetRevenue, targetSoldNights),
      achievedArr: safeDivide(achievedRevenue, achievedNights),
    };
  });

  const total: PropertyTargetComparison = {
    property: "Total",
    targetRevenue: totalTargetRevenue,
    achievedRevenue: totalAchievedRevenue,
    achievedPct: safeDivide(totalAchievedRevenue, totalTargetRevenue),
    targetOccPct: safeDivide(totalTargetSoldNights, totalTargetAvailable),
    achievedOccPct: safeDivide(totalAchievedNights, totalAvailable),
    targetArr: safeDivide(totalTargetRevenue, totalTargetSoldNights),
    achievedArr: safeDivide(totalAchievedRevenue, totalAchievedNights),
  };

  return { rows, total };
}
