"use client";

import { OverviewKpis } from "@/lib/bigquery/queries/overview";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { CATEGORY_COLOR, CATEGORY_ORDER } from "@/lib/design/tokens";

export default function RevenueContent({ overview }: { overview: OverviewKpis }) {
  const revenueBySource: BarDatum[] = CATEGORY_ORDER.filter((c) =>
    overview.bySource.some((s) => s.category === c)
  ).map((c) => ({
    name: c,
    value: overview.bySource.find((s) => s.category === c)?.revenue ?? 0,
    color: CATEGORY_COLOR[c],
  }));

  const nightsBySource: BarDatum[] = CATEGORY_ORDER.filter((c) =>
    overview.bySource.some((s) => s.category === c)
  ).map((c) => ({
    name: c,
    value: overview.bySource.find((s) => s.category === c)?.nights ?? 0,
    color: CATEGORY_COLOR[c],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Revenue Details</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Room revenue" value={formatIndianCurrency(overview.roomRevenue)} />
          <StatTile label="Extras revenue" value={formatIndianCurrency(overview.extrasRevenue)} />
          <StatTile
            label="ADR"
            value={overview.adr !== null ? `₹${Math.round(overview.adr).toLocaleString("en-IN")}` : "—"}
          />
          <StatTile
            label="Occupancy"
            value={overview.occupancyPct !== null ? formatPercent(overview.occupancyPct) : "—"}
          />
          <StatTile
            label="RevPAR"
            value={overview.revPar !== null ? `₹${Math.round(overview.revPar).toLocaleString("en-IN")}` : "—"}
          />
          <StatTile
            label="Room revenue YoY"
            value={formatIndianCurrency(overview.yoy.currentRevenue)}
            delta={
              overview.yoy.pctChange !== null
                ? { pct: overview.yoy.pctChange * 100, label: `vs ${overview.yoy.priorFY}` }
                : undefined
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Sold room nights" value={overview.soldRoomNights.toLocaleString("en-IN")} />
        <StatTile label="Available room nights" value={overview.availableRoomNights.toLocaleString("en-IN")} />
        <StatTile
          label="Unsold room nights"
          value={Math.max(0, overview.availableRoomNights - overview.soldRoomNights).toLocaleString("en-IN")}
        />
        <StatTile label={`${overview.yoy.priorFY} revenue`} value={formatIndianCurrency(overview.yoy.priorRevenue)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Revenue by source">
          <SingleMetricBarChart data={revenueBySource} valueFormatter={(v) => formatIndianCurrency(v)} />
        </Card>
        <Card title="Room nights by source">
          <SingleMetricBarChart data={nightsBySource} valueFormatter={(v) => v.toLocaleString("en-IN")} />
        </Card>
      </div>
    </div>
  );
}
