// Reports tab — Skyla_Dashboard_Reports_Tab_PRD.md.
//
// GOVERNING PRINCIPLE (PRD §0): the Revenue Workbook sheets ("Folio Based
// Report FY 26-27", "FY 26-27 B2B Details") are a template for structure,
// column labels, and formula shape ONLY. Every number here comes from the
// same BigQuery tables and query patterns the rest of the dashboard already
// uses (sales_booking, b2b_bills) — never from reading a cached sheet cell.
// The live sheet's Oct26-Mar27 columns are known to be frozen on April's
// values (a sheet-side formula bug, confirmed on two independent metric
// rows) — this file reproduces the sheet's FORMULAS, never its output
// values, so it is unaffected by that bug.
//
// 2026-09-19 (PRD_Reports_Section_Final.md §1/§2) — both reports now take a
// dedicated `fy` parameter instead of being hardcoded to FY 26-27, backed
// by a local (not global-dashboard-filter) FY selector in the UI — see
// ReportsContent.tsx. Defaults to `currentFYLabel()` when no FY is
// selected. Only the Property filter (still global) narrows either report
// beyond that; the dashboard's period-tab filter never applies here, since
// each report is inherently scoped to one whole FY at a time.
import { runQuery, table, fnbTable } from "../client";
import { bookingCategorySqlExpr } from "@/lib/reference/bookingSourceMap";
import { SALES_BOOKING_STAY_FILTER, roomNightUnitsSqlExpr } from "./filters";
import { getAvailableRoomNightsByProperty } from "./propertyWindows";
import { fyBounds, fyMonthBounds, calendarMonthFromFiscal, currentFYLabel, DateRange } from "@/lib/reference/financialYear";
import { safeDivide } from "@/lib/format/currency";
import { REPORT_PROPERTIES, ReportProperty, ReportColumn } from "@/lib/reference/reportProperties";
import { getPropertyMonthOverride } from "@/lib/reference/historicalPropertyOverrides";

export { REPORT_PROPERTIES, REPORT_COLUMNS, type ReportProperty, type ReportColumn } from "@/lib/reference/reportProperties";

// The sheet's own property set — five operating hotels, no LP (retired, no
// live PMS feed, not a column in either source sheet). Fixed in
// lib/reference/reportProperties.ts (re-exported above for existing call
// sites) rather than reusing ACTIVE_PROPERTY_CODES, which includes LP.
//
// 2026-09-19 — "FO" (café outlet, not a room property) has real F&B
// revenue in fnb_sale but is NOT its own column here — per explicit user
// direction ("include FO in F&B Revenue, don't separate it"). Its revenue
// is folded into the TOTAL column's F&B/Total Revenue only (see
// factsToColumns below), counted exactly once — never shown as its own
// row/column, and never added into any individual hotel property's own
// F&B figure.

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Resolves the Property filter down to the report's own fixed universe — narrows to the intersection, never adds LP/FO even if selected globally. */
export function resolveReportProperties(selected: string[] | undefined): ReportProperty[] {
  if (!selected || selected.length === 0) return [...REPORT_PROPERTIES];
  const set = new Set(selected);
  const narrowed = REPORT_PROPERTIES.filter((p) => set.has(p));
  return narrowed.length > 0 ? narrowed : [...REPORT_PROPERTIES];
}

// --- Report 1: Folio Based Report FY 26-27 ------------------------------

export interface FolioReportMetrics {
  roomRevenue: number;
  fnbRevenue: number;
  /** Ancillary/extras revenue (DailyOtherRevenueExclusiveTax) — see fetchOtherRevenueByMonth's own comment. Zero for every property except GB, where it's real and material. */
  otherRevenue: number;
  totalRevenue: number;
  fnbRevenueSharePct: number | null;
  availableRoomNights: number;
  soldRoomNights: number;
  occupancyPct: number | null;
  guestsServed: number;
  revPar: number | null;
  adr: number | null;
  revPerGuest: number | null;
  b2bNights: number;
  b2bRevenue: number;
  b2bAdr: number | null;
  /** Non-obvious by design (PRD §1.2) — b2b_bills' ALL-TIME Room_Revenue for
   * this property (a separate, cumulative contract-billing figure) divided
   * by THIS block's sales_booking Room Revenue. Can legitimately exceed
   * 100% (verified against the PRD's own worked example: KDP's all-time
   * b2b_bills revenue is multiple times its FY26-27 sales_booking revenue).
   * Do not "fix" this to look like a normal share — it isn't one. */
  b2bRevenueSharePct: number | null;
  b2cNights: number;
  b2cRevenue: number;
  b2cAdr: number | null;
  b2cRevenueSharePct: number | null;
  otaNights: number;
  otaRevenue: number;
  otaAdr: number | null;
  otaRevenueSharePct: number | null;
  totalBookings: number;
  repeatCount: number;
  uniqueCount: number;
  repeatSharePct: number | null;
  alos: number | null;
  expatBookings: number;
  expatRevenue: number;
  expatRevenueSharePct: number | null;
  expatNights: number;
  expatAlos: number | null;
  expatRepeatCount: number;
  expatRepeatSharePct: number | null;
}

