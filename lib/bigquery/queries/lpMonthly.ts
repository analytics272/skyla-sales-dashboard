// LP Integration PRD Addendum (Skyla_Sales_Dashboard_PRD_LP_Addendum.md,
// 2026-08-26) — LP (Lotus Pond) is permanently retired, has zero rows in
// sales_booking (no PMS feed), and its real historical data lives at
// **monthly grain** in sales_booking_lp_monthly /
// sales_booking_lp_monthly_roomtype instead (backfilled from the "Skyla
// Revenue Sheets Master" sheet, validated — see the addendum §3). No
// night-level revenue is fabricated for LP anywhere; callers merge these
// monthly sums directly into whatever period aggregate they're building.
//
// 2026-09-02: scoping switched from FY/fiscal-month-number lists to a plain
// DateRange (MonthStartDate BETWEEN start AND end), matching the rest of the
// app's move to the Today/This FY/Last Year period-tabs model. A month is
// included whenever its MonthStartDate falls in the range — no LP month is
// ever split partway (its rows are monthly, not daily), which matches how
// "This FY (to date)" already treats every other property (it doesn't
// prorate a part-elapsed month either).
//
// Per the addendum §5, LP participates in: Revenue & Occupancy Overview,
// Trends, Brand & Business Category, and the B2B/C/OTA split (aggregate only
// — LP has no per-OTA-site breakdown). It's deliberately NOT merged into
// Booking Details' nightly-only KPIs (repeat bookings, cancellations,
// expats) — those naturally return 0/silent for LP already since
// sales_booking has no LP rows, and forcing LP's monthly data into a
// nightly-shaped calculation would misrepresent it.
import { runQuery, table } from "../client";
import { DateRange } from "@/lib/reference/financialYear";
import { BookingCategory } from "@/lib/reference/bookingSourceMap";
import { safeDivide } from "@/lib/format/currency";

export const LP_PROPERTY = "LP";

interface LpMonthlyRow {
  MonthStartDate: string;
  RoomRevenue: number | null;
  FnBRevenue: number | null;
  SoldRoomNights: number | null;
  BookingsCount: number | null;
  GuestServed: number | null;
  B2BRevenue: number | null;
  B2BNights: number | null;
  B2CRevenue: number | null;
  B2CNights: number | null;
  OTARevenue: number | null;
  OTANights: number | null;
}

/** Raw monthly LP rows for the given range. Empty result just means LP has no data in that period (e.g. before Apr 2024, or a Today-tab single day) — not an error. */
async function getLpMonthlyRows(range: DateRange): Promise<LpMonthlyRow[]> {
  return runQuery<LpMonthlyRow>(`
    SELECT CAST(MonthStartDate AS STRING) AS MonthStartDate, RoomRevenue, FnBRevenue, SoldRoomNights, BookingsCount, GuestServed,
      B2BRevenue, B2BNights, B2CRevenue, B2CNights, OTARevenue, OTANights
    FROM ${table("sales_booking_lp_monthly")}
    WHERE MonthStartDate BETWEEN @start AND @end
  `, { start: range.start, end: range.end });
}

export interface LpOverviewTotals {
  roomRevenue: number;
  extrasRevenue: number; // FnBRevenue
  soldRoomNights: number;
  bookingsCount: number;
  guestsServed: number;
  bySource: { category: BookingCategory; nights: number; revenue: number }[];
}

/** Summed across the whole range — for Revenue Details' overview KPIs and Booking Details' booking-count/guest-count stats. */
export async function getLpOverviewTotals(range: DateRange): Promise<LpOverviewTotals> {
  const rows = await getLpMonthlyRows(range);
  const sum = (f: (r: LpMonthlyRow) => number | null) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  return {
    roomRevenue: sum((r) => r.RoomRevenue),
    extrasRevenue: sum((r) => r.FnBRevenue),
    soldRoomNights: sum((r) => r.SoldRoomNights),
    bookingsCount: sum((r) => r.BookingsCount),
    guestsServed: sum((r) => r.GuestServed),
    bySource: [
      { category: "B2B", nights: sum((r) => r.B2BNights), revenue: sum((r) => r.B2BRevenue) },
      { category: "B2C", nights: sum((r) => r.B2CNights), revenue: sum((r) => r.B2CRevenue) },
      { category: "OTA", nights: sum((r) => r.OTANights), revenue: sum((r) => r.OTARevenue) },
    ],
  };
}

export interface LpRoomTypeStat {
  roomType: string;
  nights: number;
  revenue: number;
}

