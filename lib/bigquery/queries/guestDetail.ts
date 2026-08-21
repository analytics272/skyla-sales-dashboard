// PRD §6.2 — Guest & Revenue Detail.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause, ResolvedFilter } from "./filters";
import { getAvailableRoomNights, rangesForFysAndMonths } from "./propertyWindows";
import { bookingCategorySqlExpr, BookingCategory } from "@/lib/reference/bookingSourceMap";
import { fyLabelSqlExpr } from "@/lib/reference/financialYear";
import { roomTypeMappingSqlUnnest, roomTypeJoinCondition } from "@/lib/reference/roomTypeMapping";
import { safeDivide } from "@/lib/format/currency";

// --- Total Bookings / Guests Served / ALOS ---

export interface BookingStats {
  totalBookings: number;
  guestsServed: number;
  alos: number | null;
  revenuePerGuest: number | null;
}

interface BookingStatsRow {
  total_bookings: number;
  guests_served: number | null;
  sold_room_nights: number;
  room_revenue: number | null;
}

export async function getBookingStats(filter: KpiFilter): Promise<BookingStats> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");

  const rows = await runQuery<BookingStatsRow>(`
    WITH scoped AS (
      SELECT Property, ReservationNo, NoOfGuest, DailyRevenue
      FROM ${table("sales_booking")}
      WHERE ${where}
    ),
    per_booking AS (
      -- ReservationNo IS NOT NULL matches the PRD's own booking-count formula
      -- (COUNT(DISTINCT CONCAT(Property, ReservationNo))), which drops null-keyed
      -- rows since CONCAT(..., NULL) is NULL and excluded from COUNT DISTINCT.
      -- Grouping by a NULL ReservationNo would otherwise collapse many unrelated
      -- rows into one phantom booking per property (confirmed against real data).
      SELECT Property, ReservationNo, MAX(NoOfGuest) AS guests
      FROM scoped
      WHERE ReservationNo IS NOT NULL
      GROUP BY Property, ReservationNo
    )
    SELECT
      (SELECT COUNT(*) FROM per_booking) AS total_bookings,
      (SELECT SUM(guests) FROM per_booking) AS guests_served,
      (SELECT COUNT(*) FROM scoped) AS sold_room_nights,
      (SELECT SUM(DailyRevenue) FROM scoped) AS room_revenue
  `, params);

  const r = rows[0] ?? { total_bookings: 0, guests_served: 0, sold_room_nights: 0, room_revenue: 0 };
  return {
    totalBookings: r.total_bookings,
    guestsServed: r.guests_served ?? 0,
    alos: safeDivide(r.sold_room_nights, r.total_bookings),
    revenuePerGuest: safeDivide(r.room_revenue ?? 0, r.guests_served ?? 0),
  };
}

// --- Unsold / Remaining Room Nights ---
// "Available − Sold" for the selected scope; "remaining" narrows the same
// Available/Sold computation to [today, scope end] — 0 if the scope is entirely
// in the past. Implementation call (PRD doesn't give an exact remaining-nights
// formula beyond "available nights from today forward").

export interface RoomNightsGap {
  unsoldRoomNights: number;
  remainingRoomNights: number;
}

export async function getRoomNightsGap(filter: KpiFilter): Promise<RoomNightsGap> {
  const resolved = resolveFilter(filter);
  const available = await getAvailableRoomNights(resolved.properties, rangesForFysAndMonths(resolved.fys, resolved.months));

  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  const soldRows = await runQuery<{ n: number }>(`
    SELECT COUNT(*) AS n FROM ${table("sales_booking")}
    WHERE ${where}
  `, params);
  const sold = soldRows[0]?.n ?? 0;
  const unsoldRoomNights = Math.max(0, available - sold);

  const today = new Date().toISOString().slice(0, 10);
  const ranges = rangesForFysAndMonths(resolved.fys, resolved.months);
  const scopeEnd = ranges.reduce((max, r) => (r.end > max ? r.end : max), ranges[0].end);
  let remainingRoomNights = 0;
  if (!scopeEnd || scopeEnd >= today) {
    const forwardRange = { start: today, end: scopeEnd ?? "2999-12-31" };
    const forwardAvailable = await getAvailableRoomNights(resolved.properties, [forwardRange]);
    const forwardSoldRows = await runQuery<{ n: number }>(`
      SELECT COUNT(*) AS n FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) >= @today
        ${scopeEnd ? "AND CAST(StayDate AS DATE) <= @scopeEnd" : ""}
    `, { properties: resolved.properties, today, ...(scopeEnd ? { scopeEnd } : {}) });
    remainingRoomNights = Math.max(0, forwardAvailable - (forwardSoldRows[0]?.n ?? 0));
  }

  return { unsoldRoomNights, remainingRoomNights };
}

// --- Night/Revenue Mix by Category (§3.1) ---

