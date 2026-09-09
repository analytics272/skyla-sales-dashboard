// PRD §6.9 — B2B Contracts (b2b_bills). Grouped by Bills_due_from (per
// user direction 2026-08-24), not Company/Bill_To — Bills_due_from is the
// operational name used to identify which company a bill belongs to (e.g.
// "Tata Consumer" vs the legal entity name "TATA CONSUMER PRODUCTS LIMITED"
// in Company/Bill_To, which are identical to each other in every sampled
// row). b2b_bills is itself PMS/finance-system billing data (invoice
// numbers, GST numbers, payment dates) — its own Room_Revenue/Nights columns
// are used as-is; only the company grouping key changed. Same
// Financial_Year-column trust and 'FY 99-00' junk-row exclusion used
// throughout this file: the sheet's own Financial_Year column is trusted
// instead of a recomputed one (sample data showed a Check_In date that would
// compute to a different FY than the sheet's own label — the sheet's own
// convention for this table is authoritative).
//
// This is the single B2B-by-company view (nights, revenue, ADR, contract
// status, contribution %) — there used to be a second, separate "Nights /
// Revenue / ADR by Company" table (guestDetail.ts's getB2bByCompany) showing
// the same underlying numbers with different columns; merged into this one
// to avoid two redundant company tables on the same dashboard tab.
import { runQuery, table } from "../client";
import { safeDivide } from "@/lib/format/currency";
import { currentFYLabel, DateRange } from "@/lib/reference/financialYear";
import { PeriodFilter, resolvePeriodFromFilter } from "@/lib/reference/period";
import { SALES_BOOKING_STAY_FILTER } from "./filters";

/**
 * b2b_bills is keyed by its own Financial_Year STRING column, not a date
 * column (and per HANDOVER, that column uses a slightly different FY-boundary
 * convention than the standard Apr-Mar rule — trusted as-is, not recomputed).
 * So instead of a date-range filter, the active period tab resolves to a
 * single governing FY label the same way Targets does: the FY containing
 * period.current.start ("Today"/"This FY" -> the current FY, "Last Year" ->
 * the prior completed FY).
 */
export function resolveB2bFy(filter: PeriodFilter): string {
  const p = resolvePeriodFromFilter(filter);
  return currentFYLabel(new Date(`${p.current.start}T00:00:00`));
}

