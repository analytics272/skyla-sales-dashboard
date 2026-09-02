"use client";

import { LeadsSummary, LeadsMoMSeries, LeadsByGroup, FormatLeadsRevenue, AdrByFormat, LostLeadReason, OwnerLeadStats, OwnerLeadStatsResult } from "@/lib/bigquery/queries/leads";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import Table, { TableColumn } from "@/components/ui/Table";
import Expandable from "@/components/ui/Expandable";
import ProgressBar from "@/components/ui/ProgressBar";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import { BarDatum } from "@/components/charts/SingleMetricBarChart";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import DonutChart from "@/components/charts/DonutChart";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { TARGET_VS_ACHIEVED_COLOR } from "@/lib/design/tokens";

const RANKING_COLOR = "var(--series-1)";
const LOST_REASON_PALETTE = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--chart-baseline)"];

export default function LeadsContent({
  summary,
  mom,
  byProperty,
  bySource,
  formatLeadsRevenue,
  adrByFormat,
  lostReasons,
  bookingPace,
  byOwner,
}: {
  summary: LeadsSummary;
  mom: LeadsMoMSeries;
  byProperty: LeadsByGroup[];
  bySource: LeadsByGroup[];
  formatLeadsRevenue: FormatLeadsRevenue[];
  adrByFormat: AdrByFormat[];
  lostReasons: LostLeadReason[];
  bookingPace: number | null;
  byOwner: OwnerLeadStatsResult;
}) {
  const existingTotal = bySource.find((s) => s.key === "Existing")?.count ?? 0;
  const referenceTotal = bySource.find((s) => s.key === "Reference")?.count ?? 0;
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const b2cAchievedPct = pct(summary.b2cLeadsClosed, summary.b2cLeads);
  const existingAchievedPct = pct(summary.existingClosedLeads, existingTotal);
  const referenceAchievedPct = pct(summary.referenceClosedLeads, referenceTotal);

  const propertyData: BarDatum[] = byProperty.map((r) => ({ name: r.key, value: r.count, color: RANKING_COLOR }));
  const sourceData: BarDatum[] = bySource.map((r) => ({ name: r.key, value: r.count, color: RANKING_COLOR }));
  const formatLeadsData: BarDatum[] = formatLeadsRevenue.map((r) => ({ name: r.format, value: r.leads, color: RANKING_COLOR }));
  const formatRevenueData: BarDatum[] = formatLeadsRevenue.map((r) => ({ name: r.format, value: r.revenue, color: RANKING_COLOR }));
  const adrByFormatData: BarDatum[] = adrByFormat.map((r) => ({ name: r.format, value: r.adr ?? 0, color: RANKING_COLOR }));

  const lostDonut = lostReasons.map((r, i) => ({ name: r.stage, value: r.count, color: LOST_REASON_PALETTE[i % LOST_REASON_PALETTE.length] }));

  const momLen = Math.max(mom.current.length, mom.previous.length);
  const momData = Array.from({ length: momLen }, (_, i) => {
    const c = mom.current[i];
    const p = mom.previous[i];
    return {
      month: c?.monthLabel ?? p?.monthLabel ?? `#${i + 1}`,
      total: c?.totalLeads ?? 0,
      closed: c?.closedLeads ?? 0,
      previousTotal: p?.totalLeads ?? 0,
    };
  });

  const ownerColumns: TableColumn<OwnerLeadStats>[] = [
    { key: "owner", header: "Owner", render: (r) => r.owner },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => formatIndianCurrency(r.revenue) },
    { key: "total", header: "Total Leads", align: "right", render: (r) => r.totalLeads.toLocaleString("en-IN") },
    { key: "closed", header: "Closed Leads", align: "right", render: (r) => r.closedLeads.toLocaleString("en-IN") },
    {
      key: "closedPct",
      header: "Closed %",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <span className="w-16"><ProgressBar pct={r.closedPct ?? 0} good={0.6} warn={0.35} /></span>
          <span className="tabular-nums">{r.closedPct !== null ? formatPercent(r.closedPct) : "—"}</span>
        </div>
      ),
    },
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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label="Total Leads"
            value={summary.totalLeads.toLocaleString("en-IN")}
            delta={summary.comparison.totalLeads.pctChange !== null ? { pct: summary.comparison.totalLeads.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile label="Closed Leads" value={summary.closedLeads.toLocaleString("en-IN")} />
          <StatTile
            label="Conversion Rate"
            value={summary.conversionRate !== null ? formatPercent(summary.conversionRate) : "—"}
            delta={summary.comparison.conversionRate.pctChange !== null ? { pct: summary.comparison.conversionRate.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile
            label="Revenue"
            value={formatIndianCurrency(summary.revenue)}
            delta={summary.comparison.revenue.pctChange !== null ? { pct: summary.comparison.revenue.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile label="Booking Pace" value={bookingPace !== null ? bookingPace.toFixed(1) : "—"} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label="New Leads"
            value={summary.b2cLeads.toLocaleString("en-IN")}
            sub={`${summary.b2cLeadsClosed.toLocaleString("en-IN")} closed → ${b2cAchievedPct}% achieved`}
            progress={{ pct: b2cAchievedPct / 100 }}
          />
          <StatTile
            label="Existing Leads"
            value={existingTotal.toLocaleString("en-IN")}
            sub={`${summary.existingClosedLeads.toLocaleString("en-IN")} closed → ${existingAchievedPct}% achieved`}
            progress={{ pct: existingAchievedPct / 100 }}
          />
          <StatTile
            label="Reference Leads"
            value={referenceTotal.toLocaleString("en-IN")}
            sub={`${summary.referenceClosedLeads.toLocaleString("en-IN")} closed → ${referenceAchievedPct}% achieved`}
            progress={{ pct: referenceAchievedPct / 100 }}
          />
        </div>
      </div>

      <Card title="Leads MoM (Total Vs Closed)">
        <GroupedBarChart
          data={momData}
          xKey="month"
          series={[
            { key: "total", color: TARGET_VS_ACHIEVED_COLOR.target },
            { key: "closed", color: TARGET_VS_ACHIEVED_COLOR.achieved },
          ]}
          valueFormatter={(v) => v.toLocaleString("en-IN")}
          height={260}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Leads By Property">
          <HorizontalBarChart data={propertyData} valueFormatter={(v) => v.toLocaleString("en-IN")} />
        </Card>
        <Card title="Leads By Source">
          <Expandable collapsedHeight={260}>
            <HorizontalBarChart data={sourceData} valueFormatter={(v) => v.toLocaleString("en-IN")} height={Math.max(200, sourceData.length * 32)} />
          </Expandable>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Leads By Format">
          <HorizontalBarChart data={formatLeadsData} valueFormatter={(v) => v.toLocaleString("en-IN")} />
        </Card>
        <Card title="Revenue By Format">
          <HorizontalBarChart data={formatRevenueData} valueFormatter={(v) => formatIndianCurrency(v)} />
        </Card>
        <Card title="ADR By Format" subtitle="Closed leads only">
          <HorizontalBarChart data={adrByFormatData} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
        </Card>
      </div>

      <Card title="Lost Leads Reasons">
        <DonutChart data={lostDonut} valueFormatter={(v) => v.toLocaleString("en-IN")} />
      </Card>

      <Card title={`By Owner (${byOwner.rows.length})`}>
        <Table columns={ownerColumns} rows={byOwner.rows} rowKey={(r) => r.owner} footerRow={byOwner.total} />
      </Card>
    </div>
  );
}
