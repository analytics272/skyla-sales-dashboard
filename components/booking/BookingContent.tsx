"use client";

import {
  BookingStats, RoomNightsGap, RepeatBookingShare, RoomFormatStats, RoomFormatByFy,
  ExpatStats, CancellationStats, CancellationLeadTime,
} from "@/lib/bigquery/queries/guestDetail";
import type { B2bContractRanking, B2bTopAdrContract, RetentionPoint, B2bContractSummary } from "@/lib/bigquery/queries/b2bContracts";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import Table, { TableColumn } from "@/components/ui/Table";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import FyComparisonStrip from "@/components/charts/FyComparisonStrip";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { ROOM_TYPE_COLOR, ROOM_TYPE_ORDER, FY_COLOR } from "@/lib/design/tokens";

export default function BookingContent({
  bookingStats,
  roomNightsGap,
  repeatBookingShare,
  roomFormatStats,
  roomFormatByFy,
  expatStats,
  cancellationStats,
  cancellationLeadTime,
  b2bRanking,
  b2bContractSummary,
  b2bTopAdr,
  b2bRetention,
}: {
  bookingStats: BookingStats;
  roomNightsGap: RoomNightsGap;
  repeatBookingShare: RepeatBookingShare;
  roomFormatStats: RoomFormatStats[];
  roomFormatByFy: RoomFormatByFy[];
  expatStats: ExpatStats;
  cancellationStats: CancellationStats;
  cancellationLeadTime: CancellationLeadTime;
  b2bRanking: B2bContractRanking[];
  b2bContractSummary: B2bContractSummary;
  b2bTopAdr: B2bTopAdrContract[];
  b2bRetention: RetentionPoint[];
}) {
  const roomTypeLabel = (rt: string | null) => rt ?? "Unmapped";
  const roomTypesPresent = [
    ...ROOM_TYPE_ORDER.filter((rt) => roomFormatStats.some((r) => r.roomType === rt)),
    ...(roomFormatStats.some((r) => r.roomType === null) ? ["Unmapped" as const] : []),
  ];

  const adrByFormat: BarDatum[] = roomTypesPresent.map((rt) => {
    const row = roomFormatStats.find((r) => roomTypeLabel(r.roomType) === rt);
    return { name: rt, value: row?.adr ?? 0, color: ROOM_TYPE_COLOR[rt] ?? "var(--chart-baseline)" };
  });

  const nightsShareByFormat: BarDatum[] = roomTypesPresent.map((rt) => {
    const row = roomFormatStats.find((r) => roomTypeLabel(r.roomType) === rt);
    return { name: rt, value: (row?.nightsSharePct ?? 0) * 100, color: ROOM_TYPE_COLOR[rt] ?? "var(--chart-baseline)" };
  });

  // Room type on the x-axis, one bar per FY within each cluster — reads as
  // "how did this room type do year over year", and caps clusters at however
  // many FYs are selected (usually 1-3) instead of a 7-room-type cluster
  // repeated per FY. Replaces an earlier stacked-bar version per user
  // feedback (2026-08-24): stacking makes cross-FY comparison harder, not
  // easier, since only the top segment of each stack has a readable baseline.
  const fyOrder = [...new Set(roomFormatByFy.map((r) => r.fy))].sort();
  const formatsInFyData = ROOM_TYPE_ORDER.filter((rt) => roomFormatByFy.some((r) => r.roomType === rt));
  const revenueByFormatByFy = formatsInFyData.map((rt) => {
    const row: Record<string, unknown> = { roomType: rt };
    for (const fy of fyOrder) {
      row[fy] = roomFormatByFy.find((r) => r.fy === fy && r.roomType === rt)?.revenue ?? 0;
    }
    return row;
  });
  const roomFormatFyTotals = fyOrder.map((fy) => ({
    fy,
    value: roomFormatByFy.filter((r) => r.fy === fy).reduce((s, r) => s + r.revenue, 0),
  }));

  const rankingColumns: TableColumn<B2bContractRanking>[] = [
    { key: "company", header: "Company", render: (r) => r.company },
    { key: "status", header: "Contract status", render: (r) => r.contractStatus ?? "—" },
    { key: "nights", header: "Nights", align: "right", render: (r) => r.nights.toLocaleString("en-IN") },
    { key: "revenue", header: "Room revenue", align: "right", render: (r) => formatIndianCurrency(r.roomRevenue) },
    { key: "adr", header: "ADR", align: "right", render: (r) => (r.adr !== null ? `₹${Math.round(r.adr).toLocaleString("en-IN")}` : "—") },
    { key: "contribution", header: "Contribution %", align: "right", render: (r) => (r.contributionPct !== null ? formatPercent(r.contributionPct, 0) : "—") },
  ];

  const adrColumns: TableColumn<B2bTopAdrContract>[] = [
    { key: "company", header: "Company", render: (r) => r.company },
    { key: "adr", header: "Avg ADR", align: "right", render: (r) => `₹${Math.round(r.avgAdr).toLocaleString("en-IN")}` },
    { key: "nights", header: "Nights", align: "right", render: (r) => r.nights.toLocaleString("en-IN") },
  ];

  const retentionData: BarDatum[] = b2bRetention.map((r) => ({
    name: `${r.fromFy} → ${r.toFy}`,
    value: r.retentionPct !== null ? r.retentionPct * 100 : 0,
    color: "var(--series-1)",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Booking Details</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Total bookings" value={bookingStats.totalBookings.toLocaleString("en-IN")} />
          <StatTile label="Guests served" value={bookingStats.guestsServed.toLocaleString("en-IN")} />
          <StatTile label="ALOS" value={bookingStats.alos !== null ? `${bookingStats.alos.toFixed(1)} nights` : "—"} />
          <StatTile
            label="Revenue per guest"
            value={bookingStats.revenuePerGuest !== null ? `₹${Math.round(bookingStats.revenuePerGuest).toLocaleString("en-IN")}` : "—"}
          />
          <StatTile
            label="Repeat bookings"
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Unsold room nights" value={roomNightsGap.unsoldRoomNights.toLocaleString("en-IN")} />
        <StatTile label="Remaining room nights" value={roomNightsGap.remainingRoomNights.toLocaleString("en-IN")} sub="from today forward" />
        <StatTile
          label="Avg cancellation lead time"
          value={cancellationLeadTime.avgLeadTimeDays !== null ? `${cancellationLeadTime.avgLeadTimeDays.toFixed(1)} days` : "—"}
          sub={`n=${cancellationLeadTime.sampledCancellations.toLocaleString("en-IN")}`}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Expats</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Expat bookings" value={expatStats.bookings.toLocaleString("en-IN")} />
          <StatTile label="Expat revenue" value={formatIndianCurrency(expatStats.revenue)} />
          <StatTile label="Expat nights" value={expatStats.nights.toLocaleString("en-IN")} />
          <StatTile label="Expat ALOS" value={expatStats.alos !== null ? `${expatStats.alos.toFixed(1)} nights` : "—"} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ADR by room format">
          <SingleMetricBarChart data={adrByFormat} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
        </Card>
        <Card title="Nights share by room format">
          <SingleMetricBarChart data={nightsShareByFormat} valueFormatter={(v) => `${v.toFixed(0)}%`} />
        </Card>
      </div>

      <Card title="Revenue by room format, by FY">
        <FyComparisonStrip points={roomFormatFyTotals} valueFormatter={(v) => formatIndianCurrency(v)} />
        <GroupedBarChart
          data={revenueByFormatByFy}
          xKey="roomType"
          series={fyOrder.map((fy) => ({ key: fy, color: FY_COLOR[fy] ?? "var(--chart-baseline)" }))}
          valueFormatter={(v) => formatIndianCurrency(v)}
          height={320}
        />
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">B2B Contracts</h3>

        <div className="mt-2">
          <Card title="Corporate account retention">
            <SingleMetricBarChart data={retentionData} valueFormatter={(v) => `${v.toFixed(0)}%`} />
          </Card>
        </div>

        <div className="mt-3">
          <Card title={`Contract status & ranking (${b2bRanking.length} companies)`}>
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-2">
              <StatTile label="Contract revenue achieved" value={formatIndianCurrency(b2bContractSummary.totalContractRevenue)} sub="Contract_Status = Contract only, not total company revenue" />
              <StatTile label="Companies under contract" value={b2bContractSummary.contractCompanyCount.toLocaleString("en-IN")} />
            </div>
            <Table columns={rankingColumns} rows={b2bRanking.slice(0, 20)} rowKey={(r) => r.company} />
          </Card>
        </div>

        <div className="mt-3">
          <Card title="Top ADR contracts (min. 1 night)">
            <Table columns={adrColumns} rows={b2bTopAdr.slice(0, 15)} rowKey={(r) => r.company} />
          </Card>
        </div>
      </div>
    </div>
  );
}
