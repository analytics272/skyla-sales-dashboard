"use client";

// 2026-09-02 redesign: one line per FY replaced with current-vs-previous
// (matching the active period tab), since there's no more FY multi-select.
import { TrendSeries, CategoryAdrStat } from "@/lib/bigquery/queries/trends";
import Card from "@/components/ui/Card";
import MultiSeriesLineChart from "@/components/charts/MultiSeriesLineChart";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import DonutChart from "@/components/charts/DonutChart";
import { CATEGORY_COLOR, CATEGORY_ORDER } from "@/lib/design/tokens";

function mergeTrend(
  series: TrendSeries,
  pick: (p: TrendSeries["current"][number]) => number | null,
  currentKey: string,
  previousKey: string
) {
  const len = Math.max(series.current.length, series.previous.length);
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < len; i++) {
    const c = series.current[i];
    const p = series.previous[i];
    rows.push({ label: c?.monthLabel ?? p?.monthLabel ?? `#${i + 1}`, [currentKey]: c ? pick(c) : null, [previousKey]: p ? pick(p) : null });
  }
  return rows;
}

export default function TrendsContent({
  monthlyTrends,
  categoryAdr,
}: {
  monthlyTrends: TrendSeries;
  categoryAdr: CategoryAdrStat[];
}) {
  const currentKey = "This period";
  const previousKey = "Previous period";
  const series = [
    { key: currentKey, color: "var(--series-1)" },
    { key: previousKey, color: "var(--chart-baseline)" },
  ];

  const occupancyData = mergeTrend(monthlyTrends, (p) => (p.occupancyPct !== null ? p.occupancyPct * 100 : null), currentKey, previousKey);
  const revParData = mergeTrend(monthlyTrends, (p) => p.revPar, currentKey, previousKey);
  const adrData = mergeTrend(monthlyTrends, (p) => p.adr, currentKey, previousKey);

  const categoriesPresent = CATEGORY_ORDER.filter((c) => categoryAdr.some((r) => r.category === c));
  const revenueDonut = categoriesPresent.map((c) => {
    const r = categoryAdr.find((x) => x.category === c)!;
    return { name: c, value: r.revenue, color: CATEGORY_COLOR[c] };
  });
  const adrBars: BarDatum[] = categoriesPresent.map((c) => {
    const r = categoryAdr.find((x) => x.category === c)!;
    return { name: c, value: r.adr ?? 0, color: CATEGORY_COLOR[c] };
  });

  return (
    <div className="space-y-6">

      <Card title="Occupancy Trend">
        <MultiSeriesLineChart
          data={occupancyData}
          xKey="label"
          series={series}
          valueFormatter={(v) => `${v.toFixed(0)}%`}
          yDomain={[0, 100]}
          yTicks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
        />
      </Card>

      <Card title="RevPAR Trend">
        <MultiSeriesLineChart data={revParData} xKey="label" series={series} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
      </Card>

      <Card title="Month-Wise ADR">
        <MultiSeriesLineChart data={adrData} xKey="label" series={series} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Business Category Revenue Mix">
          <DonutChart data={revenueDonut} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
        </Card>
        <Card title="Business Category ADR">
          <SingleMetricBarChart data={adrBars} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
        </Card>
      </div>
    </div>
  );
}
