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
    SELECT FinancialYear, MonthNumber, RoomRevenue, FnBRevenue, SoldRoomNights, BookingsCount,
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
  bySource: { category: BookingCategory; nights: number; revenue: number }[];
}

/** Summed across the whole scope — for Revenue Details' overview KPIs. */
export async function getLpOverviewTotals(fys: string[], months: number[]): Promise<LpOverviewTotals> {
  const rows = await getLpMonthlyRows(fys, months);
  const sum = (f: (r: LpMonthlyRow) => number | null) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  return {
    roomRevenue: sum((r) => r.RoomRevenue),
    extrasRevenue: sum((r) => r.FnBRevenue),
    soldRoomNights: sum((r) => r.SoldRoomNights),
    bookingsCount: sum((r) => r.BookingsCount),
    bySource: [
      { category: "B2B", nights: sum((r) => r.B2BNights), revenue: sum((r) => r.B2BRevenue) },
      { category: "B2C", nights: sum((r) => r.B2CNights), revenue: sum((r) => r.B2CRevenue) },
      { category: "OTA", nights: sum((r) => r.OTANights), revenue: sum((r) => r.OTARevenue) },
    ],
  };
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