export interface FolioReportBlock {
  key: string; // "overall" | "2026-04" etc. (calendar-month ISO for month blocks)
  label: string; // "Overall – till date" | "Apr 26" etc.
  columns: Record<ReportColumn, FolioReportMetrics>;
}

export interface FolioReport {
  fy: string;
  asOfLabel: string; // e.g. "8 Sep 2026" — what "Overall – till date" is scoped through
  /** The columns actually present in every block below — the Property filter
   * narrows this (e.g. just ["KDP", "TOTAL"] when only KDP is selected), so
   * the frontend must render from this list, never from the full static
   * REPORT_COLUMNS constant — a column not in this list simply isn't a key
   * on any block's `columns` record. */
  columns: ReportColumn[];
  overall: FolioReportBlock;
  months: FolioReportBlock[];
}

/** The additive raw facts every derived ratio below is computed from — never averaged across columns, only summed (per-property rows sum into TOTAL; TOTAL is never itself re-derived from other columns' ratios). */
interface BaseFacts {
  roomRevenue: number;
  fnbRevenue: number;
  otherRevenue: number;
  availableRoomNights: number;
  soldRoomNights: number;
  guestsServed: number;
  totalBookings: number;
  repeatBookings: number;
  b2bNights: number;
  b2bRevenue: number;
  b2cNights: number;
  b2cRevenue: number;
  otaNights: number;
  otaRevenue: number;
  b2bBillsRevenueAllTime: number;
  expatBookings: number;
  expatRevenue: number;
  expatNights: number;
  expatRepeatBookings: number;
}

const EMPTY_FACTS: BaseFacts = {
  roomRevenue: 0, fnbRevenue: 0, otherRevenue: 0, availableRoomNights: 0, soldRoomNights: 0, guestsServed: 0,
  totalBookings: 0, repeatBookings: 0, b2bNights: 0, b2bRevenue: 0, b2cNights: 0, b2cRevenue: 0,
  otaNights: 0, otaRevenue: 0, b2bBillsRevenueAllTime: 0, expatBookings: 0, expatRevenue: 0,
  expatNights: 0, expatRepeatBookings: 0,
};

function sumFacts(a: BaseFacts, b: BaseFacts): BaseFacts {
  return {
    roomRevenue: a.roomRevenue + b.roomRevenue,
    fnbRevenue: a.fnbRevenue + b.fnbRevenue,
    otherRevenue: a.otherRevenue + b.otherRevenue,
    availableRoomNights: a.availableRoomNights + b.availableRoomNights,
    soldRoomNights: a.soldRoomNights + b.soldRoomNights,
    guestsServed: a.guestsServed + b.guestsServed,
    totalBookings: a.totalBookings + b.totalBookings,
    repeatBookings: a.repeatBookings + b.repeatBookings,
    b2bNights: a.b2bNights + b.b2bNights,
    b2bRevenue: a.b2bRevenue + b.b2bRevenue,
    b2cNights: a.b2cNights + b.b2cNights,
    b2cRevenue: a.b2cRevenue + b.b2cRevenue,
    otaNights: a.otaNights + b.otaNights,
    otaRevenue: a.otaRevenue + b.otaRevenue,
    b2bBillsRevenueAllTime: a.b2bBillsRevenueAllTime + b.b2bBillsRevenueAllTime,
    expatBookings: a.expatBookings + b.expatBookings,
    expatRevenue: a.expatRevenue + b.expatRevenue,
    expatNights: a.expatNights + b.expatNights,
    expatRepeatBookings: a.expatRepeatBookings + b.expatRepeatBookings,
  };
}

