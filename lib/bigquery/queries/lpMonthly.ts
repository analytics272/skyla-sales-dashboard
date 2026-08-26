// LP Integration PRD Addendum (Skyla_Sales_Dashboard_PRD_LP_Addendum.md,
// 2026-08-26) — LP (Lotus Pond) is permanently retired, has zero rows in
// sales_booking (no PMS feed), and its real historical data lives at
// **monthly grain** in sales_booking_lp_monthly /
// sales_booking_lp_monthly_roomtype instead (backfilled from the "Skyla
// Revenue Sheets Master" sheet, validated — see the addendum §3). No
// night-level revenue is fabricated for LP anywhere; callers merge these
// monthly sums directly into whatever period aggregate they're building.
//
// Per the addendum §5, LP participates in: Revenue & Occupancy Overview,
// Trends by FY/Month, Brand & Business Category, and the B2B/C/OTA split
// (aggregate only — LP has no per-OTA-site breakdown). It's deliberately NOT
// merged into Booking Details' nightly-only KPIs (repeat bookings,
// cancellations, expats, room-format mix) — those naturally return 0/silent
// for LP already since sales_booking has no LP rows, and forcing LP's
// monthly data into a nightly-shaped calculation would misrepresent it.
import { runQuery, table } from "../client";
import { fiscalMonthNumber, calendarMonthFromFiscal } from "@/lib/reference/financialYear";
import { BookingCategory } from "@/lib/reference/bookingSourceMap";
import { safeDivide } from "@/lib/format/currency";

export const LP_PROPERTY = "LP";

interface LpMonthlyRow {
  FinancialYear: string;
  MonthNumber: number; // fiscal, Apr=1...Mar=12 — same convention as leadership_targets
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

function whereForScope(fys: string[], months: number[]): { clause: string; params: Record<string, unknown> } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  if (fys.length > 0) {
    conditions.push("FinancialYear IN UNNEST(@fys)");
    params.fys = fys;
  }
  if (months.length > 0) {
    params.fiscalMonths = months.map(fiscalMonthNumber);
    conditions.push("MonthNumber IN UNNEST(@fiscalMonths)");
  }
  return { clause: conditions.length > 0 ? conditions.join(" AND ") : "TRUE", params };
}

/** Raw monthly LP rows for the given scope. Empty result just means LP has no data in that period (e.g. a FY it didn't operate in) — not an error. */
async function getLpMonthlyRows(fys: string[], months: number[]): Promise<LpMonthlyRow[]> {
  const { clause, params } = whereForScope(fys, months);
  return runQuery<LpMonthlyRow>(`
    SELECT FinancialYear, MonthNumber, RoomRevenue, FnBRevenue, SoldRoomNights, BookingsCount, GuestServed,
      B2BRevenue, B2BNights, B2CRevenue, B2CNights, OTARevenue, OTANights
    FROM ${table("sales_booking_lp_monthly")}
    WHERE ${clause}
  `, params);
}

export interface LpOverviewTotals {
  roomRevenue: number;
  extrasRevenue: number; // FnBRevenue
  soldRoomNights: number;
  bookingsCount: number;
  guestsServed: number;
  bySource: { category: BookingCategory; nights: number; revenue: number }[];
}

/** Summed across the whole scope — for Revenue Details' overview KPIs and Booking Details' booking-count/guest-count stats. */
export async function getLpOverviewTotals(fys: string[], months: number[]): Promise<LpOverviewTotals> {
  const rows = await getLpMonthlyRows(fys, months);
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
export async function getLpRoomTypeStats(fys: string[], months: number[]): Promise<LpRoomTypeStat[]> {
  const { clause, params } = whereForScope(fys, months);
  const [roomTypeRows, monthlyRows] = await Promise.all([
    runQuery<{ FinancialYear: string; MonthNumber: number; RoomType: string; TotalRevenue: number | null }>(`
      SELECT FinancialYear, MonthNumber, RoomType, TotalRevenue
      FROM ${table("sales_booking_lp_monthly_roomtype")}
      WHERE ${clause}
    `, params),
    getLpMonthlyRows(fys, months),
  ]);

  const soldByMonth = new Map<string, number>();
  for (const r of monthlyRows) soldByMonth.set(`${r.FinancialYear}|${r.MonthNumber}`, r.SoldRoomNights ?? 0);

  const revenueByMonth = new Map<string, number>();
  for (const r of roomTypeRows) {
    const key = `${r.FinancialYear}|${r.MonthNumber}`;
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + (r.TotalRevenue ?? 0));
  }

  const byType = new Map<string, { nights: number; revenue: number }>();
  for (const r of roomTypeRows) {
    const key = `${r.FinancialYear}|${r.MonthNumber}`;
    const monthRevenue = revenueByMonth.get(key) ?? 0;
    const monthSold = soldByMonth.get(key) ?? 0;
    const share = monthRevenue > 0 ? (r.TotalRevenue ?? 0) / monthRevenue : 0;
    const acc = byType.get(r.RoomType) ?? { nights: 0, revenue: 0 };
    acc.nights += monthSold * share;
    acc.revenue += r.TotalRevenue ?? 0;
    byType.set(r.RoomType, acc);
  }

  return [...byType.entries()].map(([roomType, v]) => ({ roomType, nights: Math.round(v.nights), revenue: v.revenue }));
}

