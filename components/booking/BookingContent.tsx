"use client";

import {
  BookingStats, RoomNightsGap, RepeatBookingShare, RoomFormatStats,
  ExpatStats, CancellationStats, CancellationLeadTime, CategoryMix,
} from "@/lib/bigquery/queries/guestDetail";
import type { B2bContractRanking, B2bTopAdrContract, RetentionPoint, B2bContractSummary } from "@/lib/bigquery/queries/b2bContracts";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import Table, { TableColumn } from "@/components/ui/Table";
import Expandable from "@/components/ui/Expandable";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import DonutChart from "@/components/charts/DonutChart";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { ROOM_TYPE_COLOR, ROOM_TYPE_ORDER, CATEGORY_COLOR, CATEGORY_ORDER } from "@/lib/design/tokens";

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

  const rankingColumns: TableColumn<B2bContractRanking>[] = [
    { key: "company", header: "Company", render: (r) => r.company },
    { key: "status", header: "Contract Status", render: (r) => r.contractStatus ?? "—" },
    { key: "nights", header: "Nights", align: "right", render: (r) => r.nights.toLocaleString("en-IN") },
    { key: "revenue", header: "Room Revenue", align: "right", render: (r) => formatIndianCurrency(r.roomRevenue) },
    { key: "adr", header: "ADR", align: "right", render: (r) => (r.adr !== null ? `₹${Math.round(r.adr).toLocaleString("en-IN")}` : "—") },
    { key: "contribution", header: "Contribution %", align: "right", render: (r) => (r.contributionPct !== null ? formatPercent(r.contributionPct, 0) : "—") },
  ];

  const adrColumns: TableColumn<B2bTopAdrContract>[] = [
    { key: "company", header: "Company", render: (r) => r.company },
    { key: "adr", header: "Avg ADR", align: "right", render: (r) => `₹${Math.round(r.avgAdr).toLocaleString("en-IN")}` },
    { key: "nights", header: "Nights", align: "right", render: (r) => r.nights.toLocaleString("en-IN") },
  ];

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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Booking Details</h2>
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
          <Card title={`Contract Status & Ranking (${b2bRanking.length} Companies)`}>
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-2">
              <StatTile label="Contract Revenue Achieved" value={formatIndianCurrency(b2bContractSummary.totalContractRevenue)} sub="Contract_Status = Contract only, not total company revenue" />
              <StatTile label="Companies Under Contract" value={b2bContractSummary.contractCompanyCount.toLocaleString("en-IN")} />
            </div>
            <Expandable collapsedHeight={420} label={`Show all ${b2bRanking.length} companies`}>
              <Table columns={rankingColumns} rows={b2bRanking} rowKey={(r) => r.company} />
            </Expandable>
          </Card>
        </div>

        <div className="mt-3">
          <Card title="Top ADR Contracts (Min. 1 Night)">
            <Expandable collapsedHeight={420} label={`Show all ${b2bTopAdr.length}`}>
              <Table columns={adrColumns} rows={b2bTopAdr} rowKey={(r) => r.company} />
            </Expandable>
          </Card>
        </div>
      </div>
    </div>
  );
}