function deriveMetrics(f: BaseFacts): FolioReportMetrics {
  const totalRevenue = f.roomRevenue + f.fnbRevenue + f.otherRevenue;
  return {
    roomRevenue: f.roomRevenue,
    fnbRevenue: f.fnbRevenue,
    otherRevenue: f.otherRevenue,
    totalRevenue,
    fnbRevenueSharePct: safeDivide(f.fnbRevenue, totalRevenue),
    availableRoomNights: f.availableRoomNights,
    soldRoomNights: f.soldRoomNights,
    occupancyPct: safeDivide(f.soldRoomNights, f.availableRoomNights),
    guestsServed: f.guestsServed,
    revPar: safeDivide(f.roomRevenue, f.availableRoomNights),
    adr: safeDivide(f.roomRevenue, f.soldRoomNights),
    revPerGuest: safeDivide(f.roomRevenue, f.guestsServed),
    b2bNights: f.b2bNights,
    b2bRevenue: f.b2bRevenue,
    b2bAdr: safeDivide(f.b2bRevenue, f.b2bNights),
    b2bRevenueSharePct: safeDivide(f.b2bBillsRevenueAllTime, f.roomRevenue),
    b2cNights: f.b2cNights,
    b2cRevenue: f.b2cRevenue,
    b2cAdr: safeDivide(f.b2cRevenue, f.b2cNights),
    b2cRevenueSharePct: safeDivide(f.b2cRevenue, f.roomRevenue),
    otaNights: f.otaNights,
    otaRevenue: f.otaRevenue,
    otaAdr: safeDivide(f.otaRevenue, f.otaNights),
    otaRevenueSharePct: safeDivide(f.otaRevenue, f.roomRevenue),
    totalBookings: f.totalBookings,
    repeatCount: f.repeatBookings,
    uniqueCount: Math.max(0, f.totalBookings - f.repeatBookings),
    repeatSharePct: safeDivide(f.repeatBookings, f.totalBookings),
    alos: safeDivide(f.soldRoomNights, f.totalBookings),
    expatBookings: f.expatBookings,
    expatRevenue: f.expatRevenue,
    expatRevenueSharePct: safeDivide(f.expatRevenue, f.roomRevenue),
    expatNights: f.expatNights,
    expatAlos: safeDivide(f.expatNights, f.expatBookings),
    expatRepeatCount: f.expatRepeatBookings,
    expatRepeatSharePct: safeDivide(f.expatRepeatBookings, f.expatBookings),
  };
}

interface RevenueCategoryRow {
  property: string;
  month_start: string | null;
  category: "B2B" | "B2C" | "OTA";
  nights: number;
  revenue: number | null;
}

interface BookingRow {
  property: string;
  month_start: string | null;
  total_bookings: number;
  guests_served: number | null;
  repeat_bookings: number;
  expat_bookings: number;
  expat_revenue: number | null;
  expat_nights: number;
  expat_repeat_bookings: number;
}

/** Revenue/nights by category, grouped by calendar month, for the whole FY (all 12 months — including months ahead of today, which sales_booking legitimately carries as advance bookings). F&B is fetched separately, from the real POS source — see fetchFnbRevenueByMonth. */
async function fetchRevenueCategoryByMonth(properties: string[], fy: string): Promise<RevenueCategoryRow[]> {
  const { start, end } = fyBounds(fy);
  return runQuery<RevenueCategoryRow>(`
    SELECT
      Property AS property,
      CAST(DATE_TRUNC(CAST(StayDate AS DATE), MONTH) AS STRING) AS month_start,
      ${bookingCategorySqlExpr("Source")} AS category,
      SUM(${roomNightUnitsSqlExpr()}) AS nights,
      SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end AND ${SALES_BOOKING_STAY_FILTER}
    GROUP BY property, month_start, category
  `, { properties, start, end });
}

/** Same shape, but a single "Overall – till date" range (FY start through today) instead of split by calendar month. */
async function fetchRevenueCategoryTillDate(properties: string[], start: string, end: string): Promise<RevenueCategoryRow[]> {
  const rows = await runQuery<Omit<RevenueCategoryRow, "month_start">>(`
    SELECT
      Property AS property,
      ${bookingCategorySqlExpr("Source")} AS category,
      SUM(${roomNightUnitsSqlExpr()}) AS nights,
      SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end AND ${SALES_BOOKING_STAY_FILTER}
    GROUP BY property, category
  `, { properties, start, end });
  return rows.map((r) => ({ ...r, month_start: null }));
}

