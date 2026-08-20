"use client";

import { BrandOccupancy, CategoryRevenueByFy } from "@/lib/bigquery/queries/brandCategory";
import Card from "@/components/ui/Card";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import { formatIndianCurrency } from "@/lib/format/currency";
import { CATEGORY_COLOR, CATEGORY_ORDER, BRAND_COLOR, BRAND_ORDER } from "@/lib/design/tokens";

export default function BrandContent({
  brandOccupancy,
  categoryRevenueByFy,
}: {
  brandOccupancy: BrandOccupancy[];
  categoryRevenueByFy: CategoryRevenueByFy[];
}) {
  const brandData: BarDatum[] = BRAND_ORDER.filter((b) => brandOccupancy.some((r) => r.brand === b)).map((b) => ({
    name: b,
    value: (brandOccupancy.find((r) => r.brand === b)?.occupancyPct ?? 0) * 100,
    color: BRAND_COLOR[b],
  }));

  const fyOrder = [...new Set(categoryRevenueByFy.map((r) => r.fy))].sort();
  const categoriesPresent = CATEGORY_ORDER.filter((c) => categoryRevenueByFy.some((r) => r.category === c));
  const revenueByFyData = fyOrder.map((fy) => {
    const row: Record<string, unknown> = { fy };
    for (const c of categoriesPresent) {
      row[c] = categoryRevenueByFy.find((r) => r.fy === fy && r.category === c)?.revenue ?? 0;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Brand</h2>

      <Card title="Occupancy by brand (Skyla / Aptly / Hyber)">
        <SingleMetricBarChart data={brandData} valueFormatter={(v) => `${v.toFixed(0)}%`} />
      </Card>

      <Card title="Revenue by business category, by FY">
        <GroupedBarChart
          data={revenueByFyData}
          xKey="fy"
          series={categoriesPresent.map((c) => ({ key: c, color: CATEGORY_COLOR[c] }))}
          valueFormatter={(v) => formatIndianCurrency(v)}
          height={320}
        />
      </Card>
    </div>
  );
}
