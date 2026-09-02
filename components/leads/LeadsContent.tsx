"use client";

import { useState } from "react";
import clsx from "clsx";
import { LeadsSummary, LeadsTrendSeries, LeadsTrendPoint, LeadsByGroup, FormatLeadsRevenue, AdrByFormat, LostLeadReason, OwnerLeadStatsResult, OwnerSourceCell } from "@/lib/bigquery/queries/leads";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import TabbedCard, { useTabbedCard } from "@/components/ui/TabbedCard";
import ProgressBar from "@/components/ui/ProgressBar";
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

// Item #2 (2026-09-02, sixth pass): Leads MoM drills day -> month -> FY
// instead of being locked to one grain — compact (month, ~200px) by default,
// with an Expand toggle that reveals the grain tabs and a taller chart,
// rather than a permanently-tall chart taking up space at every grain.
type MomGranularity = "Day" | "Month" | "FY";
const MOM_TABS: MomGranularity[] = ["Day", "Month", "FY"];

function buildMomRows(current: LeadsTrendPoint[], previous: LeadsTrendPoint[], compareYoY: boolean) {
  const len = compareYoY ? Math.max(current.length, previous.length) : current.length;
  return Array.from({ length: len }, (_, i) => {
    const c = current[i];
    const p = previous[i];
    return {
      label: c?.label ?? p?.label ?? `#${i + 1}`,
      total: c?.totalLeads ?? 0,
      closed: c?.closedLeads ?? 0,
      ...(compareYoY ? { previousTotal: p ? p.totalLeads : null } : {}),
    };
  });
}

function LeadsMoMCard({
  momByDay,
  momByMonth,
  momByFy,
  compareYoY,
}: {
  momByDay: LeadsTrendSeries;
  momByMonth: LeadsTrendSeries;
  momByFy: LeadsTrendSeries;
  compareYoY: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [granularity, setGranularity] = useState<MomGranularity>("Month");
  const active = granularity === "Day" ? momByDay : granularity === "FY" ? momByFy : momByMonth;
  const rows = buildMomRows(active.current, active.previous, compareYoY);
  const series = [
    { key: "total", color: TARGET_VS_ACHIEVED_COLOR.target },
    { key: "closed", color: TARGET_VS_ACHIEVED_COLOR.achieved },
    ...(compareYoY ? [{ key: "previousTotal", color: "var(--chart-baseline)" }] : []),
  ];

  return (
    <Card title="Leads MoM (Total Vs Closed)" subtitle={expanded ? `By ${granularity.toLowerCase()}` : "By month — expand to drill by day or FY"}>
      <div className="mb-2 flex items-center justify-between">
        {expanded ? (
          <div role="tablist" className="flex items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
            {MOM_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={granularity === tab}
                onClick={() => setGranularity(tab)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  granularity === tab
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
        >
          {expanded ? "Collapse" : "Expand to drill down"}
        </button>
      </div>
      <MultiSeriesLineChart data={rows} xKey="label" series={series} valueFormatter={(v) => v.toLocaleString("en-IN")} height={expanded ? 340 : 200} />
    </Card>
  );
}

export default function LeadsContent({
  summary,
  momByDay,
  momByMonth,
  momByFy,
  byProperty,
  bySource,
  formatLeadsRevenue,
  adrByFormat,
  lostReasons,
  bookingPace,
  byOwner,
  byOwnerSource,
  compareYoY,
}: {
  summary: LeadsSummary;
  momByDay: LeadsTrendSeries;
  momByMonth: LeadsTrendSeries;
  momByFy: LeadsTrendSeries;
  byProperty: LeadsByGroup[];
  bySource: LeadsByGroup[];
  formatLeadsRevenue: FormatLeadsRevenue[];
  adrByFormat: AdrByFormat[];
  lostReasons: LostLeadReason[];
  bookingPace: number | null;
  byOwner: OwnerLeadStatsResult;
  byOwnerSource: OwnerSourceCell[];
  compareYoY: boolean;
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

  const ownerTabs = byOwner.rows.map((r) => r.owner);
  const [activeOwner, setActiveOwner] = useTabbedCard(ownerTabs);
  const activeOwnerRow = byOwner.rows.find((r) => r.owner === activeOwner) ?? byOwner.rows[0];

  const heatmapOwners = byOwner.rows.map((r) => r.owner);
  const topSources = [...bySource].sort((a, b) => b.count - a.count).slice(0, HEATMAP_TOP_SOURCES).map((s) => s.key);
  const heatmapCells = byOwnerSource
    .filter((c) => heatmapOwners.includes(c.owner) && topSources.includes(c.source))
    .map((c) => ({ row: c.owner, col: c.source, value: c.count }));

  return (
    <div className="space-y-4">
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

      {/* Item #6: two vertical sides — left = lead volume/funnel, right =
          revenue & owner performance — instead of one long single-column
          stack of cards. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Lead Volume</h3>

          <LeadsMoMCard momByDay={momByDay} momByMonth={momByMonth} momByFy={momByFy} compareYoY={compareYoY} />

          <Card title="Leads By Property">
            <HorizontalBarChart data={propertyData} valueFormatter={(v) => v.toLocaleString("en-IN")} />
          </Card>

          <Card title="Leads By Source">
            <Treemap data={sourceData} valueFormatter={(v) => v.toLocaleString("en-IN")} />
          </Card>

          <Card title="Leads By Format">
            <HorizontalBarChart data={formatLeadsData} valueFormatter={(v) => v.toLocaleString("en-IN")} />
          </Card>

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
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Revenue & Owners</h3>

          <div className="grid grid-cols-2 gap-3">
            <Card title="Revenue By Format">
              <HorizontalBarChart data={formatRevenueData} valueFormatter={(v) => formatIndianCurrency(v)} />
            </Card>
            <Card title="ADR By Format" subtitle="Closed leads only">
              <HorizontalBarChart data={adrByFormatData} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

          {/* Item #4: one owner's detail at a time via internal tabs, instead
              of a grid of N always-visible cards (same pattern as Performance's
              Property Detail card). */}
          <TabbedCard title="By Owner Detail" tabs={ownerTabs} active={activeOwner} onChange={setActiveOwner}>
            {activeOwnerRow && (
              <>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Revenue</p>
                <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{formatIndianCurrency(activeOwnerRow.revenue)}</p>
                {activeOwnerRow.closedPct !== null && (
                  <div className="mt-2">
                    <ProgressBar pct={activeOwnerRow.closedPct} good={0.6} warn={0.35} />
                    <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                      {formatPercent(activeOwnerRow.closedPct)} of {activeOwnerRow.totalLeads.toLocaleString("en-IN")} leads closed
                    </p>
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800 sm:grid-cols-4">
                  <StatTile label="Exotel" value={`${activeOwnerRow.exotelLeads.toLocaleString("en-IN")} / ${activeOwnerRow.exotelClosed.toLocaleString("en-IN")} closed`} />
                  <StatTile label="Reference" value={activeOwnerRow.referenceLeads.toLocaleString("en-IN")} />
                  <StatTile label="Existing" value={activeOwnerRow.existingLeads.toLocaleString("en-IN")} />
                  <StatTile label="ADR" value={activeOwnerRow.adr !== null ? `₹${Math.round(activeOwnerRow.adr).toLocaleString("en-IN")}` : "—"} />
                </div>
              </>
            )}
          </TabbedCard>
        </div>
      </div>
    </div>
  );
}