// 2026-09-19 (PRD_Reports_Section_Final.md §2) — F&B Revenue, from the real
// POS source (`skyla_data.fnb_sale`), NOT sales_booking's
// `DailyOtherRevenueExclusiveTax` (a PMS "extras" proxy — checked live
// against fnb_sale before this change: it read ₹587-4,825 per hotel for
// FY26-27 to date, vs fnb_sale's real ₹2.4L-18.6L — the proxy was
// effectively showing service-charge noise, not F&B sales).
//
// Also checked live against the reference sheet itself: its "Overall —
// till date" F&B Revenue cell uses a bare `SUMIF(property)` with NO date
// criterion (unlike every other metric row, including its own monthly F&B
// columns, which correctly use a 3-criteria SUMIFS with a month filter) —
// so that one cell is summing ALL-TIME fnb_sale data mislabeled as
// "this FY," and separately adds the ENTIRE "FO" café's revenue into
// EVERY property's row rather than keeping FO as its own line. Both are
// sheet-side bugs, not something to replicate (see this file's top-of-file
// PRD § — reproduce the sheet's formula SHAPE, never its buggy output).
// Per explicit user direction: F&B here is correctly scoped to the
// selected FY/month (matching the sheet's own — correct — monthly
// columns), and FO is counted once as its own column (see reportProperties.ts),
// not duplicated into KDP/HTC/JHS/BH4/GB.
//
// `net_amount` (confirmed live: `net_amount = total_amount - total_tax`)
// is the pre-tax figure the PRD asks for, matching the tax-exclusive
// convention used for Room Revenue everywhere else on this dashboard —
// the PRD's own assumed field name (`total_amount_before_tax`) doesn't
// exist in the actual schema; `net_amount` is the real equivalent.
interface FnbRevenueRow {
  property: string; // KDP/HTC/JHS/BH4/GB/FO (+ LP, filtered out below — retired, excluded from active reporting per PRD §0)
  month_start: string | null;
  fnb_revenue: number | null;
}

async function fetchFnbRevenueByMonth(fy: string): Promise<FnbRevenueRow[]> {
  const { start, end } = fyBounds(fy);
  return runQuery<FnbRevenueRow>(`
    SELECT
      property,
      CAST(DATE_TRUNC(CAST(date AS DATE), MONTH) AS STRING) AS month_start,
      CAST(SUM(net_amount) AS FLOAT64) AS fnb_revenue
    FROM ${fnbTable("fnb_sale")}
    WHERE CAST(date AS DATE) BETWEEN @start AND @end AND property != 'LP'
    GROUP BY property, month_start
  `, { start, end });
}

async function fetchFnbRevenueTillDate(start: string, end: string): Promise<FnbRevenueRow[]> {
  const rows = await runQuery<Omit<FnbRevenueRow, "month_start">>(`
    SELECT property, CAST(SUM(net_amount) AS FLOAT64) AS fnb_revenue
    FROM ${fnbTable("fnb_sale")}
    WHERE CAST(date AS DATE) BETWEEN @start AND @end AND property != 'LP'
    GROUP BY property
  `, { start, end });
  return rows.map((r) => ({ ...r, month_start: null }));
}

// 2026-09-21 — GB's Revenue ran a consistent 6-9% below the finance
// reference workbooks (FY24-25) even though Sold Nights matched — isolated
// to a nights-fine/revenue-short pattern, the mirror image of JHS's fix
// above. `sales_booking.DailyOtherRevenueExclusiveTax` (extras/ancillary
// charges — day-use fees, meeting rooms, etc.) closes that exact gap
// almost to the rupee for every FY24-25 month checked (e.g. Sep 2024: gap
// ₹83,100, this column's sum ₹83,100).
//
// Deliberately scoped to GB ONLY, not every property — first tried
// unconditionally (reasoning: BH4/HTC/JHS/KDP showed 0 for the few FY25-26
// months spot-checked), but that broke JHS's already-correct match once
// checked across all of FY24-25: JHS alone carries a real ₹74K-133K/month
// in this column that the workbooks' own Revenue figure does NOT include
// for JHS (only for GB). So the workbooks' "Revenue" is Room-only for
// every property except GB, where it's Room + Other combined — a
// per-property definition difference, not a universal one.
interface OtherRevenueRow {
  property: string;
  month_start: string | null;
  other_revenue: number | null;
}

async function fetchOtherRevenueByMonth(properties: string[], fy: string): Promise<OtherRevenueRow[]> {
  const { start, end } = fyBounds(fy);
  return runQuery<OtherRevenueRow>(`
    SELECT
      Property AS property,
      CAST(DATE_TRUNC(CAST(StayDate AS DATE), MONTH) AS STRING) AS month_start,
      SUM(DailyOtherRevenueExclusiveTax) AS other_revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND Property = 'GB' AND CAST(StayDate AS DATE) BETWEEN @start AND @end AND ${SALES_BOOKING_STAY_FILTER}
    GROUP BY property, month_start
  `, { properties, start, end });
}

async function fetchOtherRevenueTillDate(properties: string[], start: string, end: string): Promise<OtherRevenueRow[]> {
  const rows = await runQuery<Omit<OtherRevenueRow, "month_start">>(`
    SELECT Property AS property, SUM(DailyOtherRevenueExclusiveTax) AS other_revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND Property = 'GB' AND CAST(StayDate AS DATE) BETWEEN @start AND @end AND ${SALES_BOOKING_STAY_FILTER}
    GROUP BY property
  `, { properties, start, end });
  return rows.map((r) => ({ ...r, month_start: null }));
}

