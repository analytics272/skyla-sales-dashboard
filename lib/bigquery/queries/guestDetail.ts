// PRD §6.2 — Guest & Revenue Detail.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause } from "./filters";
import { getAvailableRoomNights, rangesForFysAndMonths } from "./propertyWindows";
import { getLpOverviewTotals, getLpRoomTypeStats, getLpRoomTypeByFy, LP_PROPERTY } from "./lpMonthly";
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
  const includeLp = resolved.properties.includes(LP_PROPERTY);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");

  const [rows, lpTotals] = await Promise.all([
    runQuery<BookingStatsRow>(`
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
    `, params),
    includeLp ? getLpOverviewTotals(resolved.fys, resolved.months) : Promise.resolve(null),
  ]);

  const r = rows[0] ?? { total_bookings: 0, guests_served: 0, sold_room_nights: 0, room_revenue: 0 };
  const totalBookings = r.total_bookings + (lpTotals?.bookingsCount ?? 0);
  const guestsServed = (r.guests_served ?? 0) + (lpTotals?.guestsServed ?? 0);
  const soldRoomNights = r.sold_room_nights + (lpTotals?.soldRoomNights ?? 0);
  const roomRevenue = (r.room_revenue ?? 0) + (lpTotals?.roomRevenue ?? 0);
  return {
    totalBookings,
    guestsServed,
    alos: safeDivide(soldRoomNights, totalBookings),
    revenuePerGuest: safeDivide(roomRevenue, guestsServed),
  };
}

// --- Unsold / Remaining Room Nights ---
// "Available − Sold" for the selected scope; "remaining" narrows the same
// Available/Sold computation to [today, scope end] — 0 if the scope is entirely
// in the past. Implementation call (PRD doesn't give an exact remaining-nights
// formula beyond "available nights from today forward").

export interface RoomNightsGap {
  availableRoomNights: number;
  unsoldRoomNights: number;
  remainingRoomNights: number;
}

export async function getRoomNightsGap(filter: KpiFilter): Promise<RoomNightsGap> {
  const resolved = resolveFilter(filter);
  const includeLp = resolved.properties.includes(LP_PROPERTY);
  const available = await getAvailableRoomNights(resolved.properties, rangesForFysAndMonths(resolved.fys, resolved.months));

  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  // `available` already includes LP's contribution (getAvailableRoomNights is
  // LP-aware via propertyWindows.ts). LP has zero sales_booking rows, so its
  // real sold nights must be added here too — otherwise Unsold Room Nights
  // would overstate LP as 100% unsold, when it actually sold real nights
  // (just recorded in sales_booking_lp_monthly instead).
  const [soldRows, lpTotals] = await Promise.all([
    runQuery<{ n: number }>(`
      SELECT COUNT(*) AS n FROM ${table("sales_booking")}
      WHERE ${where}
    `, params),
    includeLp ? getLpOverviewTotals(resolved.fys, resolved.months) : Promise.resolve(null),
  ]);
  const sold = (soldRows[0]?.n ?? 0) + (lpTotals?.soldRoomNights ?? 0);
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

  return { availableRoomNights: available, unsoldRoomNights, remainingRoomNights };
}

// --- Night/Revenue Mix by Category (§3.1) ---

export interface CategoryMix {
  category: BookingCategory;
  nights: number;
  revenue: number;
}

export async function getCategoryMix(filter: KpiFilter): Promise<CategoryMix[]> {
  const resolved = resolveFilter(filter);
  const includeLp = resolved.properties.includes(LP_PROPERTY);
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");
  const [rows, lpTotals] = await Promise.all([
    runQuery<CategoryMix>(`
      SELECT ${bookingCategorySqlExpr("Source")} AS category, COUNT(*) AS nights, SUM(DailyRevenue) AS revenue
      FROM ${table("sales_booking")}
      WHERE ${where}
      GROUP BY category
    `, params),
    includeLp ? getLpOverviewTotals(resolved.fys, resolved.months) : Promise.resolve(null),
  ]);

  const merged = new Map<BookingCategory, CategoryMix>();
  for (const r of rows) merged.set(r.category, r);
  if (lpTotals) {
    for (const lp of lpTotals.bySource) {
      const existing = merged.get(lp.category);
      if (existing) {
        existing.nights += lp.nights;
        existing.revenue += lp.revenue;
      } else {
        merged.set(lp.category, { category: lp.category, nights: lp.nights, revenue: lp.revenue });
      }
    }
  }
  return [...merged.values()].sort((a, b) => b.revenue - a.revenue);
}

