"use client";

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
import type { B2bContractRanking, B2bTopAdrContract, RetentionPoint, B2bContractSummary } from "@/lib/bigquery/queries/b2bContracts";
import type { OtaBreakdownRow } from "@/lib/bigquery/queries/otaBreakdown";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import Expandable from "@/components/ui/Expandable";
import TabbedCard, { useTabbedCard } from "@/components/ui/TabbedCard";
import { BarDatum } from "@/components/charts/SingleMetricBarChart";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import DonutChart from "@/components/charts/DonutChart";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { ROOM_TYPE_COLOR, ROOM_TYPE_ORDER, CATEGORY_COLOR, CATEGORY_ORDER } from "@/lib/design/tokens";

const CONTRACT_STATUS_COLOR: Record<string, string> = {
  Contract: "var(--chart-delta-good)",
  "No Contract": "#d97706",
};
const CONTRACT_STATUS_FALLBACK = "var(--chart-baseline)";
const OTA_PALETTE = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--chart-baseline)", "#a855f7", "#0ea5e9"];

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
  b2bTopAdr,
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
  b2bTopAdr: B2bTopAdrContract[];
  /** What Company Rankings/Revenue By Company/OTA Breakdown are actually scoped to — these narrow to the active period tab now (2026-09-09), not always the whole FY. */
  b2bRangeLabel: string;
  b2bRetention: RetentionPoint[];
  guestServedAccuracy: GuestServedAccuracyCheck;
  otaBreakdown: OtaBreakdownRow[];
}) {
  const [mixTab, setMixTab] = useTabbedCard(MIX_TABS);
  const [formatTab, setFormatTab] = useTabbedCard(FORMAT_TABS);
  const [otaTab, setOtaTab] = useTabbedCard(OTA_TABS);
  const [companyTab, setCompanyTab] = useTabbedCard(COMPANY_TABS);

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
  // Per explicit "keep tabs, shift internal for metric" direction, merged
  // into one TabbedCard (Revenue / Nights / ADR / Contribution %), the same
  // internal-tab pattern already used for Revenue Mix and By Room Format
  // above. Each tab shows the FULL ranked company list (not just a top-5
  // taste), inside the same Expandable used before. b2bRanking is already
  // revenue-sorted (backend ORDER BY roomRevenue DESC) and b2bTopAdr
  // already avgAdr-sorted; Nights and Contribution % are re-sorted
  // client-side — no new query for any of the four.
  const b2bRevenueData: BarDatum[] = b2bRanking.map((r) => ({
    name: r.company,
    value: r.roomRevenue,
    color: CONTRACT_STATUS_COLOR[r.contractStatus ?? ""] ?? CONTRACT_STATUS_FALLBACK,
    rightLabel: r.adr !== null ? `ADR ₹${Math.round(r.adr).toLocaleString("en-IN")}` : undefined,
  }));
  const b2bNightsData: BarDatum[] = [...b2bRanking]
    .sort((a, b) => b.nights - a.nights)
    .map((r) => ({ name: r.company, value: r.nights, color: "var(--series-1)" }));
  const b2bAdrData: BarDatum[] = b2bTopAdr.map((r) => ({ name: r.company, value: r.avgAdr, color: "var(--series-3)" }));
  const b2bContributionData: BarDatum[] = [...b2bRanking]
    .filter((r) => r.contributionPct !== null)
    .sort((a, b) => (b.contributionPct ?? 0) - (a.contributionPct ?? 0))
    .map((r) => ({ name: r.company, value: (r.contributionPct ?? 0) * 100, color: "var(--series-2)" }));

  // Item #10: the two raw StatTiles here (a revenue figure and a company
  // count — different units, hard to compare at a glance) are replaced by
  // one donut reading "what share of B2B revenue is contractually secured",
  // which is the actual question those two numbers were trying to answer.
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Available Room Nights" value={roomNightsGap.availableRoomNights.toLocaleString("en-IN")} />
        <StatTile label="Sold Room Nights" value={roomNightsGap.soldRoomNights.toLocaleString("en-IN")} />
        {/* 2026-09-08: renamed from "Unsold Room Nights" — the formula
            changed at the same time to a genuine to-date reading (Available
            minus Sold, both clamped to yesterday), not the whole selected
            scope like the two tiles beside it, so the label says so
            explicitly rather than looking like the same kind of number. */}
        <StatTile label="Till Date Unsold Nights" value={roomNightsGap.unsoldRoomNights.toLocaleString("en-IN")} sub="through yesterday" />
        <StatTile label="Remaining Room Nights" value={roomNightsGap.remainingRoomNights.toLocaleString("en-IN")} sub="from today forward" />
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
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">B2B Contracts</h3>
        {/* 2026-09-09: every card below now scopes to the active period tab
            (e.g. "This Month" narrows to just that month's b2b_bills rows),
            not always the whole governing FY — see b2bContracts.ts's own
            comment for the full reasoning. Stated plainly since b2b_bills is
            invoiced with a lag (a just-finished month can legitimately show
            0 rows here for a day or two until billing catches up), which
            would otherwise look like a bug rather than expected latency. */}
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Scoped to {b2bRangeLabel}</p>

        {/* Item #1 (2026-09-02, seventh pass): donut + caption stacked and
            centered instead of a flex row — at some widths the caption's
            long sentence was squeezing the donut's legend column, wrapping
            "3.43 Cr · 65%" onto three lines. Stacking removes any squeeze.
            2026-09-09: the Treemap below it was replaced with a horizontal
            bar chart — per explicit feedback, a treemap's box-size-by-value
            encoding makes every company past the top handful illegible
            (label text shrinks/gets cut as boxes shrink), where a sorted bar
            list stays readable at any company count. */}
        <div className="mt-2">
          <TabbedCard
            title={`Company Rankings (${b2bRanking.length})`}
            subtitle="Revenue is color-coded green = under contract, amber = no contract"
            tabs={COMPANY_TABS}
            active={companyTab}
            onChange={setCompanyTab}
          >
            {b2bRanking.length > 0 ? (
              <>
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
                <Expandable collapsedHeight={420} label={`Show all ${b2bRanking.length}`}>
                  {companyTab === "Revenue" && <HorizontalBarChart data={b2bRevenueData} valueFormatter={(v) => formatIndianCurrency(v)} labelWidth={150} />}
                  {companyTab === "Nights" && <HorizontalBarChart data={b2bNightsData} valueFormatter={(v) => v.toLocaleString("en-IN")} labelWidth={150} />}
                  {companyTab === "ADR" && <HorizontalBarChart data={b2bAdrData} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} labelWidth={150} />}
                  {companyTab === "Contribution %" && <HorizontalBarChart data={b2bContributionData} valueFormatter={(v) => `${v.toFixed(0)}%`} labelWidth={150} />}
                </Expandable>
              </>
            ) : (
              // 2026-09-09: b2b_bills lags live PMS bookings by roughly a
              // month, so a narrow, very recent period tab (e.g. "This
              // Month") can legitimately have zero billing rows yet even
              // when sales_booking shows real B2B revenue for the same
              // window (see the Booking Category Mix card above). Spelled
              // out explicitly so this reads as sync latency, not a broken
              // chart — one shared empty state for all four tabs, since
              // they all derive from the same (currently empty) source.
              <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                No B2B billing data synced yet for {b2bRangeLabel} — b2b_bills typically lags live bookings by about a month.
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