/**
 * Booking-grain metrics (Guests Served, Total Bookings, Repeat Bookings,
 * Expat stats), grouped by calendar month. A booking is bucketed to
 * whichever month(s) its own nights fall in — the same
 * property+ReservationNo+month grouping the guests-served figure already
 * needs (a booking spanning a month boundary contributes its own portion —
 * MAX(NoOfGuest), its own night count, its own revenue — to each month it
 * touches; this is the same "count per scope" logic getBookingStats/
 * getRepeatBookingShare/getExpatStats already use for a single range,
 * reapplied once per calendar month here). Repeat-guest detection (Mobile ->
 * Email -> GuestName fallback, exact getRepeatBookingShare logic) is scoped
 * to each month independently — a guest who stayed in two different months
 * isn't "repeat" in either individual month column, only in a range (like
 * "Overall") that actually spans both. This mirrors how every existing
 * period-scoped Repeat Bookings figure on the dashboard already works
 * (repeat-ness is always relative to the query's own range, never
 * cumulative across separate calls) — not independently confirmed against
 * the source sheet's own monthly convention (PRD §1.3).
 */
async function fetchBookingsByMonth(properties: string[], fy: string): Promise<BookingRow[]> {
  const { start, end } = fyBounds(fy);
  return fetchBookingsForRange(properties, start, end, true);
}

async function fetchBookingsTillDate(properties: string[], start: string, end: string): Promise<BookingRow[]> {
  return fetchBookingsForRange(properties, start, end, false);
}

async function fetchBookingsForRange(properties: string[], start: string, end: string, byMonth: boolean): Promise<BookingRow[]> {
  // NOT a bare NULL for the non-monthly ("Overall – till date") case — SQL's
  // NULL = NULL is never true, so the LEFT JOIN ... USING (..., month_start,
  // ...) below would silently fail to match ANY row once month_start is
  // NULL on both sides, zeroing out every repeat/expat-repeat count for the
  // Overall block specifically (caught live: Overall showed repeatCount=0
  // company-wide while every individual month correctly showed real repeat
  // counts). A constant string placeholder joins on itself correctly.
  const monthSelect = byMonth ? "CAST(DATE_TRUNC(stay_date, MONTH) AS STRING)" : "'overall'";
  const monthGroupBy = byMonth ? "month_start," : "";
  const rows = await runQuery<BookingRow>(`
    WITH scoped AS (
      SELECT Property, ReservationNo, NoOfGuest, Mobile, Email, GuestName, Country, DailyRevenue, RoomShortCode,
        CAST(StayDate AS DATE) AS stay_date
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end AND ${SALES_BOOKING_STAY_FILTER}
    ),
    per_booking AS (
      SELECT
        Property AS property,
        ${monthSelect} AS month_start,
        ReservationNo,
        -- Guest-nights (2026-09-10, user direction — see BookingStats.guestsServed):
        -- SUM(NoOfGuest) over the booking's stay-nights = NoOfGuest x nights.
        -- Was MAX(NoOfGuest) (per-booking peak headcount). Only feeds
        -- guests_served below; repeat/expat flags are unaffected.
        SUM(NoOfGuest) AS guests,
        ANY_VALUE(Mobile) AS mobile,
        ANY_VALUE(Email) AS email,
        ANY_VALUE(GuestName) AS guest_name,
        ANY_VALUE(Country) AS country,
        SUM(DailyRevenue) AS booking_revenue,
        SUM(${roomNightUnitsSqlExpr()}) AS booking_nights
      FROM scoped
      WHERE ReservationNo IS NOT NULL
      GROUP BY property, ${monthGroupBy} ReservationNo
    ),
    keyed AS (
      SELECT *, COALESCE(NULLIF(TRIM(mobile), ''), NULLIF(TRIM(email), ''), TRIM(guest_name)) AS guest_key
      FROM per_booking
    ),
    guest_counts AS (
      SELECT property, month_start, guest_key, COUNT(*) AS booking_count
      FROM keyed
      WHERE guest_key IS NOT NULL AND guest_key != ''
      GROUP BY property, month_start, guest_key
    ),
    flagged AS (
      SELECT k.*, COALESCE(gc.booking_count, 1) > 1 AS is_repeat
      FROM keyed k
      LEFT JOIN guest_counts gc USING (property, month_start, guest_key)
    )
    SELECT
      property,
      month_start,
      COUNT(*) AS total_bookings,
      SUM(guests) AS guests_served,
      COUNTIF(is_repeat) AS repeat_bookings,
      COUNTIF(country IS NOT NULL AND country != 'India') AS expat_bookings,
      SUM(IF(country IS NOT NULL AND country != 'India', booking_revenue, 0)) AS expat_revenue,
      SUM(IF(country IS NOT NULL AND country != 'India', booking_nights, 0)) AS expat_nights,
      COUNTIF(country IS NOT NULL AND country != 'India' AND is_repeat) AS expat_repeat_bookings
    FROM flagged
    GROUP BY property, month_start
  `, { properties, start, end });
  return rows;
}

