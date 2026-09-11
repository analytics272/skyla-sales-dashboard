"use client";

import { useState } from "react";
import { LeadsSummary, LeadsTrendSeries, LeadsTrendPoint, LeadsByGroup, FormatLeadsRevenue, AdrByFormat, LostLeadReason, OwnerLeadStatsResult, OwnerSourceCell } from "@/lib/bigquery/queries/leads";
import { OwnerCompanyRow, canonicalOwner } from "@/lib/reference/owners";
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
import { TARGET_VS_ACHIEVED_COLOR, BRAND_COLOR, ROOM_TYPE_COLOR } from "@/lib/design/tokens";
import { brandOf } from "@/lib/reference/propertyReference";
import { LOST_REASON_DESCRIPTIONS } from "@/lib/reference/lostLeadReasons";

const RANKING_COLOR = "var(--series-1)";
const LOST_REASON_PALETTE = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--chart-baseline)"];
const HEATMAP_TOP_SOURCES = 6;

// 2026-09-10: lead_tracker.Format is free text ("Premier", "Executive",
// "Studio", "1BHK"...) — normalise to the dashboard's room-type vocabulary
// so the Leads format charts read the same as Bookings' "By Room Format"
// (incl. "Premiere Supreme", the Skyla premium tier — lead_tracker's
// "Premier"). 3BHK/4BHK have no single room-type equivalent, kept as-is.
const LEAD_FORMAT_LABEL: Record<string, string> = {
  Premier: "Premiere Supreme",
  Executive: "Executive Room",
  Studio: "Studio Room",
  "1BHK": "1 BHK",
  "2BHK": "2 BHK",
  "Hyber Go": "Hyber Room Go",
  "Hyber Lite": "Hyber Room Lite",
};
const leadFmtLabel = (f: string) => LEAD_FORMAT_LABEL[f] ?? f;
const leadFmtColor = (f: string) => ROOM_TYPE_COLOR[leadFmtLabel(f)] ?? "var(--chart-baseline)";
const brandColorFor = (code: string) => BRAND_COLOR[brandOf(code) ?? ""] ?? RANKING_COLOR;

// Item #5 (2026-09-02, eighth pass): day-wise only — the Month/FY drill-down
// tabs from a prior pass are gone per explicit request. Expand/collapse is
// kept for height only (compact by default, taller on demand), since a full
// FY's worth of daily points is a lot to show at once.
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

