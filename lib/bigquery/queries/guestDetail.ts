// PRD §6.2 — Guest & Revenue Detail.
// 2026-09-02: rewritten for the Today/This FY/Last Year period-tabs model.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, buildScopeClause, buildPreviousScopeClause } from "./filters";
import { getAvailableRoomNights } from "./propertyWindows";
import { getLpOverviewTotals, getLpRoomTypeStats, LP_PROPERTY } from "./lpMonthly";
import { bookingCategorySqlExpr, BookingCategory } from "@/lib/reference/bookingSourceMap";
import { roomTypeMappingSqlUnnest, roomTypeJoinCondition } from "@/lib/reference/roomTypeMapping";
import { GUEST_SERVED_SHEET_SNAPSHOT, GUEST_SERVED_SNAPSHOT_RANGE, GUEST_SERVED_SNAPSHOT_LABEL } from "@/lib/reference/guestServedSheetSnapshot";
import { safeDivide } from "@/lib/format/currency";
import { ComparisonMetric } from "./overview";

function comparisonMetric(current: number | null, previous: number | null): ComparisonMetric {
  return { current, previous, pctChange: current !== null && previous !== null ? safeDivide(current - previous, previous) : null };
}

// --- Total Bookings / Guests Served / ALOS ---

export interface BookingStats {
  totalBookings: number;
  guestsServed: number;
  alos: number | null;
  revenuePerGuest: number | null;
  comparison: {
    totalBookings: ComparisonMetric;
    guestsServed: ComparisonMetric;
  };
}

interface BookingStatsRow {
  total_bookings: number;
  guests_served: number | null;
  sold_room_nights: number;
  room_revenue: number | null;
}

const BOOKING_STATS_SQL = (where: string) => `
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
    SELECT Property, ReservationNo
    FROM scoped
    WHERE ReservationNo IS NOT NULL
    GROUP BY Property, ReservationNo
  )
  SELECT
    (SELECT COUNT(*) FROM per_booking) AS total_bookings,
    -- Item #8 (2026-09-02, sixth pass): guests_served sums NoOfGuest across
    -- every night of stay (guest-nights), not MAX(NoOfGuest) per booking
    -- (peak occupancy once). Confirmed against the Guest Served sheet
    -- (see getGuestServedAccuracyCheck) that guest-nights is the sheet's own
    -- definition — the old per-booking-peak basis undercounted it by ~82%;
    -- this basis lands within ~3% for the one month cross-validated so far.
    (SELECT SUM(NoOfGuest) FROM scoped) AS guests_served,
    (SELECT COUNT(*) FROM scoped) AS sold_room_nights,
    (SELECT SUM(DailyRevenue) FROM scoped) AS room_revenue
`;