async function fetchB2bBillsRevenueAllTime(properties: string[]): Promise<Record<string, number>> {
  const rows = await runQuery<{ property: string; revenue: number | null }>(`
    SELECT Property AS property, SUM(Room_Revenue) AS revenue
    FROM ${table("b2b_bills")}
    WHERE Property IN UNNEST(@properties) AND Financial_Year != 'FY 99-00'
    GROUP BY property
  `, { properties });
  return Object.fromEntries(rows.map((r) => [r.property, r.revenue ?? 0]));
}

function buildFactsByProperty(
  properties: ReportProperty[],
  revCat: RevenueCategoryRow[],
  bookings: BookingRow[],
  availableByProperty: Record<string, number>,
  b2bBillsAllTime: Record<string, number>,
  fnbByProperty: Record<string, number>,
  otherByProperty: Record<string, number>
): Record<ReportProperty, BaseFacts> {
  const result = {} as Record<ReportProperty, BaseFacts>;
  for (const p of properties) {
    const facts: BaseFacts = { ...EMPTY_FACTS };
    facts.availableRoomNights = availableByProperty[p] ?? 0;
    facts.b2bBillsRevenueAllTime = b2bBillsAllTime[p] ?? 0;
    facts.fnbRevenue = fnbByProperty[p] ?? 0;
    facts.otherRevenue = otherByProperty[p] ?? 0;
    for (const r of revCat.filter((x) => x.property === p)) {
      facts.roomRevenue += r.revenue ?? 0;
      facts.soldRoomNights += r.nights;
      if (r.category === "B2B") { facts.b2bNights += r.nights; facts.b2bRevenue += r.revenue ?? 0; }
      else if (r.category === "B2C") { facts.b2cNights += r.nights; facts.b2cRevenue += r.revenue ?? 0; }
      else { facts.otaNights += r.nights; facts.otaRevenue += r.revenue ?? 0; }
    }
    const b = bookings.find((x) => x.property === p);
    if (b) {
      facts.totalBookings = b.total_bookings;
      facts.guestsServed = b.guests_served ?? 0;
      facts.repeatBookings = b.repeat_bookings;
      facts.expatBookings = b.expat_bookings;
      facts.expatRevenue = b.expat_revenue ?? 0;
      facts.expatNights = b.expat_nights;
      facts.expatRepeatBookings = b.expat_repeat_bookings;
    }
    result[p] = facts;
  }
  return result;
}

/**
 * Applies `historicalPropertyOverrides.ts`'s targeted fallback, if this
 * property+month has one — see that file's own header comment for which
 * two anomalies this covers and why they weren't fixed at the query level.
 * Only touches the fields the override actually specifies: `soldRoomNights`
 * replaces the computed value outright; `totalRevenue` is the workbooks'
 * own Revenue figure, which NEVER includes F&B (confirmed by the GB Other
 * Revenue investigation — GB's workbook figure is Room+Other, still no
 * F&B) — so it backs `roomRevenue` into whatever Other Revenue this month
 * already computed (fnbRevenue is untouched, and simply adds on top of
 * the target as its own genuinely separate line, same as it would for any
 * non-overridden month). Deliberately NOT applied to the "Overall – till
 * date" block — see getFolioBasedReport's own comment at its call site.
 */
function applyHistoricalOverride(facts: BaseFacts, property: string, monthKey: string): BaseFacts {
  const override = getPropertyMonthOverride(property, monthKey);
  if (!override) return facts;
  return {
    ...facts,
    soldRoomNights: override.soldRoomNights ?? facts.soldRoomNights,
    roomRevenue: override.totalRevenue !== undefined ? override.totalRevenue - facts.otherRevenue : facts.roomRevenue,
  };
}

/** fnbFo: FO café's own F&B revenue for this same block's date range — folded into TOTAL's F&B/Total Revenue only (not its own column, not added to any hotel property — see this file's header comment). */
function factsToColumns(properties: ReportProperty[], facts: Record<ReportProperty, BaseFacts>, fnbFo: number): Record<ReportColumn, FolioReportMetrics> {
  const columns = {} as Record<ReportColumn, FolioReportMetrics>;
  let total = EMPTY_FACTS;
  for (const p of properties) {
    columns[p] = deriveMetrics(facts[p]);
    total = sumFacts(total, facts[p]);
  }
  total = sumFacts(total, { ...EMPTY_FACTS, fnbRevenue: fnbFo });
  columns.TOTAL = deriveMetrics(total);
  return columns;
}

