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
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import DonutChart from "@/components/charts/DonutChart";
import Treemap from "@/components/charts/Treemap";
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

type B2bRankTab = "Contribution %" | "Top ADR";
const B2B_RANK_TABS: B2bRankTab[] = ["Contribution %", "Top ADR"];

type OtaTab = "Revenue Share" | "Net Revenue" | "Commission %";
const OTA_TABS: OtaTab[] = ["Revenue Share", "Net Revenue", "Commission %"];

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
  b2bRetention: RetentionPoint[];
  guestServedAccuracy: GuestServedAccuracyCheck;
  otaBreakdown: OtaBreakdownRow[];
}) {
  const [mixTab, setMixTab] = useTabbedCard(MIX_TABS);
  const [formatTab, setFormatTab] = useTabbedCard(FORMAT_TABS);
  const [b2bRankTab, setB2bRankTab] = useTabbedCard(B2B_RANK_TABS);
  const [otaTab, setOtaTab] = useTabbedCard(OTA_TABS);

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

  const b2bRevenueData: BarDatum[] = b2bRanking.map((r) => ({
    name: r.company,
    value: r.roomRevenue,
    color: CONTRACT_STATUS_COLOR[r.contractStatus ?? ""] ?? CONTRACT_STATUS_FALLBACK,
  }));
  const b2bContributionData: BarDatum[] = [...b2bRanking]
    .filter((r) => r.contributionPct !== null)
    .sort((a, b) => (b.contributionPct ?? 0) - (a.contributionPct ?? 0))
    .slice(0, 15)
    .map((r) => ({ name: r.company, value: (r.contributionPct ?? 0) * 100, color: "var(--series-1)" }));
  const b2bAdrData: BarDatum[] = b2bTopAdr.map((r) => ({ name: r.company, value: r.avgAdr, color: "var(--series-4)" }));

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

  const retentionData: BarDatum[] = b2bRetention.map((r) => ({
    name: `${r.fromFy} → ${r.toFy}`,
    value: r.retentionPct !== null ? r.retentionPct * 100 : 0,
    color: "var(--series-1)",
  }));

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
          <StatTile
            label="Guest Nights Served"
            value={bookingStats.guestsServed.toLocaleString("en-IN")}
            sub="Sum of guests across every night stayed — see Guest Served card below"
            delta={bookingStats.comparison.guestsServed.pctChange !== null ? { pct: bookingStats.comparison.guestsServed.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile label="ALOS" value={bookingStats.alos !== null ? `${bookingStats.alos.toFixed(1)} nights` : "—"} />
          <StatTile
            label="Revenue Per Guest-Night"
            value={bookingStats.revenuePerGuest !== null ? `₹${Math.round(bookingStats.revenuePerGuest).toLocaleString("en-IN")}` : "—"}
          />
          <StatTile
            label="Repeat Bookings"
            value={repeatBookingShare.repeatBookings.toLocaleString("en-IN")}
            sub={repeatBookingShare.sharePct !== null ? `${formatPercent(repeatBookingShare.sharePct)} of ${repeatBookingShare.totalBookings.toLocaleString("en-IN")}` : undefined}
          />
          <StatTile
            label="Cancellations"
            value={cancellationStats.cancellationPct !== null ? formatPercent(cancellationStats.cancellationPct) : "—"}
            sub={`${cancellationStats.cancelledBookings.toLocaleString("en-IN")} of ${(cancellationStats.activeBookings + cancellationStats.cancelledBookings).toLocaleString("en-IN")}`}
          />
        </div>
      </div>

      <Card title="Guest Served — Sheet Vs BigQuery" subtitle={`One-time accuracy snapshot, ${guestServedAccuracy.label} — not scoped by the period filter above`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="BigQuery (guest-nights)" value={guestServedAccuracy.totalBigQuery.toLocaleString("en-IN")} />
          <StatTile label="Sheet (manual PMS extract)" value={guestServedAccuracy.totalSheet.toLocaleString("en-IN")} />
          <StatTile
            label="Variance"
            value={guestServedAccuracy.totalVariancePct !== null ? formatPercent(guestServedAccuracy.totalVariancePct, 0) : "—"}
            delta={guestServedAccuracy.totalVariancePct !== null ? { pct: guestServedAccuracy.totalVariancePct * 100, label: "BigQuery vs Sheet", upIsGood: true } : undefined}
          />
          <StatTile
            label="Data Error Rate"
            value={guestServedAccuracy.dataErrorRatePct !== null ? formatPercent(guestServedAccuracy.dataErrorRatePct, 1) : "—"}
            sub="Residual gap after correcting the guest-count formula (below)"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800 sm:grid-cols-5">
          {guestServedAccuracy.rows.map((r) => (
            <div key={r.property}>
              <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{r.property}</p>
              <p className="text-xs text-zinc-700 dark:text-zinc-200">{r.bigQuery.toLocaleString("en-IN")} / {r.sheet.toLocaleString("en-IN")}</p>
              <p className="text-xs font-medium" style={{ color: r.variancePct !== null && Math.abs(r.variancePct) > 0.1 ? "var(--chart-delta-bad)" : "var(--chart-delta-good)" }}>
                {r.variancePct !== null ? formatPercent(r.variancePct, 0) : "—"}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
          Root cause confirmed: BigQuery previously summed each booking&apos;s peak occupancy once (MAX guests per booking), undercounting the sheet
          by ~82%. NoOfGuest itself already matches Adult+Child exactly on every row checked — the pax figure per night was never wrong. Summing
          guests across every night of stay instead (guest-nights, matching the sheet&apos;s own convention) closes nearly all of the gap; the
          Data Error Rate above is what&apos;s left after that fix.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Available Room Nights" value={roomNightsGap.availableRoomNights.toLocaleString("en-IN")} />
        <StatTile label="Unsold Room Nights" value={roomNightsGap.unsoldRoomNights.toLocaleString("en-IN")} />
        <StatTile label="Remaining Room Nights" value={roomNightsGap.remainingRoomNights.toLocaleString("en-IN")} sub="from today forward" />
        <StatTile
          label="Avg Cancellation Lead Time"
          value={cancellationLeadTime.avgLeadTimeDays !== null ? `${cancellationLeadTime.avgLeadTimeDays.toFixed(1)} days` : "—"}
          sub={`n=${cancellationLeadTime.sampledCancellations.toLocaleString("en-IN")}`}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Expats</h3>
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
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">B2B Contracts</h3>

        <div className="mt-2">
          <Card title="Corporate Account Retention">
            <SingleMetricBarChart data={retentionData} valueFormatter={(v) => `${v.toFixed(0)}%`} />
          </Card>
        </div>

        <div className="mt-3">
          <Card title={`Revenue By Company (${b2bRanking.length})`} subtitle="Green = under contract · Amber = no contract">
            <div className="mb-3 flex flex-col gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800 sm:flex-row sm:items-center">
              <DonutChart data={contractShareDonut} valueFormatter={(v) => formatIndianCurrency(v)} height={140} innerRadiusRatio={0.58} />
              <p className="text-xs text-zinc-400 dark:text-zinc-500 sm:ml-2">
                {b2bContractSummary.contractCompanyCount.toLocaleString("en-IN")} of {b2bRanking.length.toLocaleString("en-IN")} companies under contract.
                Contract revenue reflects Contract_Status = Contract rows only, not each company&apos;s total revenue.
              </p>
            </div>
            <Treemap data={b2bRevenueData} valueFormatter={(v) => formatIndianCurrency(v)} height={360} />
          </Card>
        </div>

        <div className="mt-3">
          <TabbedCard title="Company Rankings" tabs={B2B_RANK_TABS} active={b2bRankTab} onChange={setB2bRankTab}>
            {b2bRankTab === "Contribution %" ? (
              <HorizontalBarChart data={b2bContributionData} valueFormatter={(v) => `${v.toFixed(0)}%`} labelWidth={140} />
            ) : (
              <Expandable collapsedHeight={420} label={`Show all ${b2bTopAdr.length}`}>
                <HorizontalBarChart data={b2bAdrData} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} labelWidth={140} />
              </Expandable>
            )}
          </TabbedCard>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">OTA Breakdown</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total Nights" value={totalOtaNights.toLocaleString("en-IN")} />
          <StatTile label="Total Revenue" value={formatIndianCurrency(totalOtaRevenue)} />
          <StatTile label="Net Revenue" value={formatIndianCurrency(netOtaRevenue)} />
          <StatTile label="Blended Commission %" value={`${blendedCommissionPct.toFixed(1)}%`} />
        </div>

        <div className="mt-3">
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
      </div>
    </div>
  );
}
