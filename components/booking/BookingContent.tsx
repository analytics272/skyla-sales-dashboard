"use client";

import {
  BookingStats, RoomNightsGap, RepeatBookingShare, RoomFormatStats,
  ExpatStats, CancellationStats, CancellationLeadTime, CategoryMix, GuestServedAccuracyCheck,
} from "@/lib/bigquery/queries/guestDetail";
import type { B2bContractRanking, B2bTopAdrContract, RetentionPoint, B2bContractSummary } from "@/lib/bigquery/queries/b2bContracts";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import Expandable from "@/components/ui/Expandable";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import DonutChart from "@/components/charts/DonutChart";
import Treemap from "@/components/charts/Treemap";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { ROOM_TYPE_COLOR, ROOM_TYPE_ORDER, CATEGORY_COLOR, CATEGORY_ORDER } from "@/lib/design/tokens";

const CONTRACT_STATUS_COLOR: Record<string, string> = {
  Contract: "var(--chart-delta-good)",
  "No Contract": "#d97706",
};
const CONTRACT_STATUS_FALLBACK = "var(--chart-baseline)";

export default function BookingContent({
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
}) {
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

  const categoriesPresent = CATEGORY_ORDER.filter((c) => categoryMix.some((m) => m.category === c));
  const revenueDonut = categoriesPresent.map((c) => {
    const m = categoryMix.find((x) => x.category === c);
    return { name: c, value: m?.revenue ?? 0, color: CATEGORY_COLOR[c] };
  });

  const retentionData: BarDatum[] = b2bRetention.map((r) => ({
    name: `${r.fromFy} → ${r.toFy}`,
    value: r.retentionPct !== null ? r.retentionPct * 100 : 0,
    color: "var(--series-1)",
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="Total Bookings"
            value={bookingStats.totalBookings.toLocaleString("en-IN")}
            delta={bookingStats.comparison.totalBookings.pctChange !== null ? { pct: bookingStats.comparison.totalBookings.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile
            label="Guests Served"
            value={bookingStats.guestsServed.toLocaleString("en-IN")}
            delta={bookingStats.comparison.guestsServed.pctChange !== null ? { pct: bookingStats.comparison.guestsServed.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile label="ALOS" value={bookingStats.alos !== null ? `${bookingStats.alos.toFixed(1)} nights` : "—"} />
          <StatTile
            label="Revenue Per Guest"
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="BigQuery (API sync)" value={guestServedAccuracy.totalBigQuery.toLocaleString("en-IN")} />
          <StatTile label="Sheet (manual PMS extract)" value={guestServedAccuracy.totalSheet.toLocaleString("en-IN")} />
          <StatTile
            label="Variance"
            value={guestServedAccuracy.totalVariancePct !== null ? formatPercent(guestServedAccuracy.totalVariancePct, 0) : "—"}
            delta={guestServedAccuracy.totalVariancePct !== null ? { pct: guestServedAccuracy.totalVariancePct * 100, label: "BigQuery vs Sheet", upIsGood: true } : undefined}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800 sm:grid-cols-5">
          {guestServedAccuracy.rows.map((r) => (
            <div key={r.property}>
              <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{r.property}</p>
              <p className="text-xs text-zinc-700 dark:text-zinc-200">{r.bigQuery.toLocaleString("en-IN")} / {r.sheet.toLocaleString("en-IN")}</p>
              <p className={r.variancePct !== null && r.variancePct < -0.2 ? "text-xs font-medium" : "text-xs font-medium"} style={{ color: r.variancePct !== null && r.variancePct < -0.2 ? "var(--chart-delta-bad)" : "var(--chart-delta-good)" }}>
                {r.variancePct !== null ? formatPercent(r.variancePct, 0) : "—"}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
          BigQuery consistently runs lower than the sheet across every property — that pattern looks more like a different Guest Served definition
          between the two sources (e.g. total guest-nights vs. peak per-booking occupancy) than a specific number of bookings missing from the sync.
          Shown as measured; root cause not confirmed.
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

      <Card title="Night/Revenue Mix By Category">
        <DonutChart data={revenueDonut} valueFormatter={(v) => formatIndianCurrency(v)} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Revenue By Room Format">
          <HorizontalBarChart data={revenueByFormat} valueFormatter={(v) => formatIndianCurrency(v)} />
        </Card>
        <Card title="ADR By Room Format">
          <HorizontalBarChart data={adrByFormat} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
        </Card>
      </div>

      <Card title="Nights Share By Room Format">
        <DonutChart data={nightsShareDonut} valueFormatter={(v) => v.toLocaleString("en-IN")} />
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">B2B Contracts</h3>

        <div className="mt-2">
          <Card title="Corporate Account Retention">
            <SingleMetricBarChart data={retentionData} valueFormatter={(v) => `${v.toFixed(0)}%`} />
          </Card>
        </div>

        <div className="mt-3">
          <Card title={`Revenue By Company (${b2bRanking.length})`} subtitle="Green = under contract · Amber = no contract">
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-2">
              <StatTile label="Contract Revenue Achieved" value={formatIndianCurrency(b2bContractSummary.totalContractRevenue)} sub="Contract_Status = Contract only, not total company revenue" />
              <StatTile label="Companies Under Contract" value={b2bContractSummary.contractCompanyCount.toLocaleString("en-IN")} />
            </div>
            <Treemap data={b2bRevenueData} valueFormatter={(v) => formatIndianCurrency(v)} height={360} />
          </Card>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <Card title="Top Contribution % By Company" subtitle="Share of Skyla's total revenue, top 15">
            <HorizontalBarChart data={b2bContributionData} valueFormatter={(v) => `${v.toFixed(0)}%`} labelWidth={140} />
          </Card>
          <Card title="Top ADR Contracts" subtitle="Minimum 1 night">
            <Expandable collapsedHeight={420} label={`Show all ${b2bTopAdr.length}`}>
              <HorizontalBarChart data={b2bAdrData} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} labelWidth={140} />
            </Expandable>
          </Card>
        </div>
      </div>
    </div>
  );
}
