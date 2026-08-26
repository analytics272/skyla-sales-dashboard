// PRD §6.4 — Brand & Business Category.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause } from "./filters";
import { getAvailableRoomNightsByProperty, rangesForFysAndMonths } from "./propertyWindows";
import { getLpSoldRoomNights, getLpCategoryByFy, LP_PROPERTY } from "./lpMonthly";
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
    getAvailableRoomNightsByProperty(resolved.properties, rangesForFysAndMonths(resolved.fys, resolved.months)),
    includeLp ? getLpSoldRoomNights(resolved.fys, resolved.months) : 0,
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

export interface CategoryRevenueByFy {
  fy: string;
  category: BookingCategory;
  revenue: number;
}

export async function getCategoryRevenueByFy(
  filter: Pick<KpiFilter, "properties">
): Promise<CategoryRevenueByFy[]> {
  const resolved = resolveFilter(filter);
  const includeLp = resolved.properties.includes(LP_PROPERTY);

  const [rows, lpRows] = await Promise.all([
    runQuery<CategoryRevenueByFy>(`
      SELECT
        ${fyLabelSqlExpr("CAST(StayDate AS DATE)")} AS fy,
        ${bookingCategorySqlExpr("Source")} AS category,
        SUM(DailyRevenue) AS revenue
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties)
      GROUP BY fy, category
      ORDER BY fy, category
    `, { properties: resolved.properties }),
    includeLp ? getLpCategoryByFy([]) : Promise.resolve([]),
  ]);

  const merged = new Map<string, CategoryRevenueByFy>();
  for (const r of rows) merged.set(`${r.fy}|${r.category}`, r);
  for (const lp of lpRows) {
    const key = `${lp.fy}|${lp.category}`;
    const existing = merged.get(key);
    if (existing) existing.revenue += lp.revenue;
    else merged.set(key, { fy: lp.fy, category: lp.category, revenue: lp.revenue });
  }

  return [...merged.values()].sort((a, b) => (a.fy === b.fy ? a.category.localeCompare(b.category) : a.fy.localeCompare(b.fy)));
}
