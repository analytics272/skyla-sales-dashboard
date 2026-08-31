// PRD §6.7 — OTA Breakdown. Commission/net-revenue uses sales_booking + §3.2 table.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause } from "./filters";
import { bookingCategorySqlExpr, otaBreakdownDisplayNameSqlExpr } from "@/lib/reference/bookingSourceMap";
import { commissionRateSqlExpr } from "@/lib/reference/otaCommission";
import { safeDivide } from "@/lib/format/currency";

export interface OtaBreakdownRow {
  otaName: string;
  nights: number;
  totalRevenue: number;
  avgCommissionPct: number; // revenue-weighted average (properties can carry different rates for the same OTA, e.g. Booking.com)
  netRevenue: number;
  adrBeforeCommission: number | null;
  adrAfterCommission: number | null;
}

interface OtaRow {
  ota_name: string;
  nights: number;
  total_revenue: number | null;
  net_revenue: number | null;
}

export async function getOtaBreakdown(filter: KpiFilter): Promise<OtaBreakdownRow[]> {
  const resolved = resolveFilter(filter);
  const { clause: scopeClause, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  const where = `${scopeClause} AND ${bookingCategorySqlExpr("Source")} = 'OTA'`;

  const rows = await runQuery<OtaRow>(`
    SELECT
      ${otaBreakdownDisplayNameSqlExpr("Source")} AS ota_name,
      COUNT(*) AS nights,
      SUM(DailyRevenue) AS total_revenue,
      SUM(DailyRevenue * (1 - ${commissionRateSqlExpr("TRIM(Source)", "Property")} / 100)) AS net_revenue
    FROM ${table("sales_booking")}
    WHERE ${where}
    GROUP BY ota_name
    ORDER BY total_revenue DESC
  `, params);

  return rows.map((r) => {
    const totalRevenue = r.total_revenue ?? 0;
    const netRevenue = r.net_revenue ?? 0;
    return {
      otaName: r.ota_name,
      nights: r.nights,
      totalRevenue,
      avgCommissionPct: totalRevenue > 0 ? (1 - netRevenue / totalRevenue) * 100 : 0,
      netRevenue,
      adrBeforeCommission: safeDivide(totalRevenue, r.nights),
      adrAfterCommission: safeDivide(netRevenue, r.nights),
    };
  });
}
