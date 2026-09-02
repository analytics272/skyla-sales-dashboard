"use client";

import { OtaBreakdownRow } from "@/lib/bigquery/queries/otaBreakdown";
import Card from "@/components/ui/Card";
import Table, { TableColumn } from "@/components/ui/Table";
import DonutChart from "@/components/charts/DonutChart";
import { formatIndianCurrency } from "@/lib/format/currency";

const OTA_PALETTE = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--chart-baseline)", "#a855f7", "#0ea5e9"];

export default function OtaContent({ otaBreakdown }: { otaBreakdown: OtaBreakdownRow[] }) {
  const otaColumns: TableColumn<OtaBreakdownRow>[] = [
    { key: "ota", header: "OTA Site", render: (r) => r.otaName },
    { key: "commission", header: "Commission %", align: "right", render: (r) => `${r.avgCommissionPct.toFixed(1)}%` },
    { key: "nights", header: "Month Nights", align: "right", render: (r) => r.nights.toLocaleString("en-IN") },
    { key: "revenue", header: "Total Revenue", align: "right", render: (r) => formatIndianCurrency(r.totalRevenue) },
    { key: "net", header: "Net Revenue", align: "right", render: (r) => formatIndianCurrency(r.netRevenue) },
    { key: "adrBefore", header: "Before Commission ADR", align: "right", render: (r) => (r.adrBeforeCommission !== null ? `₹${Math.round(r.adrBeforeCommission).toLocaleString("en-IN")}` : "—") },
    { key: "adrAfter", header: "After Commission ADR", align: "right", render: (r) => (r.adrAfterCommission !== null ? `₹${Math.round(r.adrAfterCommission).toLocaleString("en-IN")}` : "—") },
  ];

  const totalNights = otaBreakdown.reduce((s, r) => s + r.nights, 0);
  const totalRevenue = otaBreakdown.reduce((s, r) => s + r.totalRevenue, 0);
  const netRevenue = otaBreakdown.reduce((s, r) => s + r.netRevenue, 0);

  // Same shape as a data row, so it renders through the identical column
  // definitions above — guarantees the totals line up under their headers.
  const grandTotalRow: OtaBreakdownRow = {
    otaName: "Grand Total",
    nights: totalNights,
    totalRevenue,
    avgCommissionPct: totalRevenue > 0 ? (1 - netRevenue / totalRevenue) * 100 : 0,
    netRevenue,
    adrBeforeCommission: totalNights > 0 ? totalRevenue / totalNights : null,
    adrAfterCommission: totalNights > 0 ? netRevenue / totalNights : null,
  };

  const revenueDonut = otaBreakdown.map((r, i) => ({ name: r.otaName, value: r.totalRevenue, color: OTA_PALETTE[i % OTA_PALETTE.length] }));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">OTA Breakdown</h2>

      <Card title="Revenue Share By OTA Site">
        <DonutChart data={revenueDonut} valueFormatter={(v) => formatIndianCurrency(v)} />
      </Card>

      <Card title="Commission, Revenue & ADR By OTA Site">
        <Table columns={otaColumns} rows={otaBreakdown} rowKey={(r) => r.otaName} footerRow={grandTotalRow} />
      </Card>
    </div>
  );
}
