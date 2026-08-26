"use client";

import { LeadsSummary, LeadsMoMPoint, LeadsByGroup, FormatLeadsRevenue, AdrByFormat, LostLeadReason, OwnerLeadStats } from "@/lib/bigquery/queries/leads";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import Table, { TableColumn } from "@/components/ui/Table";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { TARGET_VS_ACHIEVED_COLOR } from "@/lib/design/tokens";

const FISCAL_MONTH_NAMES: Record<number, string> = {
  1: "Apr", 2: "May", 3: "Jun", 4: "Jul", 5: "Aug", 6: "Sep",
  7: "Oct", 8: "Nov", 9: "Dec", 10: "Jan", 11: "Feb", 12: "Mar",
};

const RANKING_COLOR = "var(--series-1)";

export default function LeadsContent({
  summary,
  momByFy,
  byProperty,
  bySource,
  formatLeadsRevenue,
  adrByFormat,
  lostReasons,
  bookingPace,
  byOwner,
}: {
  summary: LeadsSummary;
  momByFy: { fy: string; data: LeadsMoMPoint[] }[];
  byProperty: LeadsByGroup[];
  bySource: LeadsByGroup[];
  formatLeadsRevenue: FormatLeadsRevenue[];
  adrByFormat: AdrByFormat[];
  lostReasons: LostLeadReason[];
  bookingPace: number | null;
  byOwner: OwnerLeadStats[];
}) {

  const existingTotal = bySource.find((s) => s.key === "Existing")?.count ?? 0;
  const referenceTotal = bySource.find((s) => s.key === "Reference")?.count ?? 0;
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const b2cAchievedPct = pct(summary.b2cLeadsClosed, summary.b2cLeads);
  const existingAchievedPct = pct(summary.existingClosedLeads, existingTotal);
  const referenceAchievedPct = pct(summary.referenceClosedLeads, referenceTotal);

  const propertyData: BarDatum[] = byProperty.map((r) => ({ name: r.key, value: r.count, color: RANKING_COLOR }));
  const sourceData: BarDatum[] = bySource.slice(0, 8).map((r) => ({ name: r.key, value: r.count, color: RANKING_COLOR }));
  const formatLeadsData: BarDatum[] = formatLeadsRevenue.map((r) => ({ name: r.format, value: r.leads, color: RANKING_COLOR }));
  const formatRevenueData: BarDatum[] = formatLeadsRevenue.map((r) => ({ name: r.format, value: r.revenue, color: RANKING_COLOR }));
  const adrByFormatData: BarDatum[] = adrByFormat.map((r) => ({ name: r.format, value: r.adr ?? 0, color: RANKING_COLOR }));

  const lostColumns: TableColumn<LostLeadReason>[] = [
    { key: "stage", header: "Reason", render: (r) => r.stage },
    { key: "count", header: "Leads", align: "right", render: (r) => r.count.toLocaleString("en-IN") },
  ];

  const ownerColumns: TableColumn<OwnerLeadStats>[] = [
    { key: "owner", header: "Owner", render: (r) => r.owner },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => formatIndianCurrency(r.revenue) },
    { key: "total", header: "Total Leads", align: "right", render: (r) => r.totalLeads.toLocaleString("en-IN") },
    { key: "closed", header: "Closed Leads", align: "right", render: (r) => r.closedLeads.toLocaleString("en-IN") },
    { key: "closedPct", header: "Closed %", align: "right", render: (r) => (r.closedPct !== null ? formatPercent(r.closedPct) : "—") },
    { key: "exotel", header: "Exotel Leads", align: "right", render: (r) => r.exotelLeads.toLocaleString("en-IN") },
    { key: "exotelClosed", header: "Exotel Closed", align: "right", render: (r) => r.exotelClosed.toLocaleString("en-IN") },
    { key: "reference", header: "Reference", align: "right", render: (r) => r.referenceLeads.toLocaleString("en-IN") },
    { key: "existing", header: "Existing Leads", align: "right", render: (r) => r.existingLeads.toLocaleString("en-IN") },
    { key: "adr", header: "ADR", align: "right", render: (r) => (r.adr !== null ? `₹${Math.round(r.adr).toLocaleString("en-IN")}` : "—") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Lead Tracker</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Total Leads" value={summary.totalLeads.toLocaleString("en-IN")} />
          <StatTile label="Closed Leads" value={summary.closedLeads.toLocaleString("en-IN")} />
          <StatTile
            label="Conversion Rate"
            value={summary.conversionRate !== null ? formatPercent(summary.conversionRate) : "—"}
          />
          <StatTile label="Revenue" value={formatIndianCurrency(summary.revenue)} />
          <StatTile
            label="New Leads"
            value={summary.b2cLeads.toLocaleString("en-IN")}
            sub={`${summary.b2cLeadsClosed.toLocaleString("en-IN")} closed → ${b2cAchievedPct}% achieved`}
          />
          <StatTile
            label="Existing Leads"
            value={existingTotal.toLocaleString("en-IN")}
            sub={`${summary.existingClosedLeads.toLocaleString("en-IN")} closed → ${existingAchievedPct}% achieved`}
          />
          <StatTile
            label="Reference Leads"
            value={referenceTotal.toLocaleString("en-IN")}
            sub={`${summary.referenceClosedLeads.toLocaleString("en-IN")} closed → ${referenceAchievedPct}% achieved`}
          />
          <StatTile label="Booking Pace" value={bookingPace !== null ? bookingPace.toFixed(1) : "—"} />
        </div>
      </div>

      <Card title="Leads MoM (Total Vs Closed)">
        <div className="space-y-6">
          {momByFy.map(({ fy, data }) => (
            <div key={fy}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{fy}</p>
              <GroupedBarChart
                data={[...data]
                  .sort((a, b) => a.monthNumber - b.monthNumber)
                  .map((m) => ({ month: FISCAL_MONTH_NAMES[m.monthNumber] ?? m.monthNumber, total: m.totalLeads, closed: m.closedLeads }))}
                xKey="month"
                series={[
                  { key: "total", color: TARGET_VS_ACHIEVED_COLOR.target },
                  { key: "closed", color: TARGET_VS_ACHIEVED_COLOR.achieved },
                ]}
                valueFormatter={(v) => v.toLocaleString("en-IN")}
                height={220}
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Leads By Property">
          <SingleMetricBarChart data={propertyData} valueFormatter={(v) => v.toLocaleString("en-IN")} />
        </Card>
        <Card title="Leads By Source (Top 8)">
          <SingleMetricBarChart data={sourceData} valueFormatter={(v) => v.toLocaleString("en-IN")} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Leads By Format">
          <SingleMetricBarChart data={formatLeadsData} valueFormatter={(v) => v.toLocaleString("en-IN")} verticalLabels />
        </Card>
        <Card title="Revenue By Format">
          <SingleMetricBarChart data={formatRevenueData} valueFormatter={(v) => formatIndianCurrency(v)} verticalLabels />
        </Card>
        <Card title="ADR By Format (Closed Leads)">
          <SingleMetricBarChart data={adrByFormatData} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} verticalLabels />
        </Card>
      </div>

      <Card title="Lost Leads Reasons">
        <Table columns={lostColumns} rows={lostReasons} rowKey={(r) => r.stage} />
      </Card>

      <Card title={`By Owner (${byOwner.length})`}>
        <Table columns={ownerColumns} rows={byOwner} rowKey={(r) => r.owner} />
      </Card>
    </div>
  );
}
