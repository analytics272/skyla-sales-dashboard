"use client";

// 2026-09-02 redesign: hero KPI cards now use StatTile's delta (value + %
// vs the active period's comparison range, colored green/red) instead of a
// bespoke YoY line; the two monthly line charts show "current vs previous"
// instead of one line per selected FY (there's no more FY multi-select).
// Titles carry no time-period text — the period pill above already says
// which range is active.
import { OverviewKpis, PropertyAdr, OccupancyPace } from "@/lib/bigquery/queries/overview";
import { TrendSeries } from "@/lib/bigquery/queries/trends";
import Card from "@/components/ui/Card";
import StatTile from "@/components/ui/StatTile";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import MultiSeriesLineChart from "@/components/charts/MultiSeriesLineChart";
import DonutChart from "@/components/charts/DonutChart";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { CATEGORY_COLOR, CATEGORY_ORDER } from "@/lib/design/tokens";

// Three consecutive calendar months, side by side, each carrying its own exact
// month name and a one-line explainer — so "what period is this?" and "is this
// final or still moving?" are never ambiguous. Real-time, independent of the
// active period tab (same convention as the reference dashboard's own pace read).
function PaceComparison({ pace }: { pace: OccupancyPace }) {
  const blocks = [
    { tag: "Last Month", period: pace.lastMonthLabel, value: pace.lastMonth, note: "Finished, final" },
    { tag: "This Month", period: pace.presentMonthLabel, value: pace.presentMonth, note: "Booked so far — will rise" },
    { tag: "Next Month", period: pace.nextMonthLabel, value: pace.nextMonth, note: "Early pace — will rise" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {blocks.map((b) => (
        <div key={b.tag} className="rounded-md bg-zinc-50 p-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{b.tag}</p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{b.period}</p>
          <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {b.value !== null ? formatPercent(b.value, 0) : "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{b.note}</p>
        </div>
      ))}
    </div>
  );
}

function mergeSeries(
  current: TrendSeries["current"],
  previous: TrendSeries["previous"],
  key: "revenue" | "occupancyPct",
  currentKey: string,
  previousKey: string
) {
  const len = Math.max(current.length, previous.length);
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < len; i++) {
    const c = current[i];
    const p = previous[i];
    const cVal = c ? (key === "occupancyPct" ? (c.occupancyPct !== null ? c.occupancyPct * 100 : null) : c.revenue) : null;
    const pVal = p ? (key === "occupancyPct" ? (p.occupancyPct !== null ? p.occupancyPct * 100 : null) : p.revenue) : null;
    rows.push({ label: c?.monthLabel ?? p?.monthLabel ?? `#${i + 1}`, [currentKey]: cVal, [previousKey]: pVal });
  }
  return rows;
}

export default function RevenueContent({
  overview,
  adrByProperty,
  occupancyPace,
  monthlyTrends,
}: {
  overview: OverviewKpis;
  adrByProperty: PropertyAdr[];
  occupancyPace: OccupancyPace;
  monthlyTrends: TrendSeries;
}) {
  const categoriesPresent = CATEGORY_ORDER.filter((c) => overview.bySource.some((s) => s.category === c));
  const revenueDonut = categoriesPresent.map((c) => {
    const s = overview.bySource.find((x) => x.category === c)!;
    return { name: c, value: s.revenue, color: CATEGORY_COLOR[c] };
  });

  const { comparison } = overview;
  const revenueByMonth = mergeSeries(monthlyTrends.current, monthlyTrends.previous, "revenue", comparison.currentLabel, comparison.previousLabel);
  const occupancyByMonth = mergeSeries(monthlyTrends.current, monthlyTrends.previous, "occupancyPct", comparison.currentLabel, comparison.previousLabel);
  const trendSeries = [
    { key: comparison.currentLabel, color: "var(--series-1)" },
    { key: comparison.previousLabel, color: "var(--chart-baseline)" },
  ];

  const adrByPropertyData: BarDatum[] = adrByProperty.map((r) => ({
    name: r.property,
    value: r.adr ?? 0,
    color: "var(--series-4)",
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Revenue Details</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Room Revenue"
          value={formatIndianCurrency(overview.roomRevenue)}
          delta={comparison.revenue.pctChange !== null ? { pct: comparison.revenue.pctChange * 100, label: `vs ${comparison.previousLabel}` } : undefined}
        />
        <StatTile
          label="ADR"
          value={overview.adr !== null ? `₹${Math.round(overview.adr).toLocaleString("en-IN")}` : "—"}
          delta={comparison.adr.pctChange !== null ? { pct: comparison.adr.pctChange * 100, label: `vs ${comparison.previousLabel}` } : undefined}
        />
        <StatTile
          label="Occupancy %"
          value={overview.occupancyPct !== null ? formatPercent(overview.occupancyPct, 0) : "—"}
          delta={comparison.occupancyPct.pctChange !== null ? { pct: comparison.occupancyPct.pctChange * 100, label: `vs ${comparison.previousLabel}` } : undefined}
          progress={overview.occupancyPct !== null ? { pct: overview.occupancyPct } : undefined}
        />
        <StatTile
          label="RevPAR"
          value={overview.revPar !== null ? `₹${Math.round(overview.revPar).toLocaleString("en-IN")}` : "—"}
          delta={comparison.revPar.pctChange !== null ? { pct: comparison.revPar.pctChange * 100, label: `vs ${comparison.previousLabel}` } : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Revenue Trend">
          <MultiSeriesLineChart data={revenueByMonth} xKey="label" series={trendSeries} valueFormatter={(v) => formatIndianCurrency(v)} height={220} />
        </Card>
        <Card title="Occupancy Trend">
          <MultiSeriesLineChart data={occupancyByMonth} xKey="label" series={trendSeries} valueFormatter={(v) => `${v.toFixed(0)}%`} height={220} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Revenue Mix">
          <DonutChart data={revenueDonut} valueFormatter={(v) => formatIndianCurrency(v)} />
        </Card>
        <Card title="ADR By Property">
          <SingleMetricBarChart data={adrByPropertyData} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} height={220} />
        </Card>
      </div>

      <Card title="Pace">
        <PaceComparison pace={occupancyPace} />
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Sold Room Nights" value={overview.soldRoomNights.toLocaleString("en-IN")} />
        <StatTile label="Available Room Nights" value={overview.availableRoomNights.toLocaleString("en-IN")} />
        <StatTile
          label="Unsold Room Nights"
          value={Math.max(0, overview.availableRoomNights - overview.soldRoomNights).toLocaleString("en-IN")}
        />
      </div>
    </div>
  );
}