export async function getBookingStats(filter: KpiFilter): Promise<BookingStats> {
  const resolved = resolveFilter(filter);
  const includeLp = resolved.properties.includes(LP_PROPERTY);
  const compare = filter.compareYoY ?? false;
  const { clause: where, params } = buildScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "");

  const [rows, prevRows, lpTotals, lpPrevTotals] = await Promise.all([
    runQuery<BookingStatsRow>(BOOKING_STATS_SQL(where), params),
    // Comparisons are opt-in — skip the previous-period query entirely unless compareYoY is on.
    compare
      ? (() => {
          const { clause: prevWhere, params: prevParams } = buildPreviousScopeClause("Property", "CAST(StayDate AS DATE)", resolved, "prev");
          return runQuery<BookingStatsRow>(BOOKING_STATS_SQL(prevWhere), prevParams);
        })()
      : Promise.resolve(null),
    includeLp ? getLpOverviewTotals(resolved.period.current) : Promise.resolve(null),
    includeLp && compare ? getLpOverviewTotals(resolved.period.previous) : Promise.resolve(null),
  ]);

  const r = rows[0] ?? { total_bookings: 0, guests_served: 0, sold_room_nights: 0, room_revenue: 0 };
  const totalBookings = r.total_bookings + (lpTotals?.bookingsCount ?? 0);
  const guestsServed = (r.guests_served ?? 0) + (lpTotals?.guestsServed ?? 0);
  const soldRoomNights = r.sold_room_nights + (lpTotals?.soldRoomNights ?? 0);
  const roomRevenue = (r.room_revenue ?? 0) + (lpTotals?.roomRevenue ?? 0);

  const pr = prevRows ? prevRows[0] ?? { total_bookings: 0, guests_served: 0, sold_room_nights: 0, room_revenue: 0 } : null;
  const prevTotalBookings = pr ? pr.total_bookings + (lpPrevTotals?.bookingsCount ?? 0) : null;
  const prevGuestsServed = pr ? (pr.guests_served ?? 0) + (lpPrevTotals?.guestsServed ?? 0) : null;

  return {
    totalBookings,
    guestsServed,
    alos: safeDivide(soldRoomNights, totalBookings),
    revenuePerGuest: safeDivide(roomRevenue, guestsServed),
    comparison: {
      totalBookings: comparisonMetric(totalBookings, prevTotalBookings),
      guestsServed: comparisonMetric(guestsServed, prevGuestsServed),
    },
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
  const available = await getAvailableRoomNights(resolved.properties, resolved.period.current);

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
    includeLp ? getLpOverviewTotals(resolved.period.current) : Promise.resolve(null),
  ]);
  const sold = (soldRows[0]?.n ?? 0) + (lpTotals?.soldRoomNights ?? 0);
  const unsoldRoomNights = Math.max(0, available - sold);

  const today = new Date().toISOString().slice(0, 10);
  const scopeEnd = resolved.period.current.end;
  let remainingRoomNights = 0;
  if (scopeEnd >= today) {
    const forwardRange = { start: today, end: scopeEnd };
    const forwardAvailable = await getAvailableRoomNights(resolved.properties, forwardRange);
    const forwardSoldRows = await runQuery<{ n: number }>(`
      SELECT COUNT(*) AS n FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) >= @today AND CAST(StayDate AS DATE) <= @scopeEnd
    `, { properties: resolved.properties, today, scopeEnd });
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
    includeLp ? getLpOverviewTotals(resolved.period.current) : Promise.resolve(null),
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
    includeLp ? getLpRoomTypeStats(resolved.period.current) : Promise.resolve([]),
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

// --- Guest Served: sheet-vs-BigQuery accuracy check (see lib/reference/guestServedSheetSnapshot.ts) ---

export interface GuestServedAccuracyRow {
  property: string;
  bigQuery: number;
  sheet: number;
  variancePct: number | null;
}

export interface GuestServedAccuracyCheck {
  label: string;
  rows: GuestServedAccuracyRow[];
  totalBigQuery: number;
  totalSheet: number;
  totalVariancePct: number | null;
  /** Item #8: |totalVariancePct| — the residual, still-unexplained gap between BigQuery and the sheet after correcting the guest-served formula (see comment below). Surfaced in the UI as "Data Error Rate". */
  dataErrorRatePct: number | null;
}

/**
 * Item #8 (2026-09-02, sixth pass) root-cause finding: BigQuery's guest-served
 * figure previously summed MAX(NoOfGuest) PER BOOKING (i.e. each booking's
 * peak occupancy counted once) — confirmed directly against BigQuery for
 * April 2026 that this undercounts the sheet by ~82%. Also confirmed:
 * NoOfGuest itself already agrees exactly with Adult+Child on every row that
 * month (0 mismatches) — so the guest count per night is NOT being
 * mis-captured. The gap was the AGGREGATION, not the pax figure: summing
 * NoOfGuest across every night of stay (guest-NIGHTS, matching how a
 * multi-night booking's occupancy accumulates on the sheet's own manual PMS
 * extract) lands within ~3% of the sheet total (4,928 vs 5,093 for April
 * 2026, vs. 903 under the old per-booking-peak basis) — this is the sheet's
 * actual definition of "Guest Served", not booking-level headcount. Fixed
 * here and in getBookingStats to sum NoOfGuest directly over scoped nights.
 */
export async function getGuestServedAccuracyCheck(): Promise<GuestServedAccuracyCheck> {
  const properties = Object.keys(GUEST_SERVED_SHEET_SNAPSHOT);
  const rows = await runQuery<{ property: string; guests_served: number | null }>(`
    SELECT Property AS property, SUM(NoOfGuest) AS guests_served
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end
    GROUP BY property
  `, { properties, start: GUEST_SERVED_SNAPSHOT_RANGE.start, end: GUEST_SERVED_SNAPSHOT_RANGE.end });

  const byProperty = new Map(rows.map((r) => [r.property, r.guests_served ?? 0]));
  const accuracyRows: GuestServedAccuracyRow[] = properties.map((property) => {
    const bigQuery = byProperty.get(property) ?? 0;
    const sheet = GUEST_SERVED_SHEET_SNAPSHOT[property];
    return { property, bigQuery, sheet, variancePct: safeDivide(bigQuery - sheet, sheet) };
  });

  const totalBigQuery = accuracyRows.reduce((s, r) => s + r.bigQuery, 0);
  const totalSheet = accuracyRows.reduce((s, r) => s + r.sheet, 0);
  const totalVariancePct = safeDivide(totalBigQuery - totalSheet, totalSheet);

  return {
    label: GUEST_SERVED_SNAPSHOT_LABEL,
    rows: accuracyRows,
    totalBigQuery,
    totalSheet,
    totalVariancePct,
    dataErrorRatePct: totalVariancePct !== null ? Math.abs(totalVariancePct) : null,
  };
}