/**
 * Room-type breakdown for Booking Details' ADR/Nights-share-by-Room-Format
 * charts. `sales_booking_lp_monthly_roomtype`'s own `Nights` column does NOT
 * reconcile with `sales_booking_lp_monthly.SoldRoomNights` — confirmed
 * directly against BigQuery: off by 19%-76% in every one of LP's 24 months,
 * with no consistent ratio (ruled out a guest-nights-vs-room-nights
 * explanation). `TotalRevenue` and `BookingsCount`, by contrast, reconcile
 * exactly with the monthly table in every month. Rather than surface the
 * unreconciled Nights figure (which could misrepresent occupancy/ADR), nights
 * are allocated to each room type by its share of that month's room-type
 * revenue, anchored to the already-validated `SoldRoomNights` total. This is
 * mathematically exact for LP's actual data today (a single room type, 100%
 * revenue share, every month) and a defensible revenue-weighted estimate
 * should a future backfill ever add a second room type.
 */
export async function getLpRoomTypeStats(range: DateRange): Promise<LpRoomTypeStat[]> {
  const [roomTypeRows, monthlyRows] = await Promise.all([
    runQuery<{ MonthStartDate: string; RoomType: string; TotalRevenue: number | null }>(`
      SELECT CAST(MonthStartDate AS STRING) AS MonthStartDate, RoomType, TotalRevenue
      FROM ${table("sales_booking_lp_monthly_roomtype")}
      WHERE MonthStartDate BETWEEN @start AND @end
    `, { start: range.start, end: range.end }),
    getLpMonthlyRows(range),
  ]);

  const soldByMonth = new Map<string, number>();
  for (const r of monthlyRows) soldByMonth.set(r.MonthStartDate, r.SoldRoomNights ?? 0);

  const revenueByMonth = new Map<string, number>();
  for (const r of roomTypeRows) {
    revenueByMonth.set(r.MonthStartDate, (revenueByMonth.get(r.MonthStartDate) ?? 0) + (r.TotalRevenue ?? 0));
  }

  const byType = new Map<string, { nights: number; revenue: number }>();
  for (const r of roomTypeRows) {
    const monthRevenue = revenueByMonth.get(r.MonthStartDate) ?? 0;
    const monthSold = soldByMonth.get(r.MonthStartDate) ?? 0;
    const share = monthRevenue > 0 ? (r.TotalRevenue ?? 0) / monthRevenue : 0;
    const acc = byType.get(r.RoomType) ?? { nights: 0, revenue: 0 };
    acc.nights += monthSold * share;
    acc.revenue += r.TotalRevenue ?? 0;
    byType.set(r.RoomType, acc);
  }

  return [...byType.entries()].map(([roomType, v]) => ({ roomType, nights: Math.round(v.nights), revenue: v.revenue }));
}

export interface LpMonthlyPoint {
  monthStartDate: string; // ISO date, 1st of month
  soldRoomNights: number;
  revenue: number;
}

/** One point per month LP has data for within the range — for Trends' getMonthlyTrends merge. */
export async function getLpMonthlyPoints(range: DateRange): Promise<LpMonthlyPoint[]> {
  const rows = await getLpMonthlyRows(range);
  return rows.map((r) => ({
    monthStartDate: r.MonthStartDate,
    soldRoomNights: r.SoldRoomNights ?? 0,
    revenue: r.RoomRevenue ?? 0,
  }));
}

export interface LpCategoryMix {
  category: BookingCategory;
  nights: number;
  revenue: number;
}

/** B2B/B2C/OTA totals across the whole range — for Trends' category chart and Brand's category-revenue chart. */
export async function getLpCategoryMix(range: DateRange): Promise<LpCategoryMix[]> {
  const totals = await getLpOverviewTotals(range);
  return totals.bySource;
}

/** Total sold room-nights for LP across the range — for Brand's getBrandOccupancy (LP rolls into Aptly alongside BH4). */
export async function getLpSoldRoomNights(range: DateRange): Promise<number> {
  const rows = await getLpMonthlyRows(range);
  return rows.reduce((s, r) => s + (r.SoldRoomNights ?? 0), 0);
}

export interface LpAdr {
  revenue: number;
  nights: number;
  adr: number | null;
}

/** For getAdrByProperty — LP's own ADR row for the range. */
export async function getLpAdr(range: DateRange): Promise<LpAdr> {
  const totals = await getLpOverviewTotals(range);
  return { revenue: totals.roomRevenue, nights: totals.soldRoomNights, adr: safeDivide(totals.roomRevenue, totals.soldRoomNights) };
}
