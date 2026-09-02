"use client";

import { BrandOccupancy } from "@/lib/bigquery/queries/brandCategory";
import { CategoryAdrStat } from "@/lib/bigquery/queries/trends";
import Card from "@/components/ui/Card";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import DonutChart from "@/components/charts/DonutChart";
import { formatIndianCurrency } from "@/lib/format/currency";
import { CATEGORY_COLOR, CATEGORY_ORDER, BRAND_COLOR, BRAND_ORDER } from "@/lib/design/tokens";

export default function BrandContent({
  brandOccupancy,
  categoryAdr,
}: {
  brandOccupancy: BrandOccupancy[];
  categoryAdr: CategoryAdrStat[];
}) {
  const brandData: BarDatum[] = BRAND_ORDER.filter((b) => brandOccupancy.some((r) => r.brand === b)).map((b) => ({
    name: b,
    value: (brandOccupancy.find((r) => r.brand === b)?.occupancyPct ?? 0) * 100,
    color: BRAND_COLOR[b],
  }));

  const categoriesPresent = CATEGORY_ORDER.filter((c) => categoryAdr.some((r) => r.category === c));
  const revenueDonut = categoriesPresent.map((c) => {
    const r = categoryAdr.find((x) => x.category === c)!;
    return { name: c, value: r.revenue, color: CATEGORY_COLOR[c] };
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Brand</h2>

      <Card title="Occupancy By Brand">
        <SingleMetricBarChart data={brandData} valueFormatter={(v) => `${v.toFixed(0)}%`} />
      </Card>

      <Card title="Revenue By Business Category">
        <DonutChart data={revenueDonut} valueFormatter={(v) => formatIndianCurrency(v)} />
      </Card>
    </div>
  );
}
