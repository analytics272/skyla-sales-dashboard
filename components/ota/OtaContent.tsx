"use client";

import { OtaBreakdownRow } from "@/lib/bigquery/queries/otaBreakdown";
import Card from "@/components/ui/Card";
import StatTile from "@/components/ui/StatTile";
import DonutChart from "@/components/charts/DonutChart";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import { formatIndianCurrency } from "@/lib/format/currency";

const OTA_PALETTE = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--chart-baseline)", "#a855f7", "#0ea5e9"];

export default function OtaContent({ otaBreakdown }: { otaBreakdown: OtaBreakdownRow[] }) {
  const totalNights = otaBreakdown.reduce((s, r) => s + r.nights, 0);
  const totalRevenue = otaBreakdown.reduce((s, r) => s + r.totalRevenue, 0);
  const netRevenue = otaBreakdown.reduce((s, r) => s + r.netRevenue, 0);
  const blendedCommissionPct = totalRevenue > 0 ? (1 - netRevenue / totalRevenue) * 100 : 0;

  const revenueDonut = otaBreakdown.map((r, i) => ({ name: r.otaName, value: r.totalRevenue, color: OTA_PALETTE[i % OTA_PALETTE.length] }));
  const commissionData = otaBreakdown.map((r, i) => ({ name: r.otaName, value: r.avgCommissionPct, color: OTA_PALETTE[i % OTA_PALETTE.length] }));
  const adrData = otaBreakdown.map((r) => ({
    ota: r.otaName,
    "Before Commission": r.adrBeforeCommission ?? 0,
    "After Commission": r.adrAfterCommission ?? 0,
  }));

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Nights" value={totalNights.toLocaleString("en-IN")} />
        <StatTile label="Total Revenue" value={formatIndianCurrency(totalRevenue)} />
        <StatTile label="Net Revenue" value={formatIndianCurrency(netRevenue)} />
        <StatTile label="Blended Commission %" value={`${blendedCommissionPct.toFixed(1)}%`} />
      </div>

      <Card title="Revenue Share By OTA Site">
        <DonutChart data={revenueDonut} valueFormatter={(v) => formatIndianCurrency(v)} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Net Revenue By OTA Site">
          <HorizontalBarChart data={otaBreakdown.map((r) => ({ name: r.otaName, value: r.netRevenue, color: "var(--series-1)" }))} valueFormatter={(v) => formatIndianCurrency(v)} />
        </Card>
        <Card title="Commission % By OTA Site">
          <HorizontalBarChart data={commissionData} valueFormatter={(v) => `${v.toFixed(1)}%`} />
        </Card>
      </div>

      <Card title="ADR Before / After Commission By OTA Site">
        <GroupedBarChart
          data={adrData}
          xKey="ota"
          series={[
            { key: "Before Commission", color: "var(--series-1)" },
            { key: "After Commission", color: "var(--series-3)" },
          ]}
          valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`}
        />
      </Card>
    </div>
  );
}