export interface CategoryMix {
  category: BookingCategory;
  nights: number;
  revenue: number;
}

export async function getCategoryMix(filter: KpiFilter): Promise<CategoryMix[]> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  return runQuery<CategoryMix>(`
    SELECT ${bookingCategorySqlExpr("Source")} AS category, COUNT(*) AS nights, SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE ${where}
    GROUP BY category
    ORDER BY revenue DESC
  `, params);
}

// --- Repeat Booking Share (§3.6: same guest via Mobile/Email, fallback GuestName, >1 distinct ReservationNo) ---

export interface RepeatBookingShare {
  repeatBookings: number;
  totalBookings: number;
  sharePct: number | null;
}

export async function getRepeatBookingShare(filter: KpiFilter): Promise<RepeatBookingShare> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");

  const rows = await runQuery<{ repeat_bookings: number; total_bookings: number }>(`
    WITH per_booking AS (
      -- ReservationNo IS NOT NULL: same canonical booking-count basis used
      -- throughout (see getBookingStats) — avoids inflating the count with
      -- distinct-guest-combo rows that share a null ReservationNo.
      SELECT DISTINCT Property, ReservationNo, Mobile, Email, GuestName
      FROM ${table("sales_booking")}
      WHERE ${where} AND ReservationNo IS NOT NULL
    ),
    keyed AS (
      SELECT *,
        COALESCE(NULLIF(TRIM(Mobile), ''), NULLIF(TRIM(Email), ''), TRIM(GuestName)) AS guest_key
      FROM per_booking
    ),
    guest_counts AS (
      SELECT guest_key, COUNT(DISTINCT CONCAT(Property, '|', ReservationNo)) AS booking_count
      FROM keyed
      WHERE guest_key IS NOT NULL AND guest_key != ''
      GROUP BY guest_key
    )
    SELECT
      (SELECT COALESCE(SUM(booking_count), 0) FROM guest_counts WHERE booking_count > 1) AS repeat_bookings,
      (SELECT COUNT(*) FROM per_booking) AS total_bookings
  `, params);

  const r = rows[0] ?? { repeat_bookings: 0, total_bookings: 0 };
  return {
    repeatBookings: r.repeat_bookings,
    totalBookings: r.total_bookings,
    sharePct: safeDivide(r.repeat_bookings, r.total_bookings),
  };
}

// --- ADR & Occ% by Room Format (§3.4 join). Occ% here = share of scoped nights per room type (no separate per-type room-count reference exists, so "available" isn't decomposable by room type — nights-share is the defensible reading). ---

export interface RoomFormatStats {
  roomType: string | null;
  nights: number;
  revenue: number;
  adr: number | null;
  nightsSharePct: number | null;
}

export async function getRoomFormatStats(filter: KpiFilter): Promise<RoomFormatStats[]> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("b.Property", "CAST(b.StayDate AS DATE)", resolved, "");

  const rows = await runQuery<{ room_type: string | null; nights: number; revenue: number | null }>(`
    SELECT rt.room_type, COUNT(*) AS nights, SUM(b.DailyRevenue) AS revenue
    FROM ${table("sales_booking")} b
    LEFT JOIN ${roomTypeMappingSqlUnnest()} AS rt ON ${roomTypeJoinCondition("b")}
    WHERE ${where}
    GROUP BY rt.room_type
    ORDER BY nights DESC
  `, params);

  const totalNights = rows.reduce((sum, r) => sum + r.nights, 0);
  return rows.map((r) => ({
    roomType: r.room_type,
    nights: r.nights,
    revenue: r.revenue ?? 0,
    adr: safeDivide(r.revenue ?? 0, r.nights),
    nightsSharePct: safeDivide(r.nights, totalNights),
  }));
}

// --- Revenue by Room Format & FY ---

export interface RoomFormatByFy {
  roomType: string | null;
  fy: string;
  revenue: number;
}

export async function getRoomFormatByFy(filter: KpiFilter): Promise<RoomFormatByFy[]> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("b.Property", "CAST(b.StayDate AS DATE)", resolved, "");

  return runQuery<RoomFormatByFy>(`
    SELECT rt.room_type AS roomType, ${fyLabelSqlExpr("CAST(b.StayDate AS DATE)")} AS fy, SUM(b.DailyRevenue) AS revenue
    FROM ${table("sales_booking")} b
    LEFT JOIN ${roomTypeMappingSqlUnnest()} AS rt ON ${roomTypeJoinCondition("b")}
    WHERE ${where}
    GROUP BY roomType, fy
    ORDER BY fy, revenue DESC
  `, params);
}

// --- Expats (§3.6: Country IS NOT NULL AND Country != 'India') ---

export interface ExpatStats {
  bookings: number;
  revenue: number;
  nights: number;
  alos: number | null;
}

