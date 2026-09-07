// Revenue Targets by Property (Targets tab) — the fixed FY 26-27 per-property
// targets from lib/reference/propertyTargets.ts, compared against real
// achieved figures queried live from sales_booking (PMS data). Per user
// direction 2026-08-25: targets are static reference values, achieved is
// always live BigQuery.
import { runQuery, table } from "../client";
import { PROPERTY_TARGETS_FY27, PROPERTY_TARGETS_FY } from "@/lib/reference/propertyTargets";
import { fyMonthOverlapFraction, DateRange } from "@/lib/reference/financialYear";
import { PeriodFilter, resolvePeriodFromFilter, clampRangeToToday } from "@/lib/reference/period";
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
 * 2026-09-07, twelfth pass: `period.current` for This FY is now the FULL
 * fiscal year, not year-to-date (see period.ts — This FY behaves like every
 * other tab and Custom Range now, so it always means exactly what it says).
 * That resurfaces the eleventh pass's exact bug shape if `current` were used
 * for the achieved side directly: the target reading is meant to be
 * "achieved so far vs. this year's full goal", not "everything already
 * booked for the whole year including months that haven't happened yet".
 * So `targetRange` (the whole selected window — full FY on This FY, prorated
 * per fyMonthOverlapFraction on every other tab) and `achievedRange`
 * (targetRange clamped to today via clampRangeToToday) are still two
 * different things here, same as the eleventh pass established — the only
 * change is that `targetRange` no longer needs its own This-FY special case,
 * since `period.current` already IS the full FY for that tab now. This also
 * now correctly handles This Month (also a full-month range that can extend
 * past today) and a future-extending Custom Range the same way, which the
 * eleventh pass's This-FY-only special case did not.
 * `properties` still fully respects the global Property filter, as before.
 */
export async function getPropertyTargetComparison(properties: string[], filter: PeriodFilter): Promise<PropertyTargetComparisonResult> {
  const period = resolvePeriodFromFilter(filter);
  const targetRange: DateRange = period.current;
  const achievedRange: DateRange = clampRangeToToday(targetRange);

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
