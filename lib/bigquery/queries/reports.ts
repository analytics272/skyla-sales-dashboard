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
// Both reports are fixed to FY 26-27 regardless of the dashboard's global
// period-tab filter (only the Property filter applies here) — the report is
// named for one specific FY, the same way Property Targets' fixed FY27
// sheet doesn't move with the period filter either.
import { runQuery, table } from "../client";
import { bookingCategorySqlExpr } from "@/lib/reference/bookingSourceMap";
import { SALES_BOOKING_STAY_FILTER, roomNightUnitsSqlExpr } from "./filters";
import { getAvailableRoomNightsByProperty } from "./propertyWindows";
import { fyBounds, fyMonthBounds, calendarMonthFromFiscal, DateRange } from "@/lib/reference/financialYear";
import { safeDivide } from "@/lib/format/currency";
import { REPORT_PROPERTIES, ReportProperty, ReportColumn } from "@/lib/reference/reportProperties";

export { REPORT_PROPERTIES, REPORT_COLUMNS, type ReportProperty, type ReportColumn } from "@/lib/reference/reportProperties";

export const REPORTS_FY = "FY 26-27";

// The sheet's own column set — five operating hotels, no LP (retired, no
// live PMS feed, not a column in either source sheet) and no "FO" (café
// outlet, not a room property — only relevant to Reviews, §9 of the KPI
// reference doc). Fixed in lib/reference/reportProperties.ts (re-exported
// above for existing call sites) rather than reusing ACTIVE_PROPERTY_CODES,
// which includes LP.

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
  roomRevenue: 0, fnbRevenue: 0, availableRoomNights: 0, soldRoomNights: 0, guestsServed: 0,
  totalBookings: 0, repeatBookings: 0, b2bNights: 0, b2bRevenue: 0, b2cNights: 0, b2cRevenue: 0,
  otaNights: 0, otaRevenue: 0, b2bBillsRevenueAllTime: 0, expatBookings: 0, expatRevenue: 0,
  expatNights: 0, expatRepeatBookings: 0,
};