export async function getFolioBasedReport(selectedProperties: string[] | undefined, fy: string = currentFYLabel()): Promise<FolioReport> {
  const properties = resolveReportProperties(selectedProperties);
  const { start: fyStart, end: fyEnd } = fyBounds(fy);
  const today = new Date().toISOString().slice(0, 10);
  // "Overall – till date" only means "through today" for the CURRENT FY. For
  // a past FY (e.g. FY 24-25 selected while today is in FY 26-27), "today"
  // is already 1-2 years past that FY's own end — clamping here is what
  // makes a past FY's "Overall" block equal its own full 12-month total,
  // instead of silently reaching past the FY boundary into data that
  // doesn't belong to it. Caught live: selecting FY 24-25 showed "Overall –
  // till date is FY 24-25's start through 19 Sep 2026" before this fix.
  const tillDateEnd = today < fyEnd ? today : fyEnd;

  const [
    revCatMonthly, bookingsMonthly, revCatTillDate, bookingsTillDate, b2bBillsAllTime,
    availableByMonth, availableTillDate, fnbMonthlyRows, fnbTillDateRows, otherMonthlyRows, otherTillDateRows,
  ] = await Promise.all([
      fetchRevenueCategoryByMonth(properties, fy),
      fetchBookingsByMonth(properties, fy),
      fetchRevenueCategoryTillDate(properties, fyStart, tillDateEnd),
      fetchBookingsTillDate(properties, fyStart, tillDateEnd),
      fetchB2bBillsRevenueAllTime(properties),
      Promise.all(
        Array.from({ length: 12 }, (_, i) => i + 1).map((fiscalMonth) =>
          getAvailableRoomNightsByProperty(properties, fyMonthBounds(fy, calendarMonthFromFiscal(fiscalMonth)))
        )
      ),
      getAvailableRoomNightsByProperty(properties, { start: fyStart, end: tillDateEnd } as DateRange),
      fetchFnbRevenueByMonth(fy),
      fetchFnbRevenueTillDate(fyStart, tillDateEnd),
      fetchOtherRevenueByMonth(properties, fy),
      fetchOtherRevenueTillDate(properties, fyStart, tillDateEnd),
    ]);

  const fnbTillDateByProperty = Object.fromEntries(fnbTillDateRows.map((r) => [r.property, r.fnb_revenue ?? 0]));
  const otherTillDateByProperty = Object.fromEntries(otherTillDateRows.map((r) => [r.property, r.other_revenue ?? 0]));
  // 2026-09-21: historicalPropertyOverrides.ts's fallback is NOT applied
  // here — "Overall – till date" is an independently-queried range total,
  // not a sum of the month blocks below, and neither reference workbook
  // has an "Overall" concept to override against in the first place (both
  // are purely month-by-month). The gap this leaves is small and bounded
  // to whichever override months fall inside the selected FY.
  const overallFacts = buildFactsByProperty(properties, revCatTillDate, bookingsTillDate, availableTillDate, b2bBillsAllTime, fnbTillDateByProperty, otherTillDateByProperty);
  const overall: FolioReportBlock = {
    key: "overall",
    label: "Overall – till date",
    columns: factsToColumns(properties, overallFacts, fnbTillDateByProperty.FO ?? 0),
  };

  const months: FolioReportBlock[] = [];
  for (let fiscalMonth = 1; fiscalMonth <= 12; fiscalMonth++) {
    const calendarMonth = calendarMonthFromFiscal(fiscalMonth);
    const bounds = fyMonthBounds(fy, calendarMonth);
    const monthRows = revCatMonthly.filter((r) => r.month_start === bounds.start);
    const monthBookings = bookingsMonthly.filter((r) => r.month_start === bounds.start);
    const monthFnbByProperty = Object.fromEntries(
      fnbMonthlyRows.filter((r) => r.month_start === bounds.start).map((r) => [r.property, r.fnb_revenue ?? 0])
    );
    const monthOtherByProperty = Object.fromEntries(
      otherMonthlyRows.filter((r) => r.month_start === bounds.start).map((r) => [r.property, r.other_revenue ?? 0])
    );
    const rawFacts = buildFactsByProperty(properties, monthRows, monthBookings, availableByMonth[fiscalMonth - 1], b2bBillsAllTime, monthFnbByProperty, monthOtherByProperty);
    const facts = Object.fromEntries(
      properties.map((p) => [p, applyHistoricalOverride(rawFacts[p], p, bounds.start)])
    ) as Record<ReportProperty, BaseFacts>;
    const calendarYear = parseInt(bounds.start.slice(0, 4), 10);
    months.push({
      key: bounds.start,
      label: `${MONTH_ABBR[calendarMonth - 1]} ${String(calendarYear).slice(-2)}`,
      columns: factsToColumns(properties, facts, monthFnbByProperty.FO ?? 0),
    });
  }

  const asOfDate = new Date(`${tillDateEnd}T00:00:00`);
  const asOfLabel = `${asOfDate.getDate()} ${MONTH_ABBR[asOfDate.getMonth()]} ${asOfDate.getFullYear()}`;

  return { fy, asOfLabel, columns: [...properties, "TOTAL"], overall, months };
}

