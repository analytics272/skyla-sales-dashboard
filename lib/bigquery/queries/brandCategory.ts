// PRD §6.4 — Brand & Business Category.
// 2026-09-02: rewritten for the Today/This FY/Last Year period-tabs model.
// getCategoryRevenueByFy was folded into trends.ts's getBusinessCategoryAdr()
// (both computed the same B2B/B2C/OTA current-period breakdown) — Brand's
// page reuses that instead of duplicating the query.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause, roomNightUnitsSqlExpr } from "./filters";
import { getAvailableRoomNightsByProperty } from "./propertyWindows";
import { getLpOverviewTotals, LP_PROPERTY } from "./lpMonthly";
import { Brand, brandOf } from "@/lib/reference/propertyReference";
import { safeDivide } from "@/lib/format/currency";

export interface BrandOccupancy {
  brand: Brand;
  revenue: number;
  soldRoomNights: number;
  availableRoomNights: number;
  occupancyPct: number | null;
  adr: number | null;
}

// 2026-09-18: revenue/adr added alongside the existing occupancy fields —
// Overview's "ADR & Occupancy Ranking" card now shows Revenue/ADR/
// Occupancy as separate tabs under both By Property and By Brand (was
// ADR-only under By Property, Occupancy-only under By Brand — two
// different metrics on the two tabs, with no way to see a property's
// occupancy or a brand's ADR at all).
export async function getBrandOccupancy(filter: KpiFilter): Promise<BrandOccupancy[]> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  const includeLp = resolved.properties.includes(LP_PROPERTY);

  // getAvailableRoomNightsByProperty already correctly includes LP (its
  // window comes from sales_booking_lp_monthly — see propertyWindows.ts) —
  // only the sold-nights/revenue side needs LP merged in, since
  // sales_booking itself has zero LP rows.
  const [nightsRows, availableByProperty, lpTotals] = await Promise.all([
    runQuery<{ property: string; nights: number; revenue: number | null }>(`
      SELECT Property AS property, SUM(${roomNightUnitsSqlExpr()}) AS nights, SUM(DailyRevenue) AS revenue
      FROM ${table("sales_booking")}
      WHERE ${where}
      GROUP BY property
    `, params),
    getAvailableRoomNightsByProperty(resolved.properties, resolved.period.current),
    includeLp ? getLpOverviewTotals(resolved.period.current) : Promise.resolve(null),
  ]);

  const byBrand = new Map<Brand, { sold: number; available: number; revenue: number }>();
  for (const property of resolved.properties) {
    const brand = brandOf(property);
    if (!brand) continue;
    if (!byBrand.has(brand)) byBrand.set(brand, { sold: 0, available: 0, revenue: 0 });
    byBrand.get(brand)!.available += availableByProperty[property] ?? 0;
  }
  for (const r of nightsRows) {
    const brand = brandOf(r.property);
    if (!brand || !byBrand.has(brand)) continue;
    byBrand.get(brand)!.sold += r.nights;
    byBrand.get(brand)!.revenue += r.revenue ?? 0;
  }
  if (includeLp && lpTotals && (lpTotals.soldRoomNights > 0 || lpTotals.roomRevenue > 0)) {
    const lpBrand = brandOf(LP_PROPERTY);
    if (lpBrand && byBrand.has(lpBrand)) {
      byBrand.get(lpBrand)!.sold += lpTotals.soldRoomNights;
      byBrand.get(lpBrand)!.revenue += lpTotals.roomRevenue;
    }
  }

  return [...byBrand.entries()].map(([brand, v]) => ({
    brand,
    revenue: v.revenue,
    soldRoomNights: v.sold,
    availableRoomNights: v.available,
    occupancyPct: safeDivide(v.sold, v.available),
    adr: safeDivide(v.revenue, v.sold),
  }));
}
