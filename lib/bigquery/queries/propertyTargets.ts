// Revenue Targets by Property (Targets tab) — the fixed FY 26-27 per-property
// targets from lib/reference/propertyTargets.ts, compared against real
// achieved figures queried live from sales_booking (PMS data). Per user
// direction 2026-08-25: targets are static reference values, achieved is
// always live BigQuery.
import { runQuery, table } from "../client";
import { PROPERTY_TARGETS_FY27, PROPERTY_TARGETS_FY } from "@/lib/reference/propertyTargets";
import { fyLabelSqlExpr, fyBounds } from "@/lib/reference/financialYear";
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
 * The active period tab is intentionally ignored — these fixed targets only
 * exist for FY 26-27, so this section always compares against the whole of
 * FY 26-27 regardless of which tab (Today/This FY/Last Year) is selected
 * elsewhere on the page (same convention as the real-time "pace" cards).
 * `properties` fully respects the global Property filter, unlike the rest of
 * the Targets tab (leadership_targets has no Property column to filter by —
 * a genuine data constraint) — this section's target side comes from the
 * fixed per-property reference data instead, so it can be, and is, scoped.
 */
export async function getPropertyTargetComparison(properties: string[]): Promise<PropertyTargetComparisonResult> {
  const [achievedRows, availableByProperty] = await Promise.all([
    runQuery<AchievedRow>(`
      SELECT Property AS property, SUM(DailyRevenue) AS revenue, COUNT(*) AS nights
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties)
        AND ${fyLabelSqlExpr("CAST(StayDate AS DATE)")} = @fy
      GROUP BY property
    `, { properties, fy: PROPERTY_TARGETS_FY }),
    getAvailableRoomNightsByProperty(properties, fyBounds(PROPERTY_TARGETS_FY)),
  ]);

  let totalTargetRevenue = 0;
  let totalAchievedRevenue = 0;
  let totalTargetSoldNights = 0;
  let totalTargetAvailable = 0;
  let totalAchievedNights = 0;
  let totalAvailable = 0;

  const rows = properties.map((code) => {
    const targets = PROPERTY_TARGETS_FY27[code] ?? [];
    const targetRevenue = targets.reduce((s, t) => s + t.revenue, 0);
    const targetSoldNights = targets.reduce((s, t) => s + t.available * t.occPct, 0);
    const targetAvailable = targets.reduce((s, t) => s + t.available, 0);

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