export async function getExpatStats(filter: KpiFilter): Promise<ExpatStats> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");

  const rows = await runQuery<{ bookings: number; revenue: number | null; nights: number }>(`
    WITH scoped AS (
      SELECT Property, ReservationNo, DailyRevenue
      FROM ${table("sales_booking")}
      WHERE ${where}
        AND Country IS NOT NULL AND Country != 'India'
    )
    SELECT
      COUNT(DISTINCT CONCAT(Property, '|', ReservationNo)) AS bookings,
      SUM(DailyRevenue) AS revenue,
      COUNT(*) AS nights
    FROM scoped
  `, params);

  const r = rows[0] ?? { bookings: 0, revenue: 0, nights: 0 };
  return {
    bookings: r.bookings,
    revenue: r.revenue ?? 0,
    nights: r.nights,
    alos: safeDivide(r.nights, r.bookings),
  };
}

// --- Cancellations % (booking-count basis, active vs cancelled) ---

export interface CancellationStats {
  activeBookings: number;
  cancelledBookings: number;
  cancellationPct: number | null;
}

export async function getCancellationStats(filter: KpiFilter): Promise<CancellationStats> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");

  const [activeRows, cancelledRows] = await Promise.all([
    runQuery<{ n: number }>(`
      SELECT COUNT(DISTINCT CONCAT(Property, '|', ReservationNo)) AS n
      FROM ${table("sales_booking")}
      WHERE ${where}
    `, params),
    runQuery<{ n: number }>(`
      SELECT COUNT(DISTINCT CONCAT(Property, '|', ReservationNo)) AS n
      FROM ${table("sales_booking_cancelled")}
      WHERE ${where}
    `, params),
  ]);

  const activeBookings = activeRows[0]?.n ?? 0;
  const cancelledBookings = cancelledRows[0]?.n ?? 0;
  return {
    activeBookings,
    cancelledBookings,
    cancellationPct: safeDivide(cancelledBookings, activeBookings + cancelledBookings),
  };
}

// --- Lead Time for Cancellations: ArrivalDate - CancelDate (PRD's own recommended direction) ---

export interface CancellationLeadTime {
  avgLeadTimeDays: number | null;
  sampledCancellations: number;
}

export async function getCancellationLeadTime(filter: KpiFilter): Promise<CancellationLeadTime> {
  const resolved = resolveFilter(filter);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");

  const rows = await runQuery<{ avg_days: number | null; n: number }>(`
    WITH per_booking AS (
      SELECT DISTINCT Property, ReservationNo, ArrivalDate, CancelDate
      FROM ${table("sales_booking_cancelled")}
      WHERE ${where}
        AND ReservationNo IS NOT NULL
        AND CancelDate IS NOT NULL AND TRIM(CancelDate) != ''
        AND ArrivalDate IS NOT NULL AND TRIM(ArrivalDate) != ''
    )
    SELECT
      AVG(DATE_DIFF(SAFE_CAST(ArrivalDate AS DATE), SAFE_CAST(CancelDate AS DATE), DAY)) AS avg_days,
      COUNT(*) AS n
    FROM per_booking
  `, params);

  const r = rows[0] ?? { avg_days: null, n: 0 };
  return { avgLeadTimeDays: r.avg_days, sampledCancellations: r.n };
}

// --- B2B: Nights/Revenue/ADR by Company (b2b_bills) ---
// Uses the sheet's own Financial_Year column, not a recomputed one: sample data
// showed Check_In=2024-03-31 labeled "FY 24-25" in the sheet, which would compute
// to "FY 23-24" under the standard Apr-Mar rule — the sheet's own convention for
// this table differs from sales_booking's, so it's trusted as-is (same principle
// as leadership_targets §2.3: sheet-authoritative columns aren't re-derived).
// "FY 99-00" is a junk placeholder for the 9,869 blank-Property rows — excluded.
// b2b_bills has no per-row date to filter by calendar month, so this only
// honors Property + FY, not the Month multi-select.

export interface B2bCompanyStats {
  company: string;
  nights: number;
  roomChargesWithTax: number; // col_21
  adr: number | null;
}

export async function getB2bByCompany(filter: Pick<KpiFilter, "properties" | "fys">): Promise<B2bCompanyStats[]> {
  const resolved: ResolvedFilter = resolveFilter(filter);
  const params: Record<string, unknown> = { properties: resolved.properties, fys: resolved.fys };
  const fyClause = " AND Financial_Year IN UNNEST(@fys)";

  return runQuery<B2bCompanyStats>(`
    SELECT
      Company AS company,
      SUM(Nights) AS nights,
      SUM(col_21) AS roomChargesWithTax,
      SAFE_DIVIDE(SUM(col_21), NULLIF(SUM(Nights), 0)) AS adr
    FROM ${table("b2b_bills")}
    WHERE Property IN UNNEST(@properties) AND Company IS NOT NULL
      AND Financial_Year != 'FY 99-00'${fyClause}
    GROUP BY company
    ORDER BY roomChargesWithTax DESC
  `, params);
}
