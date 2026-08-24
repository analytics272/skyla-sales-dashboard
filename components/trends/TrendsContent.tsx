"use client";

import { MonthlyTrendPoint, CategoryAdrPoint } from "@/lib/bigquery/queries/trends";
import Card from "@/components/ui/Card";
import MultiSeriesLineChart from "@/components/charts/MultiSeriesLineChart";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import { FY_COLOR, CATEGORY_COLOR, CATEGORY_ORDER } from "@/lib/design/tokens";
import { pivotByFiscalMonth } from "@/lib/charts/pivotByFiscalMonth";

export default function TrendsContent({
  monthlyTrends,
  categoryAdrTrend,
}: {
  monthlyTrends: MonthlyTrendPoint[];
  categoryAdrTrend: CategoryAdrPoint[];
}) {
  const fyList = [...new Set(monthlyTrends.map((p) => p.fy))].sort();
  const fySeries = fyList.map((fy) => ({ key: fy, color: FY_COLOR[fy] ?? "var(--chart-baseline)" }));

  const occupancyData = pivotByFiscalMonth(monthlyTrends, fyList, (p) => p.month, (p) => (p.occupancyPct !== null ? p.occupancyPct * 100 : null));
  const revParData = pivotByFiscalMonth(monthlyTrends, fyList, (p) => p.month, (p) => p.revPar);
  const adrData = pivotByFiscalMonth(monthlyTrends, fyList, (p) => p.month, (p) => p.adr);

  const categoriesPresent = CATEGORY_ORDER.filter((c) => categoryAdrTrend.some((r) => r.category === c));
  const categoryAdrByFy = [...new Set(categoryAdrTrend.map((r) => r.fy))].sort().map((fy) => {
    const row: Record<string, unknown> = { fy };
    for (const c of categoriesPresent) {
      row[c] = categoryAdrTrend.find((r) => r.fy === fy && r.category === c)?.adr ?? 0;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Trends</h2>

      <Card title="Occupancy trend (by FY)">
        <MultiSeriesLineChart
          data={occupancyData}
          xKey="monthLabel"
          series={fySeries}
          valueFormatter={(v) => `${v.toFixed(0)}%`}
          yDomain={[0, 100]}
          yTicks={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100]}
        />
      </Card>

      <Card title="RevPAR trend (by FY)">
        <MultiSeriesLineChart data={revParData} xKey="monthLabel" series={fySeries} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
      </Card>

      <Card title="Month-wise ADR (by FY)">
        <MultiSeriesLineChart data={adrData} xKey="monthLabel" series={fySeries} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
      </Card>

      <Card title="Business category ADR, by FY">
        <GroupedBarChart
          data={categoryAdrByFy}
          xKey="fy"
          series={categoriesPresent.map((c) => ({ key: c, color: CATEGORY_COLOR[c] }))}
          valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`}
        />
      </Card>
    </div>
  );
}