export interface LpRoomTypeByFy {
  roomType: string;
  fy: string;
  revenue: number;
}

/** Revenue by room type, by FY — `TotalRevenue` reconciles exactly with `sales_booking_lp_monthly.RoomRevenue` when summed across room types (verified), so this is a direct sum, no allocation needed. */
export async function getLpRoomTypeByFy(fys: string[], months: number[]): Promise<LpRoomTypeByFy[]> {
  const { clause, params } = whereForScope(fys, months);
  const rows = await runQuery<{ FinancialYear: string; RoomType: string; TotalRevenue: number | null }>(`
    SELECT FinancialYear, RoomType, SUM(TotalRevenue) AS TotalRevenue
    FROM ${table("sales_booking_lp_monthly_roomtype")}
    WHERE ${clause}
    GROUP BY FinancialYear, RoomType
  `, params);
  return rows.map((r) => ({ roomType: r.RoomType, fy: r.FinancialYear, revenue: r.TotalRevenue ?? 0 }));
}

export interface LpMonthlyPoint {
  fy: string;
  month: number; // calendar month, matching MonthlyTrendPoint's convention
  soldRoomNights: number;
  revenue: number;
}

/** One point per (fy, calendar month) LP has data for — for Trends' getMonthlyTrends merge. */
export async function getLpMonthlyPoints(fys: string[]): Promise<LpMonthlyPoint[]> {
  const rows = await getLpMonthlyRows(fys, []);
  return rows.map((r) => ({
    fy: r.FinancialYear,
    month: calendarMonthFromFiscal(r.MonthNumber),
    soldRoomNights: r.SoldRoomNights ?? 0,
    revenue: r.RoomRevenue ?? 0,
  }));
}

export interface LpCategoryByFy {
  fy: string;
  category: BookingCategory;
  nights: number;
  revenue: number;
}

/** One row per (fy, category) — for Trends' getBusinessCategoryAdrTrend and Brand's getCategoryRevenueByFy, both of which group by FY across all months (Month filter doesn't apply to either — matches their existing "always all months" convention). */
export async function getLpCategoryByFy(fys: string[]): Promise<LpCategoryByFy[]> {
  const rows = await getLpMonthlyRows(fys, []);
  const byFy = new Map<string, { b2bR: number; b2bN: number; b2cR: number; b2cN: number; otaR: number; otaN: number }>();
  for (const r of rows) {
    const acc = byFy.get(r.FinancialYear) ?? { b2bR: 0, b2bN: 0, b2cR: 0, b2cN: 0, otaR: 0, otaN: 0 };
    acc.b2bR += r.B2BRevenue ?? 0;
    acc.b2bN += r.B2BNights ?? 0;
    acc.b2cR += r.B2CRevenue ?? 0;
    acc.b2cN += r.B2CNights ?? 0;
    acc.otaR += r.OTARevenue ?? 0;
    acc.otaN += r.OTANights ?? 0;
    byFy.set(r.FinancialYear, acc);
  }
  const out: LpCategoryByFy[] = [];
  for (const [fy, acc] of byFy) {
    out.push({ fy, category: "B2B", nights: acc.b2bN, revenue: acc.b2bR });
    out.push({ fy, category: "B2C", nights: acc.b2cN, revenue: acc.b2cR });
    out.push({ fy, category: "OTA", nights: acc.otaN, revenue: acc.otaR });
  }
  return out;
}

/** Total sold room-nights for LP across the scope — for Brand's getBrandOccupancy (LP rolls into Aptly alongside BH4). */
export async function getLpSoldRoomNights(fys: string[], months: number[]): Promise<number> {
  const rows = await getLpMonthlyRows(fys, months);
  return rows.reduce((s, r) => s + (r.SoldRoomNights ?? 0), 0);
}

export interface LpAdr {
  revenue: number;
  nights: number;
  adr: number | null;
}

/** For getAdrByProperty — LP's own ADR row for the scope. */
export async function getLpAdr(fys: string[], months: number[]): Promise<LpAdr> {
  const totals = await getLpOverviewTotals(fys, months);
  return { revenue: totals.roomRevenue, nights: totals.soldRoomNights, adr: safeDivide(totals.roomRevenue, totals.soldRoomNights) };
}
