// PRD §6.4 — Brand & Business Category.
// 2026-09-02: rewritten for the Today/This FY/Last Year period-tabs model.
// getCategoryRevenueByFy was folded into trends.ts's getBusinessCategoryAdr()
// (both computed the same B2B/B2C/OTA current-period breakdown) — Brand's
// page reuses that instead of duplicating the query.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause } from "./filters";
import { getAvailableRoomNightsByProperty } from "./propertyWindows";
import { getLpSoldRoomNights, LP_PROPERTY } from "./lpMonthly";
import { Brand, brandOf } from "@/lib/reference/propertyReference";
import { safeDivide } from "@/lib/format/currency";

export interface BrandOccupancy {
  brand: Brand;
  soldRoomNights: number;
  availableRoomNights: number;
  occupancyPct: number | null;
}

export async function getBrandOccupancy(filter: KpiFilter): Promise<BrandOccupancy[]> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  const includeLp = resolved.properties.includes(LP_PROPERTY);

  // getAvailableRoomNightsByProperty already correctly includes LP (its
  // window comes from sales_booking_lp_monthly — see propertyWindows.ts) —
  // only the sold-nights side needs LP merged in, since sales_booking itself
  // has zero LP rows.
  const [nightsRows, availableByProperty, lpSoldNights] = await Promise.all([
    runQuery<{ property: string; nights: number }>(`
      SELECT Property AS property, COUNT(*) AS nights
      FROM ${table("sales_booking")}
      WHERE ${where}
      GROUP BY property
    `, params),
    getAvailableRoomNightsByProperty(resolved.properties, resolved.period.current),
    includeLp ? getLpSoldRoomNights(resolved.period.current) : 0,
  ]);

  const byBrand = new Map<Brand, { sold: number; available: number }>();
  for (const property of resolved.properties) {
    const brand = brandOf(property);
    if (!brand) continue;
    if (!byBrand.has(brand)) byBrand.set(brand, { sold: 0, available: 0 });
    byBrand.get(brand)!.available += availableByProperty[property] ?? 0;
  }
  for (const r of nightsRows) {
    const brand = brandOf(r.property);
    if (!brand || !byBrand.has(brand)) continue;
    byBrand.get(brand)!.sold += r.nights;
  }
  if (includeLp && lpSoldNights > 0) {
    const lpBrand = brandOf(LP_PROPERTY);
    if (lpBrand && byBrand.has(lpBrand)) byBrand.get(lpBrand)!.sold += lpSoldNights;
  }

  return [...byBrand.entries()].map(([brand, v]) => ({
    brand,
    soldRoomNights: v.sold,
    availableRoomNights: v.available,
    occupancyPct: safeDivide(v.sold, v.available),
  }));
}
