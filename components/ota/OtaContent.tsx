"use client";

import { OtaBreakdownRow } from "@/lib/bigquery/queries/otaBreakdown";
import Card from "@/components/ui/Card";
import Table, { TableColumn } from "@/components/ui/Table";
import { formatIndianCurrency } from "@/lib/format/currency";

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

  const grandTotal = {
    nights: otaBreakdown.reduce((s, r) => s + r.nights, 0),
    totalRevenue: otaBreakdown.reduce((s, r) => s + r.totalRevenue, 0),
    netRevenue: otaBreakdown.reduce((s, r) => s + r.netRevenue, 0),
  };
  const blendedCommission = grandTotal.totalRevenue > 0 ? (1 - grandTotal.netRevenue / grandTotal.totalRevenue) * 100 : 0;
  const blendedAdrBefore = grandTotal.nights > 0 ? grandTotal.totalRevenue / grandTotal.nights : null;
  const blendedAdrAfter = grandTotal.nights > 0 ? grandTotal.netRevenue / grandTotal.nights : null;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">OTA Breakdown</h2>

      <Card title="Commission, revenue &amp; ADR by OTA site">
        <Table columns={otaColumns} rows={otaBreakdown} rowKey={(r) => r.otaName} />
        <div className="mt-2 flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-zinc-200 pt-2 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
          <span>Grand total</span>
          <span>{blendedCommission.toFixed(1)}%</span>
          <span>{grandTotal.nights.toLocaleString("en-IN")} nights</span>
          <span>{formatIndianCurrency(grandTotal.totalRevenue)}</span>
          <span>{formatIndianCurrency(grandTotal.netRevenue)}</span>
          <span>{blendedAdrBefore !== null ? `₹${Math.round(blendedAdrBefore).toLocaleString("en-IN")}` : "—"}</span>
          <span>{blendedAdrAfter !== null ? `₹${Math.round(blendedAdrAfter).toLocaleString("en-IN")}` : "—"}</span>
        </div>
      </Card>
    </div>
  );
}
