// PRD §6.4 — Brand & Business Category.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause } from "./filters";
import { getAvailableRoomNightsByProperty, rangesForFysAndMonths } from "./propertyWindows";
import { bookingCategorySqlExpr, BookingCategory } from "@/lib/reference/bookingSourceMap";
import { fyLabelSqlExpr } from "@/lib/reference/financialYear";
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

  const [nightsRows, availableByProperty] = await Promise.all([
    runQuery<{ property: string; nights: number }>(`
      SELECT Property AS property, COUNT(*) AS nights
      FROM ${table("sales_booking")}
      WHERE ${where}
      GROUP BY property
    `, params),
    getAvailableRoomNightsByProperty(resolved.properties, rangesForFysAndMonths(resolved.fys, resolved.months)),
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

  return [...byBrand.entries()].map(([brand, v]) => ({
    brand,
    soldRoomNights: v.sold,
    availableRoomNights: v.available,
    occupancyPct: safeDivide(v.sold, v.available),
  }));
}

export interface CategoryRevenueByFy {
  fy: string;
  category: BookingCategory;
  revenue: number;
}

export async function getCategoryRevenueByFy(
  filter: Pick<KpiFilter, "properties">
): Promise<CategoryRevenueByFy[]> {
  const resolved = resolveFilter(filter);

  return runQuery<CategoryRevenueByFy>(`
    SELECT
      ${fyLabelSqlExpr("CAST(StayDate AS DATE)")} AS fy,
      ${bookingCategorySqlExpr("Source")} AS category,
      SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties)
    GROUP BY fy, category
    ORDER BY fy, category
  `, { properties: resolved.properties });
}