function LeadsMoMCard({ momByDay, compareYoY }: { momByDay: LeadsTrendSeries; compareYoY: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const rows = buildMomRows(momByDay.current, momByDay.previous, compareYoY);
  const series = [
    { key: "total", color: TARGET_VS_ACHIEVED_COLOR.target },
    { key: "closed", color: TARGET_VS_ACHIEVED_COLOR.achieved },
    ...(compareYoY ? [{ key: "previousTotal", color: "var(--chart-baseline)" }] : []),
  ];

  return (
    <Card title="Leads MoM (Total Vs Closed)" subtitle="By day">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <MultiSeriesLineChart data={rows} xKey="label" series={series} valueFormatter={(v) => v.toLocaleString("en-IN")} height={expanded ? 340 : 200} />
    </Card>
  );
}

export default function LeadsContent({
  summary,
  momByDay,
  byProperty,
  bySource,
  formatLeadsRevenue,
  adrByFormat,
  lostReasons,
  bookingPace,
  byOwner,
  byOwnerSource,
  ownerCompanyAnalysis,
  compareYoY,
}: {
  summary: LeadsSummary;
  momByDay: LeadsTrendSeries;
  byProperty: LeadsByGroup[];
  bySource: LeadsByGroup[];
  formatLeadsRevenue: FormatLeadsRevenue[];
  adrByFormat: AdrByFormat[];
  lostReasons: LostLeadReason[];
  bookingPace: number | null;
  byOwner: OwnerLeadStatsResult;
  byOwnerSource: OwnerSourceCell[];
  ownerCompanyAnalysis: OwnerCompanyRow[];
  compareYoY: boolean;
}) {
  // Conversion rate = closed leads / total leads for that segment (Stage =
  // 'Closed' in lead_tracker), the same closed/total basis as the top-row
  // "Conversion Rate" KPI (getLeadsSummary in lib/bigquery/queries/leads.ts)
  // — just narrowed to New/Existing/Reference instead of all sources
  // combined. 2026-09-08: relabeled from "% achieved" (there's no target
  // being achieved here, just a share of leads that closed) and dropped the
  // progress bar per explicit request — a bar implies progress toward a
  // goal, which doesn't apply to a conversion rate.
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const b2cAchievedPct = pct(summary.b2cLeadsClosed, summary.b2cLeads);
  const existingAchievedPct = pct(summary.existingClosedLeads, summary.existingLeads);
  const referenceAchievedPct = pct(summary.referenceClosedLeads, summary.referenceLeads);

  const propertyData: BarDatum[] = byProperty.map((r) => ({ name: r.key, value: r.count, color: brandColorFor(r.key) }));
  const sourceData: BarDatum[] = bySource.map((r, i) => ({ name: r.key, value: r.count, color: LOST_REASON_PALETTE[i % LOST_REASON_PALETTE.length] }));
  const formatLeadsData: BarDatum[] = formatLeadsRevenue.map((r) => ({ name: leadFmtLabel(r.format), value: r.leads, color: leadFmtColor(r.format) }));
  const formatRevenueData: BarDatum[] = formatLeadsRevenue.map((r) => ({ name: leadFmtLabel(r.format), value: r.revenue, color: leadFmtColor(r.format) }));
  // Item #6 (2026-09-02, eighth pass): ADR By Format now follows the same
  // format order as Revenue/Leads By Format (by lead count, descending)
  // instead of its own query's unordered GROUP BY output — the two paired
  // charts were listing room formats in different, inconsistent orders.
  const adrByFormatData: BarDatum[] = formatLeadsRevenue.map((r) => ({
    name: leadFmtLabel(r.format),
    value: adrByFormat.find((a) => a.format === r.format)?.adr ?? 0,
    color: leadFmtColor(r.format),
  }));

  const lostDonut = lostReasons.map((r, i) => ({ name: r.stage, value: r.count, color: LOST_REASON_PALETTE[i % LOST_REASON_PALETTE.length] }));

  const ownerRevenueData: BarDatum[] = byOwner.rows.map((r) => ({ name: r.owner, value: r.revenue, color: RANKING_COLOR }));

  const ownerTabs = byOwner.rows.map((r) => r.owner);
  const [activeOwner, setActiveOwner] = useTabbedCard(ownerTabs);
  const activeOwnerRow = byOwner.rows.find((r) => r.owner === activeOwner) ?? byOwner.rows[0];

  // 2026-09-10/11 — Company Analysis inside By Owner Detail ("Final
  // Dashboard Changes" item 6). Sourced from company_revenue_summary
  // (sales_company_bills), joined to company_owner_map for the Owner. That
  // map is currently EMPTY (confirmed live) — every row comes back
  // owner="Unassigned" until someone populates it. Rather than showing
  // nothing under every real owner tab (a strict name match would never
  // hit), Unassigned rows are shown alongside whichever owner tab is
  // active, with an explicit note — the same match narrows itself down
  // automatically, with no code change here, once real Owner values exist.
  const [selectedBizSource, setSelectedBizSource] = useState<string | null>(null);
  const ownerRowsForActive = ownerCompanyAnalysis.filter(
    (r) => canonicalOwner(r.owner) === canonicalOwner(activeOwner ?? "") || r.owner === "Unassigned"
  );
  const hasUnassignedRows = ownerRowsForActive.some((r) => r.owner === "Unassigned");
  const bizSourceTotals = Array.from(
    ownerRowsForActive.reduce((m, r) => m.set(r.businessSource, (m.get(r.businessSource) ?? 0) + r.revenue), new Map<string, number>())
  )
    .map(([source, revenue], i) => ({ name: source, value: revenue, color: LOST_REASON_PALETTE[i % LOST_REASON_PALETTE.length] }))
    .sort((a, b) => b.value - a.value);
  // company rows for the drill-down: all sources, or just the clicked one
  const drillSource = selectedBizSource && bizSourceTotals.some((s) => s.name === selectedBizSource) ? selectedBizSource : null;
  const drillRows = (drillSource ? ownerRowsForActive.filter((r) => r.businessSource === drillSource) : ownerRowsForActive)
    .reduce((m, r) => {
      const cur = m.get(r.company) ?? { company: r.company, nights: 0, revenue: 0 };
      cur.nights += r.nights;
      cur.revenue += r.revenue;
      return m.set(r.company, cur);
    }, new Map<string, { company: string; nights: number; revenue: number }>());
  const drillTotal = [...drillRows.values()].reduce((s, r) => s + r.revenue, 0);
  const drillTable = [...drillRows.values()]
    .map((r) => ({ ...r, adr: r.nights > 0 ? r.revenue / r.nights : null, contributionPct: drillTotal > 0 ? r.revenue / drillTotal : null }))
    .sort((a, b) => b.revenue - a.revenue);

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
          <StatTile
            label="Closed Leads"
            value={summary.closedLeads.toLocaleString("en-IN")}
            delta={summary.comparison.closedLeads.pctChange !== null ? { pct: summary.comparison.closedLeads.pctChange * 100, label: "vs previous" } : undefined}
          />
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
            sub={`${summary.b2cLeadsClosed.toLocaleString("en-IN")} closed → ${b2cAchievedPct}% conversion rate`}
            delta={summary.comparison.b2cLeads.pctChange !== null ? { pct: summary.comparison.b2cLeads.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile
            label="Existing Leads"
            value={summary.existingLeads.toLocaleString("en-IN")}
            sub={`${summary.existingClosedLeads.toLocaleString("en-IN")} closed → ${existingAchievedPct}% conversion rate`}
            delta={summary.comparison.existingLeads.pctChange !== null ? { pct: summary.comparison.existingLeads.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile
            label="Reference Leads"
            value={summary.referenceLeads.toLocaleString("en-IN")}
            sub={`${summary.referenceClosedLeads.toLocaleString("en-IN")} closed → ${referenceAchievedPct}% conversion rate`}
            delta={summary.comparison.referenceLeads.pctChange !== null ? { pct: summary.comparison.referenceLeads.pctChange * 100, label: "vs previous" } : undefined}
          />
        </div>
      </div>

      {/* Item #6: two vertical sides — left = lead volume/funnel, right =
          revenue & owner performance — instead of one long single-column
          stack of cards. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Lead Volume</h3>

          <LeadsMoMCard momByDay={momByDay} compareYoY={compareYoY} />

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
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Revenue & Owners</h3>

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
                  {/* 2026-09-11: the big `value` line is meant for one short
                      number — cramming "263 leads · 36 closed" into it wrapped
                      to 4 lines at that font size in a narrow 4-col tile.
                      Split into a large primary number + a small `sub`
                      caption, the same pattern every other StatTile on the
                      dashboard already uses. */}
                  <StatTile
                    label="Exotel"
                    value={activeOwnerRow.exotelLeads.toLocaleString("en-IN")}
                    sub={`leads · ${activeOwnerRow.exotelClosed.toLocaleString("en-IN")} closed`}
                  />
                  <StatTile label="Reference" value={activeOwnerRow.referenceLeads.toLocaleString("en-IN")} sub="leads" />
                  <StatTile label="Existing" value={activeOwnerRow.existingLeads.toLocaleString("en-IN")} sub="leads" />
                  <StatTile label="ADR" value={activeOwnerRow.adr !== null ? `₹${Math.round(activeOwnerRow.adr).toLocaleString("en-IN")}` : "—"} />
                </div>
              </>
            )}

            {/* Company Analysis — every company billed this scope (any
                Business Source: B2B, B2C, or OTA — companies like Mayrakhee
                Hospitality/Blue Orange Hospitality are genuinely
                B2C-sourced, so this deliberately isn't B2B-only), from
                company_revenue_summary (sales_company_bills) joined to
                company_owner_map for the Owner. */}
            <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Company Analysis</p>
              <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                Click a Business Source to filter the table
              </p>
              {hasUnassignedRows && (
                <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  Owner mapping isn&apos;t set up yet (company_owner_map is empty) — showing every unassigned company under each owner tab until it is.
                </p>
              )}
              {bizSourceTotals.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  No billing data for this scope yet.
                </p>
              ) : (
                <>
                  <DonutChart
                    data={bizSourceTotals}
                    valueFormatter={(v) => formatIndianCurrency(v)}
                    height={180}
                    onSliceClick={(name) => setSelectedBizSource((cur) => (cur === name ? null : name))}
                    activeName={drillSource ?? undefined}
                  />
                  <div className="mt-3 overflow-x-auto">
                    <p className="mb-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {drillSource ? `${drillSource} — companies` : "All companies"}
                      {drillSource && (
                        <button type="button" onClick={() => setSelectedBizSource(null)} className="ml-2 text-teal-700 hover:underline dark:text-teal-300">clear</button>
                      )}
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                          <th className="pb-1 text-left font-medium">Company</th>
                          <th className="pb-1 pl-2 text-right font-medium">Nights</th>
                          <th className="pb-1 pl-2 text-right font-medium">ADR</th>
                          <th className="pb-1 pl-2 text-right font-medium">Revenue</th>
                          <th className="pb-1 pl-2 text-right font-medium">Contribution %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillTable.map((r) => (
                          <tr key={r.company} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                            <td className="py-1.5 pr-2 text-zinc-700 dark:text-zinc-200">{r.company}</td>
                            <td className="py-1.5 pl-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{r.nights.toLocaleString("en-IN")}</td>
                            <td className="py-1.5 pl-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{r.adr !== null ? `₹${Math.round(r.adr).toLocaleString("en-IN")}` : "—"}</td>
                            <td className="py-1.5 pl-2 text-right tabular-nums font-medium text-zinc-800 dark:text-zinc-100">{formatIndianCurrency(r.revenue)}</td>
                            <td className="py-1.5 pl-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{r.contributionPct !== null ? formatPercent(r.contributionPct, 0) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </TabbedCard>
        </div>
      </div>
    </div>
  );
}
