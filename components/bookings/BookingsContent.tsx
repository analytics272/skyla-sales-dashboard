"use client";

import { useState } from "react";
// 2026-09-02 redesign, fifth pass — Bookings merges the old Booking Details
// and OTA Breakdown pages (B2B already lived inside Booking Details). Where
// two cards showed the same shape of breakdown (a donut, or a pair of ranked
// bar lists) for closely related data, they're folded into one TabbedCard
// per item #11 ("group same kind of things in one card, internal tabs for
// better minimal navigation") rather than left as separate cards.
import {
  BookingStats, RoomNightsGap, RepeatBookingShare, RoomFormatStats,
  ExpatStats, CancellationStats, CancellationLeadTime, CategoryMix, GuestServedAccuracyCheck,
} from "@/lib/bigquery/queries/guestDetail";
import type { B2bContractRanking, RetentionPoint, B2bContractSummary } from "@/lib/bigquery/queries/b2bContracts";
import type { OtaBreakdownRow } from "@/lib/bigquery/queries/otaBreakdown";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import TabbedCard, { useTabbedCard } from "@/components/ui/TabbedCard";
import { BarDatum } from "@/components/charts/SingleMetricBarChart";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import DistributionBar from "@/components/charts/DistributionBar";
import DonutChart from "@/components/charts/DonutChart";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import SearchInput from "@/components/ui/SearchInput";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { ROOM_TYPE_COLOR, ROOM_TYPE_ORDER, CATEGORY_COLOR, CATEGORY_ORDER } from "@/lib/design/tokens";

const OTA_PALETTE = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--chart-baseline)", "#a855f7", "#0ea5e9"];
// 2026-09-11: Contract_Status (from b2b_bills, joined by FolioNo — see
// b2bContracts.ts) restored on the Revenue tab only, per explicit
// "mapping and status can use b2b_bills, every DATA point is from PMS"
// direction. The other three tabs (Nights/ADR/Contribution %) use one
// flat colour — contract status is specifically a revenue/relationship
// concept, not meaningful per-night or per-ADR.
const CONTRACT_STATUS_COLOR: Record<string, string> = {
  Contract: "var(--chart-delta-good)",
  "No Contract": "#d97706",
};
const CONTRACT_STATUS_FALLBACK = "var(--chart-baseline)";
const COMPANY_RANKING_COLOR = "var(--series-1)";
/** Top N shown per Company Rankings tab (user direction 2026-09-11) — was "show all N" behind an Expandable. */
const COMPANY_RANKING_TOP_N = 8;
/** Legal company names here run long (SEZ/subsidiary suffixes); truncate the bar label instead of letting it wrap across rows — full name still shows on hover. Rank number is rendered on its own line (see HorizontalBarChart's TruncatedTick) so it's never affected by this; kept conservative (well under labelWidth's ~170px at 11px all-caps text) so the name line itself doesn't overflow either. */
const COMPANY_RANKING_LABEL_CHARS = 24;

type MixTab = "Category" | "Room Format";
const MIX_TABS: MixTab[] = ["Category", "Room Format"];

type FormatTab = "Revenue" | "ADR";
const FORMAT_TABS: FormatTab[] = ["Revenue", "ADR"];

type OtaTab = "Revenue Share" | "Net Revenue" | "Commission %";
const OTA_TABS: OtaTab[] = ["Revenue Share", "Net Revenue", "Commission %"];

// 2026-09-09: Company Rankings — Revenue/Nights/ADR/Contribution % used to
// be three separate cards; merged into one internal-tabbed card (see the
// data-prep comment below) to remove the duplication.
type CompanyTab = "Revenue" | "Nights" | "ADR" | "Contribution %";
const COMPANY_TABS: CompanyTab[] = ["Revenue", "Nights", "ADR", "Contribution %"];

