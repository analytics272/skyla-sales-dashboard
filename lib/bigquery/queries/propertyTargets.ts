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
 * 2026-09-07: the period filter now applies here too — and 2026-09-07,
 * eleventh pass: fixed a real bug from that same-day change, caught by
 * comparing this section's "Total Achieved" against Overview's "Room
 * Revenue" for the identical This FY / All Properties selection and finding
 * they didn't match (11.48 Cr vs 10.12 Cr). The two sides of this comparison
 * need two DIFFERENT ranges on the "This FY" tab, not one shared range:
 *
 * - `targetRange`: the whole FY 26-27 on the This FY tab (annual-attainment
 *   reading — "38% of this year's 28 Cr goal" is the number leadership
 *   actually wants, not a target re-prorated down to "today's slice of the
 *   year", which would land near 100% by construction and stop meaning
 *   anything), prorated down to the actual range on every other tab.
 * - `achievedRange`: ALWAYS the period's own `current` range (to-date on
 *   This FY, exact bounds everywhere else) — the same "to-date" semantics
 *   Overview/Bookings/Leads already use for This FY. The bug: this used to
 *   share `targetRange`, so on This FY the achieved query scoped all the way
 *   to March 2027 — and since sales_booking carries real advance bookings
 *   for future StayDates, that silently pulled in months that haven't
 *   happened yet, overstating "achieved" against every other page's
 *   to-date reading of the same tab.
 *
 * `properties` still fully respects the global Property filter, as before.
 */
export async function getPropertyTargetComparison(properties: string[], filter: PeriodFilter): Promise<PropertyTargetComparisonResult> {
  const period = resolvePeriodFromFilter(filter);
  const targetRange: DateRange = period.key === "this_fy" ? fyBounds(PROPERTY_TARGETS_FY) : period.current;
  const achievedRange: DateRange = period.current;

  const [achievedRows, availableByProperty] = await Promise.all([
    runQuery<AchievedRow>(`
      SELECT Property AS property, SUM(DailyRevenue) AS revenue, COUNT(*) AS nights
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties)
        AND CAST(StayDate AS DATE) BETWEEN @start AND @end
      GROUP BY property
    `, { properties, start: achievedRange.start, end: achievedRange.end }),
    getAvailableRoomNightsByProperty(properties, achievedRange),
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
      const frac = fyMonthOverlapFraction(PROPERTY_TARGETS_FY, t.calendarMonth, targetRange);
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