// --- Repeat Booking Share (§3.6: same guest via Mobile/Email, fallback GuestName, >1 distinct ReservationNo) ---
// LP excluded (2026-08-26 reassessment): neither sales_booking_lp_monthly nor
// _monthly_roomtype has a guest-identity column (Mobile/Email/GuestName) at
// any grain — there's nothing to match a repeat guest against. Not
// implementable without fabricating guest identities.

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
  const includeLp = resolved.properties.includes(LP_PROPERTY);
  const { clause: where, params } = buildScopeClause("b.Property", "CAST(b.StayDate AS DATE)", resolved, "");

  const [rows, lpRows] = await Promise.all([
    runQuery<{ room_type: string | null; nights: number; revenue: number | null }>(`
      SELECT rt.room_type, COUNT(*) AS nights, SUM(b.DailyRevenue) AS revenue
      FROM ${table("sales_booking")} b
      LEFT JOIN ${roomTypeMappingSqlUnnest()} AS rt ON ${roomTypeJoinCondition("b")}
      WHERE ${where}
      GROUP BY rt.room_type
    `, params),
    includeLp ? getLpRoomTypeStats(resolved.fys, resolved.months) : Promise.resolve([]),
  ]);

  const merged = new Map<string | null, { nights: number; revenue: number }>();
  for (const r of rows) merged.set(r.room_type, { nights: r.nights, revenue: r.revenue ?? 0 });
  for (const lp of lpRows) {
    const existing = merged.get(lp.roomType);
    if (existing) {
      existing.nights += lp.nights;
      existing.revenue += lp.revenue;
    } else {
      merged.set(lp.roomType, { nights: lp.nights, revenue: lp.revenue });
    }
  }

  const totalNights = [...merged.values()].reduce((sum, r) => sum + r.nights, 0);
  return [...merged.entries()]
    .map(([roomType, v]) => ({
      roomType,
      nights: v.nights,
      revenue: v.revenue,
      adr: safeDivide(v.revenue, v.nights),
      nightsSharePct: safeDivide(v.nights, totalNights),
    }))
    .sort((a, b) => b.nights - a.nights);
}

// --- Revenue by Room Format & FY ---

export interface RoomFormatByFy {
  roomType: string | null;
  fy: string;
  revenue: number;
}

export async function getRoomFormatByFy(filter: KpiFilter): Promise<RoomFormatByFy[]> {
  const resolved = resolveFilter(filter);
  const includeLp = resolved.properties.includes(LP_PROPERTY);
  const { clause: where, params } = buildScopeClause("b.Property", "CAST(b.StayDate AS DATE)", resolved, "");

  const [rows, lpRows] = await Promise.all([
    runQuery<RoomFormatByFy>(`
      SELECT rt.room_type AS roomType, ${fyLabelSqlExpr("CAST(b.StayDate AS DATE)")} AS fy, SUM(b.DailyRevenue) AS revenue
      FROM ${table("sales_booking")} b
      LEFT JOIN ${roomTypeMappingSqlUnnest()} AS rt ON ${roomTypeJoinCondition("b")}
      WHERE ${where}
      GROUP BY roomType, fy
    `, params),
    includeLp ? getLpRoomTypeByFy(resolved.fys, resolved.months) : Promise.resolve([]),
  ]);

  const merged = new Map<string, RoomFormatByFy>();
  for (const r of rows) merged.set(`${r.roomType}|${r.fy}`, r);
  for (const lp of lpRows) {
    const key = `${lp.roomType}|${lp.fy}`;
    const existing = merged.get(key);
    if (existing) existing.revenue += lp.revenue;
    else merged.set(key, { roomType: lp.roomType, fy: lp.fy, revenue: lp.revenue });
  }
  return [...merged.values()].sort((a, b) => (a.fy === b.fy ? b.revenue - a.revenue : a.fy.localeCompare(b.fy)));
}

// --- Expats (§3.6: Country IS NOT NULL AND Country != 'India') ---
// LP excluded (2026-08-26 reassessment): neither LP table has a Country
// column at any grain — no basis to classify any of LP's guests as expat.

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
// LP excluded (2026-08-26 reassessment): the backfill only covers realized
// (checked-out) bookings — neither LP table records cancellations, so there's
// no cancelled-booking count to add to either side of this ratio.

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
// LP excluded (2026-08-26 reassessment): no cancellation data at all in the
// LP tables (see getCancellationStats above) — nothing to compute a lead time from.

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

