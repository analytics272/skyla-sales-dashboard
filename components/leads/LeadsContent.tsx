"use client";

import { LeadsSummary, LeadsMoMSeries, LeadsByGroup, FormatLeadsRevenue, AdrByFormat, LostLeadReason, OwnerLeadStatsResult, OwnerSourceCell } from "@/lib/bigquery/queries/leads";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import EntityCard from "@/components/ui/EntityCard";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import { BarDatum } from "@/components/charts/SingleMetricBarChart";
import MultiSeriesLineChart from "@/components/charts/MultiSeriesLineChart";
import DonutChart from "@/components/charts/DonutChart";
import Treemap from "@/components/charts/Treemap";
import Heatmap from "@/components/charts/Heatmap";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { TARGET_VS_ACHIEVED_COLOR } from "@/lib/design/tokens";
import { LOST_REASON_DESCRIPTIONS } from "@/lib/reference/lostLeadReasons";

const RANKING_COLOR = "var(--series-1)";
const LOST_REASON_PALETTE = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--chart-baseline)"];
const HEATMAP_TOP_SOURCES = 6;

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
  byOwnerSource,
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
  byOwnerSource: OwnerSourceCell[];
}) {
  const existingTotal = bySource.find((s) => s.key === "Existing")?.count ?? 0;
  const referenceTotal = bySource.find((s) => s.key === "Reference")?.count ?? 0;
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const b2cAchievedPct = pct(summary.b2cLeadsClosed, summary.b2cLeads);
  const existingAchievedPct = pct(summary.existingClosedLeads, existingTotal);
  const referenceAchievedPct = pct(summary.referenceClosedLeads, referenceTotal);

  const propertyData: BarDatum[] = byProperty.map((r) => ({ name: r.key, value: r.count, color: RANKING_COLOR }));
  const sourceData: BarDatum[] = bySource.map((r, i) => ({ name: r.key, value: r.count, color: LOST_REASON_PALETTE[i % LOST_REASON_PALETTE.length] }));
  const formatLeadsData: BarDatum[] = formatLeadsRevenue.map((r) => ({ name: r.format, value: r.leads, color: RANKING_COLOR }));
  const formatRevenueData: BarDatum[] = formatLeadsRevenue.map((r) => ({ name: r.format, value: r.revenue, color: RANKING_COLOR }));
  const adrByFormatData: BarDatum[] = adrByFormat.map((r) => ({ name: r.format, value: r.adr ?? 0, color: RANKING_COLOR }));

  const lostDonut = lostReasons.map((r, i) => ({ name: r.stage, value: r.count, color: LOST_REASON_PALETTE[i % LOST_REASON_PALETTE.length] }));

  const ownerRevenueData: BarDatum[] = byOwner.rows.map((r) => ({ name: r.owner, value: r.revenue, color: RANKING_COLOR }));

  const heatmapOwners = byOwner.rows.map((r) => r.owner);
  const topSources = [...bySource].sort((a, b) => b.count - a.count).slice(0, HEATMAP_TOP_SOURCES).map((s) => s.key);
  const heatmapCells = byOwnerSource
    .filter((c) => heatmapOwners.includes(c.owner) && topSources.includes(c.source))
    .map((c) => ({ row: c.owner, col: c.source, value: c.count }));

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

  return (
    <div className="space-y-6">
      <div>
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
        <MultiSeriesLineChart
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
          <Treemap data={sourceData} valueFormatter={(v) => v.toLocaleString("en-IN")} />
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
        <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {lostReasons.map((r) => (
            <p key={r.stage} className="text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">{r.stage}</span>
              {LOST_REASON_DESCRIPTIONS[r.stage] && ` — ${LOST_REASON_DESCRIPTIONS[r.stage]}`}
            </p>
          ))}
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">By Owner ({byOwner.rows.length})</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Total Revenue" value={formatIndianCurrency(byOwner.total.revenue)} />
          <StatTile label="Total Leads" value={byOwner.total.totalLeads.toLocaleString("en-IN")} />
          <StatTile
            label="Closed %"
            value={byOwner.total.closedPct !== null ? formatPercent(byOwner.total.closedPct) : "—"}
            progress={byOwner.total.closedPct !== null ? { pct: byOwner.total.closedPct, good: 0.6, warn: 0.35 } : undefined}
          />
        </div>
        <Card title="Revenue By Owner" subtitle="Total revenue attributed to each owner">
          <HorizontalBarChart data={ownerRevenueData} valueFormatter={(v) => formatIndianCurrency(v)} />
        </Card>
        <Card title="Owner × Source" subtitle="Lead volume per owner, by top source — darker = more leads">
          <Heatmap rows={heatmapOwners} cols={topSources} cells={heatmapCells} valueFormatter={(v) => v.toLocaleString("en-IN")} />
        </Card>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byOwner.rows.map((r) => (
            <EntityCard
              key={r.owner}
              name={r.owner}
              headlineLabel="Revenue"
              headline={formatIndianCurrency(r.revenue)}
              progress={r.closedPct !== null ? { pct: r.closedPct, good: 0.6, warn: 0.35, label: `${formatPercent(r.closedPct)} of ${r.totalLeads.toLocaleString("en-IN")} leads closed` } : undefined}
              stats={[
                { label: "Exotel", value: `${r.exotelLeads.toLocaleString("en-IN")} / ${r.exotelClosed.toLocaleString("en-IN")} closed` },
                { label: "Reference", value: r.referenceLeads.toLocaleString("en-IN") },
                { label: "Existing", value: r.existingLeads.toLocaleString("en-IN") },
                { label: "ADR", value: r.adr !== null ? `₹${Math.round(r.adr).toLocaleString("en-IN")}` : "—" },
              ]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