export default function BookingsContent({
  bookingStats,
  roomNightsGap,
  repeatBookingShare,
  roomFormatStats,
  expatStats,
  cancellationStats,
  cancellationLeadTime,
  categoryMix,
  b2bRanking,
  b2bContractSummary,
  b2bRangeLabel,
  b2bRetention,
  guestServedAccuracy,
  otaBreakdown,
}: {
  bookingStats: BookingStats;
  roomNightsGap: RoomNightsGap;
  repeatBookingShare: RepeatBookingShare;
  roomFormatStats: RoomFormatStats[];
  expatStats: ExpatStats;
  cancellationStats: CancellationStats;
  cancellationLeadTime: CancellationLeadTime;
  categoryMix: CategoryMix[];
  b2bRanking: B2bContractRanking[];
  b2bContractSummary: B2bContractSummary;
  /** What Company Rankings/Revenue By Company/OTA Breakdown are actually scoped to — these narrow to the active period tab now (2026-09-09), not always the whole FY. */
  b2bRangeLabel: string;
  b2bRetention: RetentionPoint[];
  guestServedAccuracy: GuestServedAccuracyCheck;
  otaBreakdown: OtaBreakdownRow[];
}) {
  const [mixTab, setMixTab] = useTabbedCard(MIX_TABS);
  const [formatTab, setFormatTab] = useTabbedCard(FORMAT_TABS);
  const [otaTab, setOtaTab] = useTabbedCard(OTA_TABS);
  const [companyTab, setCompanyTabRaw] = useTabbedCard(COMPANY_TABS);
  const [companyPage, setCompanyPage] = useState(0);
  const [companySearch, setCompanySearchRaw] = useState("");
  const setCompanyTab = (tab: (typeof COMPANY_TABS)[number]) => {
    setCompanyTabRaw(tab);
    setCompanyPage(0); // 2026-09-11: reset to page 1 when switching metric — each tab's own ranking starts over
  };
  const setCompanySearch = (v: string) => {
    setCompanySearchRaw(v);
    setCompanyPage(0); // 2026-09-17: a new search narrows the list — start back at page 1
  };

  const roomTypeLabel = (rt: string | null) => rt ?? "Unmapped";
  const roomTypesPresent = [
    ...ROOM_TYPE_ORDER.filter((rt) => roomFormatStats.some((r) => r.roomType === rt)),
    ...(roomFormatStats.some((r) => r.roomType === null) ? ["Unmapped" as const] : []),
  ];

  const revenueByFormat: BarDatum[] = roomTypesPresent.map((rt) => {
    const row = roomFormatStats.find((r) => roomTypeLabel(r.roomType) === rt);
    return { name: rt, value: row?.revenue ?? 0, color: ROOM_TYPE_COLOR[rt] ?? "var(--chart-baseline)" };
  });
  const adrByFormat: BarDatum[] = roomTypesPresent.map((rt) => {
    const row = roomFormatStats.find((r) => roomTypeLabel(r.roomType) === rt);
    return { name: rt, value: row?.adr ?? 0, color: ROOM_TYPE_COLOR[rt] ?? "var(--chart-baseline)" };
  });
  const nightsShareDonut = roomTypesPresent.map((rt) => {
    const row = roomFormatStats.find((r) => roomTypeLabel(r.roomType) === rt);
    return { name: rt, value: row?.nights ?? 0, color: ROOM_TYPE_COLOR[rt] ?? "var(--chart-baseline)" };
  });

  const categoriesPresent = CATEGORY_ORDER.filter((c) => categoryMix.some((m) => m.category === c));
  const revenueDonut = categoriesPresent.map((c) => {
    const m = categoryMix.find((x) => x.category === c);
    return { name: c, value: m?.revenue ?? 0, color: CATEGORY_COLOR[c] };
  });

  // 2026-09-09 (later, same day): "Revenue By Company", "Company
  // Contribution By" (Nights/Revenue/ADR mini-tables), and "Contribution %"
  // used to be three separate cards all ranking the same ~70 companies by a
  // different metric — genuinely duplicate information laid out three ways.
  // Merged into one TabbedCard (Revenue / Nights / ADR / Contribution %),
  // the same internal-tab pattern used for Revenue Mix and By Room Format
  // above. b2bRanking is already revenue-sorted (backend ORDER BY
  // roomRevenue DESC); Nights, ADR, and Contribution % are re-sorted
  // client-side — no new query for any of the four.
  //
  // 2026-09-11: paginated 8-per-page (first page = top 8), with a rank
  // number prefixed onto each bar's label that stays GLOBAL across pages
  // (page 2 starts at "9.", not "1." again) — was "show all N" behind an
  // Expandable. Also: Company Rankings moved onto `sales_company_bills`
  // (see b2bContracts.ts) for every number; Contract_Status (green/amber)
  // is restored on the Revenue tab only, still sourced from b2b_bills via
  // the FolioNo join that file does — per explicit "mapping and status can
  // use b2b_bills, every DATA point is from PMS" direction.
  const ranked = <T,>(rows: T[], sortKey: (r: T) => number) => [...rows].sort((a, b) => sortKey(b) - sortKey(a));
  const page = <T,>(rows: T[]) => rows.slice(companyPage * COMPANY_RANKING_TOP_N, companyPage * COMPANY_RANKING_TOP_N + COMPANY_RANKING_TOP_N);
  const numbered = (name: string, i: number) => `${companyPage * COMPANY_RANKING_TOP_N + i + 1}. ${name}`;

  // 2026-09-17: company search narrows the ranked/paginated bars only —
  // the coverage caption, contract donut, and "(N) companies" title below
  // still describe the FULL period population, not the live search result.
  const companySearchTrimmed = companySearch.trim().toLowerCase();
  const b2bRankingSearched = companySearchTrimmed
    ? b2bRanking.filter((r) => r.company.toLowerCase().includes(companySearchTrimmed))
    : b2bRanking;

  const b2bRevenueRanked = ranked(b2bRankingSearched, (r) => r.roomRevenue);
  const b2bNightsRanked = ranked(b2bRankingSearched, (r) => r.nights);
  // 2026-09-17: ADR ranking needs a minimum-volume floor, or it's not
  // actually ranking "high rate" companies — a company with just 1-2
  // nights on a single bill can post a huge average (one real ₹16,000/
  // night 2-night stay tops the whole list ahead of companies with
  // hundreds of nights at ₹8-9k) purely because a tiny sample doesn't
  // average out. Not a data error — every one of these bills is real —
  // just a misleading ranking without a floor. 5 nights excludes ~31%
  // of This FY's B2B+B2C companies (63 of 203, checked live) from ONLY
  // this tab; Revenue/Nights/Contribution % are unaffected since those
  // aren't average-based and a low-volume company legitimately belongs
  // near the bottom of those rankings rather than being excluded.
  const ADR_RANKING_MIN_NIGHTS = 5;
  const b2bAdrRanked = ranked(b2bRankingSearched.filter((r) => r.adr !== null && r.nights >= ADR_RANKING_MIN_NIGHTS), (r) => r.adr ?? 0);
  const b2bContributionRanked = ranked(b2bRankingSearched.filter((r) => r.contributionPct !== null), (r) => r.contributionPct ?? 0);
  const companyRankedByTab: Record<(typeof COMPANY_TABS)[number], typeof b2bRanking> = {
    Revenue: b2bRevenueRanked, Nights: b2bNightsRanked, ADR: b2bAdrRanked, "Contribution %": b2bContributionRanked,
  };
  const companyPageCount = Math.max(1, Math.ceil(companyRankedByTab[companyTab].length / COMPANY_RANKING_TOP_N));

  // 2026-09-17: ADR rightLabel dropped from the Revenue tab's bars per
  // explicit user direction — ADR already has its own dedicated tab, no
  // need to duplicate it alongside the Revenue bars.
  const b2bRevenueData: BarDatum[] = page(b2bRevenueRanked).map((r, i) => ({
    name: numbered(r.company, i),
    value: r.roomRevenue,
    color: CONTRACT_STATUS_COLOR[r.contractStatus ?? ""] ?? CONTRACT_STATUS_FALLBACK,
  }));
  const b2bNightsData: BarDatum[] = page(b2bNightsRanked).map((r, i) => ({
    name: numbered(r.company, i), value: r.nights, color: COMPANY_RANKING_COLOR,
  }));
  const b2bAdrData: BarDatum[] = page(b2bAdrRanked).map((r, i) => ({
    name: numbered(r.company, i), value: r.adr ?? 0, color: COMPANY_RANKING_COLOR,
  }));
  const b2bContributionData: BarDatum[] = page(b2bContributionRanked).map((r, i) => ({
    name: numbered(r.company, i), value: (r.contributionPct ?? 0) * 100, color: COMPANY_RANKING_COLOR,
  }));

  // 2026-09-11: Company Rankings is now sourced from sales_company_bills
  // (PMS-derived, see b2bContracts.ts) — a bill not yet tagged with a
  // CompanyId there has no company attached and drops out of the ranking.
  // Surfacing that gap explicitly instead of letting totals silently not
  // reconcile with the Booking Category Mix card's own figures above,
  // which ARE the true PMS totals for this period/scope.
  // 2026-09-17: broadened to B2B + B2C (OTA still excluded) — see
  // b2bContracts.ts's revision-history comment — so the coverage
  // denominator is now both categories' combined revenue, not B2B alone.
  const totalCompanyRevenuePms =
    (categoryMix.find((m) => m.category === "B2B")?.revenue ?? 0) +
    (categoryMix.find((m) => m.category === "B2C")?.revenue ?? 0);
  const mappedCompanyRevenue = b2bRanking.reduce((s, r) => s + r.roomRevenue, 0);
  const companyMappedCoveragePct = totalCompanyRevenuePms > 0 ? (mappedCompanyRevenue / totalCompanyRevenuePms) * 100 : null;

  // Item #10: the two raw StatTiles here (a revenue figure and a company
  // count) are replaced by one donut reading "what share of B2B revenue is
  // contractually secured" — Revenue tab only, since Contract_Status is a
  // per-company attribute of the whole relationship, not a per-night/ADR one.
  const totalB2bRevenue = b2bRanking.reduce((s, r) => s + r.roomRevenue, 0);
  const noContractRevenue = Math.max(0, totalB2bRevenue - b2bContractSummary.totalContractRevenue);
  const contractShareDonut = [
    { name: "Contract", value: b2bContractSummary.totalContractRevenue, color: CONTRACT_STATUS_COLOR.Contract },
    { name: "No Contract", value: noContractRevenue, color: CONTRACT_STATUS_COLOR["No Contract"] },
  ];

  const totalOtaNights = otaBreakdown.reduce((s, r) => s + r.nights, 0);
  const totalOtaRevenue = otaBreakdown.reduce((s, r) => s + r.totalRevenue, 0);
  const netOtaRevenue = otaBreakdown.reduce((s, r) => s + r.netRevenue, 0);
  const blendedCommissionPct = totalOtaRevenue > 0 ? (1 - netOtaRevenue / totalOtaRevenue) * 100 : 0;
  const otaRevenueDonut = otaBreakdown.map((r, i) => ({ name: r.otaName, value: r.totalRevenue, color: OTA_PALETTE[i % OTA_PALETTE.length] }));
  const otaNetRevenueData: BarDatum[] = otaBreakdown.map((r, i) => ({ name: r.otaName, value: r.netRevenue, color: OTA_PALETTE[i % OTA_PALETTE.length] }));
  const otaCommissionData: BarDatum[] = otaBreakdown.map((r, i) => ({ name: r.otaName, value: r.avgCommissionPct, color: OTA_PALETTE[i % OTA_PALETTE.length] }));
  const otaAdrData = otaBreakdown.map((r) => ({
    ota: r.otaName,
    "Before Commission": r.adrBeforeCommission ?? 0,
    "After Commission": r.adrAfterCommission ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="Total Bookings"
            value={bookingStats.totalBookings.toLocaleString("en-IN")}
            delta={bookingStats.comparison.totalBookings.pctChange !== null ? { pct: bookingStats.comparison.totalBookings.pctChange * 100, label: "vs previous" } : undefined}
          />
          {/* Item #1 (2026-09-02, ninth pass): "Unique" dropped from the
              label; the Data Error Rate line is now just "Error Rate: X%",
              bold, instead of a full sentence — the "Guest Served — Sheet Vs
              BigQuery" card it used to live in was already removed last pass. */}
          <StatTile
            label="Guests Served"
            value={bookingStats.guestsServed.toLocaleString("en-IN")}
            subBold={`Error Rate: ${guestServedAccuracy.dataErrorRatePct !== null ? formatPercent(guestServedAccuracy.dataErrorRatePct, 1) : "—"}`}
            delta={bookingStats.comparison.guestsServed.pctChange !== null ? { pct: bookingStats.comparison.guestsServed.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile
            label="ALOS"
            value={bookingStats.alos !== null ? `${bookingStats.alos.toFixed(1)} nights` : "—"}
            delta={bookingStats.comparison.alos.pctChange !== null ? { pct: bookingStats.comparison.alos.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile
            label="Revenue Per Guest"
            value={bookingStats.revenuePerGuest !== null ? `₹${Math.round(bookingStats.revenuePerGuest).toLocaleString("en-IN")}` : "—"}
            delta={bookingStats.comparison.revenuePerGuest.pctChange !== null ? { pct: bookingStats.comparison.revenuePerGuest.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile
            label="Repeat Bookings"
            value={repeatBookingShare.repeatBookings.toLocaleString("en-IN")}
            sub={repeatBookingShare.sharePct !== null ? `${formatPercent(repeatBookingShare.sharePct)} of ${repeatBookingShare.totalBookings.toLocaleString("en-IN")}` : undefined}
            delta={repeatBookingShare.comparison.sharePct.pctChange !== null ? { pct: repeatBookingShare.comparison.sharePct.pctChange * 100, label: "share vs previous" } : undefined}
          />
          <StatTile
            label="Cancellations"
            value={cancellationStats.cancellationPct !== null ? formatPercent(cancellationStats.cancellationPct) : "—"}
            sub={`${cancellationStats.cancelledBookings.toLocaleString("en-IN")} of ${(cancellationStats.activeBookings + cancellationStats.cancelledBookings).toLocaleString("en-IN")}`}
            delta={cancellationStats.comparison.cancellationPct.pctChange !== null ? { pct: cancellationStats.comparison.cancellationPct.pctChange * 100, label: "vs previous", upIsGood: false } : undefined}
          />
        </div>
      </div>

      {/* 2026-09-10 ("Final Dashboard Changes" item 5): Available / Sold /
          Till-Date Unsold / Remaining were four separate tiles that only make
          sense read together — now one distribution bar showing how the
          period's Available room nights split. Sold is the whole selected
          scope (incl. advance bookings); Till-Date Unsold is the completed
          portion's miss (through yesterday); Remaining is capacity still to
          sell (today forward). They sum to ~Available (a ~0.1% today-boundary
          overlap). BH4's "3 Bedroom Apartments" ×3 weighting applies to Sold
          the same way it does everywhere else — verified against Looker. */}
      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <Card
          title="Room Nights"
          subtitle={`Available ${roomNightsGap.availableRoomNights.toLocaleString("en-IN")} — how the selected period splits`}
        >
          <DistributionBar
            segments={[
              { label: "Sold", value: roomNightsGap.soldRoomNights, color: "var(--series-6)" },
              { label: "Till-Date Unsold", value: roomNightsGap.unsoldRoomNights, color: "#d97706", note: "through yesterday" },
              { label: "Remaining", value: roomNightsGap.remainingRoomNights, color: "var(--series-1)", note: "today forward" },
            ]}
          />
        </Card>
        <StatTile
          label="Avg Cancellation Lead Time"
          value={cancellationLeadTime.avgLeadTimeDays !== null ? `${cancellationLeadTime.avgLeadTimeDays.toFixed(1)} days` : "—"}
          sub={`n=${cancellationLeadTime.sampledCancellations.toLocaleString("en-IN")}`}
          delta={cancellationLeadTime.comparison.avgLeadTimeDays.pctChange !== null ? { pct: cancellationLeadTime.comparison.avgLeadTimeDays.pctChange * 100, label: "vs previous", upIsGood: false } : undefined}
        />
      </div>

      <div>
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Expats</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Expat Bookings" value={expatStats.bookings.toLocaleString("en-IN")} />
          <StatTile label="Expat Revenue" value={formatIndianCurrency(expatStats.revenue)} />
          <StatTile label="Expat Nights" value={expatStats.nights.toLocaleString("en-IN")} />
          <StatTile label="Expat ALOS" value={expatStats.alos !== null ? `${expatStats.alos.toFixed(1)} nights` : "—"} />
        </div>
      </div>

      {/* Item #9/#11: paired side by side instead of full-width stacked. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <TabbedCard title="Revenue Mix" tabs={MIX_TABS} active={mixTab} onChange={setMixTab}>
          {mixTab === "Category" ? (
            <DonutChart data={revenueDonut} valueFormatter={(v) => formatIndianCurrency(v)} />
          ) : (
            <DonutChart data={nightsShareDonut} valueFormatter={(v) => v.toLocaleString("en-IN")} />
          )}
        </TabbedCard>

        <TabbedCard title="By Room Format" tabs={FORMAT_TABS} active={formatTab} onChange={setFormatTab}>
          {formatTab === "Revenue" ? (
            <HorizontalBarChart data={revenueByFormat} valueFormatter={(v) => formatIndianCurrency(v)} />
          ) : (
            <HorizontalBarChart data={adrByFormat} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
          )}
        </TabbedCard>
      </div>

      <div>
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Company Contracts</h3>
        {/* 2026-09-11: Company Rankings now sourced from
            sales_company_bills (PMS-derived — see b2bContracts.ts) for
            every number; b2b_bills is used only for Contract_Status
            (Revenue tab colouring) via the same FolioNo join. A bill not
            yet tagged with a CompanyId has no company attached and drops
            out of the ranking; the coverage line below states what
            fraction of this period's real company revenue that currently
            is. Top 8 companies shown per tab (was "show all N" behind an
            Expandable), each bar numbered by rank.
            2026-09-17: broadened from B2B-only to B2B + B2C (same
            company population as Leads' By Owner Detail card, OTA still
            excluded) — heading and captions reworded accordingly. */}
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Scoped to {b2bRangeLabel}</p>
        {companyMappedCoveragePct !== null && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {companyMappedCoveragePct.toFixed(0)}% of this period&apos;s B2B + B2C revenue is mapped to a company below — the rest hasn&apos;t been tagged with a company in the PMS billing extract yet.
          </p>
        )}

        <div className="mt-2">
          <TabbedCard
            title={`Company Rankings (${b2bRanking.length})`}
            subtitle={`${COMPANY_RANKING_TOP_N} per page · Revenue bars: green = under contract, amber = no contract`}
            tabs={COMPANY_TABS}
            active={companyTab}
            onChange={setCompanyTab}
          >
            {b2bRanking.length > 0 ? (
              <>
                {/* 2026-09-17: filters the ranked bars/pagination only — the
                    contract donut and coverage caption above stay scoped to
                    the whole period, not the live search. */}
                <div className="mb-3">
                  <SearchInput value={companySearch} onChange={setCompanySearch} placeholder="Search company…" />
                </div>
                {companyTab === "Revenue" && (
                  <div className="mb-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                    <div className="flex justify-center">
                      <DonutChart data={contractShareDonut} valueFormatter={(v) => formatIndianCurrency(v)} height={140} innerRadiusRatio={0.58} />
                    </div>
                    <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
                      {b2bContractSummary.contractCompanyCount.toLocaleString("en-IN")} of {b2bRanking.length.toLocaleString("en-IN")} companies under contract.
                      Contract revenue reflects Contract_Status = Contract rows only, not each company&apos;s total revenue.
                    </p>
                  </div>
                )}
                {companyTab === "ADR" && (
                  <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
                    Only companies with {ADR_RANKING_MIN_NIGHTS}+ nights this period are ranked here — a company with just 1-2 nights can post a misleadingly high average rate that doesn&apos;t reflect an ongoing relationship.
                  </p>
                )}
                {companyRankedByTab[companyTab].length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                    No companies match &quot;{companySearch}&quot;.
                  </p>
                ) : (
                  <>
                    {companyTab === "Revenue" && <HorizontalBarChart data={b2bRevenueData} valueFormatter={(v) => formatIndianCurrency(v)} labelWidth={170} maxLabelChars={COMPANY_RANKING_LABEL_CHARS} />}
                    {companyTab === "Nights" && <HorizontalBarChart data={b2bNightsData} valueFormatter={(v) => v.toLocaleString("en-IN")} labelWidth={170} maxLabelChars={COMPANY_RANKING_LABEL_CHARS} />}
                    {companyTab === "ADR" && <HorizontalBarChart data={b2bAdrData} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} labelWidth={170} maxLabelChars={COMPANY_RANKING_LABEL_CHARS} />}
                    {companyTab === "Contribution %" && <HorizontalBarChart data={b2bContributionData} valueFormatter={(v) => `${v.toFixed(0)}%`} labelWidth={170} maxLabelChars={COMPANY_RANKING_LABEL_CHARS} />}
                  </>
                )}
                {/* 2026-09-11: pagination — first page is top 8, Next/Prev
                    step through the rest of this tab's ranked list 8 at a
                    time, numbering staying global (page 2 starts at "9."). */}
                {companyPageCount > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setCompanyPage((p) => Math.max(0, p - 1))}
                      disabled={companyPage === 0}
                      className="rounded-full border border-zinc-200 px-2.5 py-1 font-medium text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      ← Prev
                    </button>
                    <span className="text-zinc-400 dark:text-zinc-500">Page {companyPage + 1} of {companyPageCount}</span>
                    <button
                      type="button"
                      onClick={() => setCompanyPage((p) => Math.min(companyPageCount - 1, p + 1))}
                      disabled={companyPage >= companyPageCount - 1}
                      className="rounded-full border border-zinc-200 px-2.5 py-1 font-medium text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            ) : (
              // 2026-09-11: company_revenue_summary can still lag live PMS
              // bookings by a variable amount (a bill not yet tagged with a
              // CompanyId), same reasoning as the old b2b_bills note, just
              // a different source now — kept generic rather than naming a
              // specific catch-up time (an earlier "about a month" claim
              // for b2b_bills turned out to be wrong when checked live).
              <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                No billing data synced yet for {b2bRangeLabel}.
              </p>
            )}
          </TabbedCard>
        </div>

        {/* Item #2 (2026-09-02, ninth pass): Retention and OTA Breakdown are
            both short, StatTile-only cards — paired side by side instead of
            each sitting alone on its own row. 2026-09-09: previously paired
            against a tall standalone "Contribution %" card that's now one
            of the Company Rankings tabs above (see revision history), so
            this row now stands on its own. */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card title="Corporate Account Retention">
            <div className="grid grid-cols-2 gap-3">
              {b2bRetention.map((r) => (
                <StatTile
                  key={`${r.fromFy}-${r.toFy}`}
                  label={`${r.fromFy} → ${r.toFy}`}
                  value={r.retentionPct !== null ? formatPercent(r.retentionPct, 0) : "—"}
                  sub={`${r.retainedCompanies.toLocaleString("en-IN")} of ${r.companiesInFromFy.toLocaleString("en-IN")} retained`}
                />
              ))}
            </div>
          </Card>
          <Card title="OTA Breakdown">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Total Nights" value={totalOtaNights.toLocaleString("en-IN")} />
              <StatTile label="Total Revenue" value={formatIndianCurrency(totalOtaRevenue)} />
              <StatTile label="Net Revenue" value={formatIndianCurrency(netOtaRevenue)} />
              <StatTile label="Blended Commission %" value={`${blendedCommissionPct.toFixed(1)}%`} />
            </div>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">OTA Breakdown</h3>
        {otaBreakdown.length > 0 ? (
          <>
            <div className="mt-2">
              <TabbedCard title="By OTA Site" tabs={OTA_TABS} active={otaTab} onChange={setOtaTab}>
                {otaTab === "Revenue Share" && <DonutChart data={otaRevenueDonut} valueFormatter={(v) => formatIndianCurrency(v)} />}
                {otaTab === "Net Revenue" && <HorizontalBarChart data={otaNetRevenueData} valueFormatter={(v) => formatIndianCurrency(v)} />}
                {otaTab === "Commission %" && <HorizontalBarChart data={otaCommissionData} valueFormatter={(v) => `${v.toFixed(1)}%`} />}
              </TabbedCard>
            </div>

            <div className="mt-3">
              <Card title="ADR Before / After Commission By OTA Site">
                <GroupedBarChart
                  data={otaAdrData}
                  xKey="ota"
                  series={[
                    { key: "Before Commission", color: "var(--series-1)" },
                    { key: "After Commission", color: "var(--series-3)" },
                  ]}
                  valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`}
                />
              </Card>
            </div>
          </>
        ) : (
          // 2026-09-09: a genuinely OTA-free period for the selected
          // property/scope (e.g. BH4 in a month with zero OTA bookings) —
          // not a bug, but a blank donut + blank grouped-bar chart with a
          // floating legend read as broken, so state it plainly instead.
          <p className="mt-2 rounded-lg border border-zinc-200 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            No OTA bookings in this period.
          </p>
        )}
      </div>
    </div>
  );
}