// --- Report 2: FY 26-27 B2B Details --------------------------------------

export interface B2bDetailZoneARow {
  company: string; // Bills_due_from
  totalRevenue: number;
  totalNights: number;
  totalAdr: number | null;
  byMonth: { monthKey: string; monthLabel: string; revenue: number; nights: number; adr: number | null }[];
}

export interface B2bDetailReport {
  fy: string;
  zoneA: B2bDetailZoneARow[];
}

interface ZoneARawRow {
  company: string;
  month: string; // e.g. "Apr 26"
  revenue: number | null;
  nights: number | null;
}

/** Fiscal-month order for "Apr 26".."Mar 27"-style labels, so Zone A's month columns render Apr->Mar rather than the table's own arbitrary/alphabetical row order. */
function monthSortKey(fy: string, label: string): string {
  const m = /^(\w{3})[\s-]?(\d{2})$/.exec(label.trim());
  if (!m) return label;
  const idx = MONTH_ABBR.indexOf(m[1]);
  if (idx < 0) return label;
  const calendarMonth = idx + 1;
  const fiscal = calendarMonth >= 4 ? calendarMonth - 3 : calendarMonth + 9;
  return `${fy}-${String(fiscal).padStart(2, "0")}`;
}

export async function getB2bDetailReport(selectedProperties: string[] | undefined, fy: string = currentFYLabel()): Promise<B2bDetailReport> {
  const properties = resolveReportProperties(selectedProperties);

  const zoneARows = await runQuery<ZoneARawRow>(`
    SELECT Bills_due_from AS company, Month AS month, SUM(Room_Revenue) AS revenue, SUM(Nights) AS nights
    FROM ${table("b2b_bills")}
    WHERE Property IN UNNEST(@properties) AND Financial_Year = @fy AND Bills_due_from IS NOT NULL
    GROUP BY company, month
  `, { properties, fy });

  // 2026-09-17: Bills_due_from is a curated field (one entry per contract,
  // not per-invoice free text like sales_company_bills.CompanyName), but
  // still gets typed inconsistently across bills by different staff —
  // confirmed live: "ADP" vs "adp", "Vyjayanthi Movies" vs "VYJAYANTHI
  // MOVIES". Same normalization as b2bContracts.ts's company-name dedup
  // (see that file's header comment for the full story), applied here in
  // JS since the (company, month) grouping already happens client-side —
  // merge by the normalized key, re-summing per month (not just
  // concatenating byMonth rows) in case two variants both billed the same
  // month, which a naive merge would otherwise double-list instead of sum.
  const normalizeCompanyKey = (name: string) =>
    name.trim().toUpperCase().replace(/\./g, "").replace(/\s*\(/g, " (").replace(/\s+/g, " ");

  const byCompany = new Map<string, { display: string; months: Map<string, { monthLabel: string; revenue: number; nights: number }> }>();
  for (const r of zoneARows) {
    const key = normalizeCompanyKey(r.company);
    let entry = byCompany.get(key);
    if (!entry) {
      entry = { display: r.company, months: new Map() };
      byCompany.set(key, entry);
    }
    const monthKey = monthSortKey(fy, r.month);
    const existingMonth = entry.months.get(monthKey);
    if (existingMonth) {
      existingMonth.revenue += r.revenue ?? 0;
      existingMonth.nights += r.nights ?? 0;
    } else {
      entry.months.set(monthKey, { monthLabel: r.month, revenue: r.revenue ?? 0, nights: r.nights ?? 0 });
    }
  }

  const zoneA: B2bDetailZoneARow[] = [...byCompany.values()]
    .map(({ display, months }) => {
      const byMonth = [...months.entries()]
        .map(([monthKey, m]) => ({ monthKey, monthLabel: m.monthLabel, revenue: m.revenue, nights: m.nights, adr: safeDivide(m.revenue, m.nights) }))
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      const totalRevenue = byMonth.reduce((s, m) => s + m.revenue, 0);
      const totalNights = byMonth.reduce((s, m) => s + m.nights, 0);
      return { company: display, totalRevenue, totalNights, totalAdr: safeDivide(totalRevenue, totalNights), byMonth };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  return { fy, zoneA };
}