// 2026-09-09: b2b_bills ALSO carries its own `Month` STRING column
// ("Apr 26", "Sep 26", ...) — the FY-only scoping above was a deliberate
// simplification when this file was first written ("no date column to
// range-filter on"), but per explicit "everything should follow filters"
// direction, Company Rankings/Revenue By Company should narrow to the
// active period the same way every other KPI does, not always show the
// whole FY regardless of a "This Month" selection. `monthLabelsInRange`
// converts the period's own date range into the "Mon YY" labels it touches,
// matching this column's exact format, so `getB2bContractRanking`/
// `getB2bTopAdrContracts` below can add `Month IN UNNEST(@months)` on top
// of the existing (still-trusted) `Financial_Year` match. `this_fy` itself
// still resolves to every month in the FY (a no-op narrowing, same as
// today), so nothing changes for that tab specifically — only narrower
// tabs (This Month, Last 7/30 Days, Custom Range) are affected.
// getCorporateAccountRetention is untouched — it's inherently an FY-vs-FY
// comparison, "retention for just September" isn't a coherent question the
// same way "Booking Pace for just September" wasn't earlier this project.
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabelsInRange(range: DateRange): string[] {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const labels: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    labels.push(`${MONTH_ABBR[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(-2)}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return labels;
}

export interface B2bContractRanking {
  company: string; // Bills_due_from
  contractStatus: string | null;
  roomRevenue: number; // Room_Revenue — tax-exclusive (col_21 was inclusive-of-tax; see PRD tax-exclusive requirement)
  nights: number;
  adr: number | null;
  /** Share of TOTAL company-wide sales revenue (B2B+B2C+OTA combined, from sales_booking) this one company's B2B revenue represents — not just its share of the B2B channel. */
  contributionPct: number | null;
}

/** Total revenue across every channel (B2B+B2C+OTA) for the same property+period scope, from sales_booking — the "overall sales revenue" denominator for Contribution %. sales_booking has real dates, so this narrows to the exact selected range (not just the governing FY), same as every other revenue figure on the dashboard. */
async function getOverallRevenue(properties: string[], range: DateRange): Promise<number> {
  const rows = await runQuery<{ revenue: number | null }>(`
    SELECT SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end AND ${SALES_BOOKING_STAY_FILTER}
  `, { properties, start: range.start, end: range.end });
  return rows[0]?.revenue ?? 0;
}

export async function getB2bContractRanking(properties: string[], filter: PeriodFilter): Promise<B2bContractRanking[]> {
  const fy = resolveB2bFy(filter);
  const range = resolvePeriodFromFilter(filter).current;
  const months = monthLabelsInRange(range);
  const [rows, overallRevenue] = await Promise.all([
    runQuery<{ company: string; contractStatus: string | null; roomRevenue: number | null; nights: number }>(`
      SELECT
        Bills_due_from AS company,
        ANY_VALUE(Contract_Status) AS contractStatus,
        SUM(Room_Revenue) AS roomRevenue,
        SUM(Nights) AS nights
      FROM ${table("b2b_bills")}
      WHERE Bills_due_from IS NOT NULL AND Financial_Year != 'FY 99-00'
        AND Property IN UNNEST(@properties) AND Financial_Year = @fy AND Month IN UNNEST(@months)
      GROUP BY company
      ORDER BY roomRevenue DESC
    `, { properties, fy, months }),
    getOverallRevenue(properties, range),
  ]);

  // Each company's share of TOTAL company-wide sales revenue — B2B + B2C +
  // OTA combined (from sales_booking, the PMS source), not just this
  // company's slice of the B2B channel — per user direction 2026-08-24.
  return rows.map((r) => ({
    company: r.company,
    contractStatus: r.contractStatus,
    roomRevenue: r.roomRevenue ?? 0,
    adr: safeDivide(r.roomRevenue ?? 0, r.nights),
    nights: r.nights,
    contributionPct: overallRevenue > 0 ? (r.roomRevenue ?? 0) / overallRevenue : null,
  }));
}

export interface B2bContractSummary {
  /** Revenue achieved through active contracts only (Contract_Status = 'Contract') — not total company revenue across every status. */
  totalContractRevenue: number;
  contractCompanyCount: number;
}

/** Derived from an already-fetched ranking list — no extra BigQuery round trip. */
export function summarizeB2bContracts(ranking: B2bContractRanking[]): B2bContractSummary {
  const contractRows = ranking.filter((r) => r.contractStatus === "Contract");
  return {
    totalContractRevenue: contractRows.reduce((s, r) => s + r.roomRevenue, 0),
    contractCompanyCount: contractRows.length,
  };
}

export interface B2bTopAdrContract {
  company: string; // Bills_due_from
  avgAdr: number;
  nights: number;
}

/** Ranked by AVG(ADR), filtered to meaningful volume (Nights > 0) per PRD. */
export async function getB2bTopAdrContracts(properties: string[], filter: PeriodFilter): Promise<B2bTopAdrContract[]> {
  const fy = resolveB2bFy(filter);
  const months = monthLabelsInRange(resolvePeriodFromFilter(filter).current);
  // total_nights (not "nights"): BigQuery resolves HAVING identifiers
  // case-insensitively against SELECT aliases first, so an alias merely
  // differing in case from the source column (nights vs Nights) gets matched to
  // its own SUM() aggregate, producing an "aggregation of aggregations" error.
  const rows = await runQuery<{ company: string; avgAdr: number; total_nights: number }>(`
    SELECT Bills_due_from AS company, AVG(ADR) AS avgAdr, SUM(Nights) AS total_nights
    FROM ${table("b2b_bills")}
    WHERE Bills_due_from IS NOT NULL AND Financial_Year != 'FY 99-00'
      AND Property IN UNNEST(@properties) AND Financial_Year = @fy AND Month IN UNNEST(@months)
    GROUP BY company
    HAVING total_nights > 0
    ORDER BY avgAdr DESC
  `, { properties, fy, months });
  return rows.map((r) => ({ company: r.company, avgAdr: r.avgAdr, nights: r.total_nights }));
}

export interface RetentionPoint {
  fromFy: string;
  toFy: string;
  companiesInFromFy: number;
  retainedCompanies: number;
  retentionPct: number | null;
}

/**
 * Corporate Account Retention: for each pair of consecutive FYs present in the
 * data, the share of Contract_Status='Contract' companies from the earlier FY
 * that also appear (with any Contract_Status) as B2B customers in the later FY.
 */
export async function getCorporateAccountRetention(properties: string[]): Promise<RetentionPoint[]> {
  const fyRows = await runQuery<{ fy: string }>(`
    SELECT DISTINCT Financial_Year AS fy
    FROM ${table("b2b_bills")}
    WHERE Financial_Year != 'FY 99-00' AND Bills_due_from IS NOT NULL AND Property IN UNNEST(@properties)
    ORDER BY fy
  `, { properties });
  const fys = fyRows.map((r) => r.fy).sort(); // "FY 24-25" < "FY 25-26" < "FY 26-27" sorts correctly as text

  const points: RetentionPoint[] = [];
  for (let i = 0; i < fys.length - 1; i++) {
    const fromFy = fys[i];
    const toFy = fys[i + 1];

    const rows = await runQuery<{ companies_from: number; retained: number }>(`
      WITH from_companies AS (
        SELECT DISTINCT Bills_due_from
        FROM ${table("b2b_bills")}
        WHERE Financial_Year = @fromFy AND Bills_due_from IS NOT NULL AND Contract_Status = 'Contract' AND Property IN UNNEST(@properties)
      ),
      to_companies AS (
        SELECT DISTINCT Bills_due_from
        FROM ${table("b2b_bills")}
        WHERE Financial_Year = @toFy AND Bills_due_from IS NOT NULL AND Property IN UNNEST(@properties)
      )
      SELECT
        (SELECT COUNT(*) FROM from_companies) AS companies_from,
        (SELECT COUNT(*) FROM from_companies f WHERE f.Bills_due_from IN (SELECT Bills_due_from FROM to_companies)) AS retained
    `, { fromFy, toFy, properties });

    const r = rows[0] ?? { companies_from: 0, retained: 0 };
    points.push({
      fromFy,
      toFy,
      companiesInFromFy: r.companies_from,
      retainedCompanies: r.retained,
      retentionPct: r.companies_from > 0 ? r.retained / r.companies_from : null,
    });
  }
  return points;
}