function sumFacts(a: BaseFacts, b: BaseFacts): BaseFacts {
  return {
    roomRevenue: a.roomRevenue + b.roomRevenue,
    fnbRevenue: a.fnbRevenue + b.fnbRevenue,
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
  const totalRevenue = f.roomRevenue + f.fnbRevenue;
  return {
    roomRevenue: f.roomRevenue,
    fnbRevenue: f.fnbRevenue,
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
  fnb_revenue: number | null;
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

/** Revenue/F&B/nights by category, grouped by calendar month, for the whole FY (all 12 months — including months ahead of today, which sales_booking legitimately carries as advance bookings). */
async function fetchRevenueCategoryByMonth(properties: string[], fy: string): Promise<RevenueCategoryRow[]> {
  const { start, end } = fyBounds(fy);
  return runQuery<RevenueCategoryRow>(`
    SELECT
      Property AS property,
      CAST(DATE_TRUNC(CAST(StayDate AS DATE), MONTH) AS STRING) AS month_start,
      ${bookingCategorySqlExpr("Source")} AS category,
      SUM(${roomNightUnitsSqlExpr()}) AS nights,
      SUM(DailyRevenue) AS revenue,
      SUM(DailyOtherRevenueExclusiveTax) AS fnb_revenue
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
      SUM(DailyRevenue) AS revenue,
      SUM(DailyOtherRevenueExclusiveTax) AS fnb_revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end AND ${SALES_BOOKING_STAY_FILTER}
    GROUP BY property, category
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
  b2bBillsAllTime: Record<string, number>
): Record<ReportProperty, BaseFacts> {
  const result = {} as Record<ReportProperty, BaseFacts>;
  for (const p of properties) {
    const facts: BaseFacts = { ...EMPTY_FACTS };
    facts.availableRoomNights = availableByProperty[p] ?? 0;
    facts.b2bBillsRevenueAllTime = b2bBillsAllTime[p] ?? 0;
    for (const r of revCat.filter((x) => x.property === p)) {
      facts.roomRevenue += r.revenue ?? 0;
      facts.fnbRevenue += r.fnb_revenue ?? 0;
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

function factsToColumns(properties: ReportProperty[], facts: Record<ReportProperty, BaseFacts>): Record<ReportColumn, FolioReportMetrics> {
  const columns = {} as Record<ReportColumn, FolioReportMetrics>;
  let total = EMPTY_FACTS;
  for (const p of properties) {
    columns[p] = deriveMetrics(facts[p]);
    total = sumFacts(total, facts[p]);
  }
  columns.TOTAL = deriveMetrics(total);
  return columns;
}

export async function getFolioBasedReport(selectedProperties: string[] | undefined): Promise<FolioReport> {
  const properties = resolveReportProperties(selectedProperties);
  const fy = REPORTS_FY;
  const { start: fyStart } = fyBounds(fy);
  const today = new Date().toISOString().slice(0, 10);

  const [revCatMonthly, bookingsMonthly, revCatTillDate, bookingsTillDate, b2bBillsAllTime, availableByMonth, availableTillDate] =
    await Promise.all([
      fetchRevenueCategoryByMonth(properties, fy),
      fetchBookingsByMonth(properties, fy),
      fetchRevenueCategoryTillDate(properties, fyStart, today),
      fetchBookingsTillDate(properties, fyStart, today),
      fetchB2bBillsRevenueAllTime(properties),
      Promise.all(
        Array.from({ length: 12 }, (_, i) => i + 1).map((fiscalMonth) =>
          getAvailableRoomNightsByProperty(properties, fyMonthBounds(fy, calendarMonthFromFiscal(fiscalMonth)))
        )
      ),
      getAvailableRoomNightsByProperty(properties, { start: fyStart, end: today } as DateRange),
    ]);

  const overallFacts = buildFactsByProperty(properties, revCatTillDate, bookingsTillDate, availableTillDate, b2bBillsAllTime);
  const overall: FolioReportBlock = {
    key: "overall",
    label: "Overall – till date",
    columns: factsToColumns(properties, overallFacts),
  };

  const months: FolioReportBlock[] = [];
  for (let fiscalMonth = 1; fiscalMonth <= 12; fiscalMonth++) {
    const calendarMonth = calendarMonthFromFiscal(fiscalMonth);
    const bounds = fyMonthBounds(fy, calendarMonth);
    const monthRows = revCatMonthly.filter((r) => r.month_start === bounds.start);
    const monthBookings = bookingsMonthly.filter((r) => r.month_start === bounds.start);
    const facts = buildFactsByProperty(properties, monthRows, monthBookings, availableByMonth[fiscalMonth - 1], b2bBillsAllTime);
    const calendarYear = parseInt(bounds.start.slice(0, 4), 10);
    months.push({
      key: bounds.start,
      label: `${MONTH_ABBR[calendarMonth - 1]} ${String(calendarYear).slice(-2)}`,
      columns: factsToColumns(properties, facts),
    });
  }

  const asOfDate = new Date(`${today}T00:00:00`);
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

export interface B2bDetailZoneBRow {
  property: string;
  guestName: string | null;
  checkIn: string | null; // ISO date (first 10 chars of the raw Check_In value)
  billDate: string | null; // ISO date
  invNo: string | null;
  businessSource: string | null;
  nights: number;
  billsDueFrom: string | null;
  roomRevenue: number;
  poc: string | null;
  month: string | null; // sheet's own "Apr 26"-style label, already on the row
}

export interface B2bDetailReport {
  fy: string;
  zoneA: B2bDetailZoneARow[];
  zoneB: B2bDetailZoneBRow[];
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

export async function getB2bDetailReport(selectedProperties: string[] | undefined): Promise<B2bDetailReport> {
  const properties = resolveReportProperties(selectedProperties);
  const fy = REPORTS_FY;

  const [zoneARows, zoneBRows] = await Promise.all([
    runQuery<ZoneARawRow>(`
      SELECT Bills_due_from AS company, Month AS month, SUM(Room_Revenue) AS revenue, SUM(Nights) AS nights
      FROM ${table("b2b_bills")}
      WHERE Property IN UNNEST(@properties) AND Financial_Year = @fy AND Bills_due_from IS NOT NULL
      GROUP BY company, month
    `, { properties, fy }),
    runQuery<{
      property: string;
      guest_name: string | null;
      check_in: string | null;
      bill_date: string | null;
      inv_no: string | null;
      business_source: string | null;
      nights: number | null;
      bills_due_from: string | null;
      room_revenue: number | null;
      poc: string | null;
      month: string | null;
    }>(`
      SELECT
        Property AS property,
        Guest_Name AS guest_name,
        SUBSTR(Check_In, 1, 10) AS check_in,
        CAST(Bill_Date AS STRING) AS bill_date,
        Inv_No AS inv_no,
        Business_Source AS business_source,
        Nights AS nights,
        Bills_due_from AS bills_due_from,
        Room_Revenue AS room_revenue,
        POC AS poc,
        Month AS month
      FROM ${table("b2b_bills")}
      WHERE Property IN UNNEST(@properties) AND Financial_Year = @fy
      ORDER BY Property, Check_In
    `, { properties, fy }),
  ]);

  const byCompany = new Map<string, ZoneARawRow[]>();
  for (const r of zoneARows) {
    const list = byCompany.get(r.company) ?? [];
    list.push(r);
    byCompany.set(r.company, list);
  }

  const zoneA: B2bDetailZoneARow[] = [...byCompany.entries()]
    .map(([company, rows]) => {
      const byMonth = rows
        .map((r) => ({
          monthKey: monthSortKey(fy, r.month),
          monthLabel: r.month,
          revenue: r.revenue ?? 0,
          nights: r.nights ?? 0,
          adr: safeDivide(r.revenue ?? 0, r.nights ?? 0),
        }))
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      const totalRevenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
      const totalNights = rows.reduce((s, r) => s + (r.nights ?? 0), 0);
      return { company, totalRevenue, totalNights, totalAdr: safeDivide(totalRevenue, totalNights), byMonth };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const zoneB: B2bDetailZoneBRow[] = zoneBRows.map((r) => ({
    property: r.property,
    guestName: r.guest_name,
    checkIn: r.check_in,
    billDate: r.bill_date,
    invNo: r.inv_no,
    businessSource: r.business_source,
    nights: r.nights ?? 0,
    billsDueFrom: r.bills_due_from,
    roomRevenue: r.room_revenue ?? 0,
    poc: r.poc,
    month: r.month,
  }));

  return { fy, zoneA, zoneB };
}
