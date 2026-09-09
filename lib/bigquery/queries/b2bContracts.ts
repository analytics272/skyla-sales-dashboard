// PRD §6.9 — B2B Contracts. Company-level Nights/Revenue/ADR come from
// `sales_booking` (the PMS — the live, always-current source), joined to
// `b2b_bills` purely for company identity (Bills_due_from) and
// Contract_Status. Grouped by Bills_due_from (per user direction
// 2026-08-24), not Company/Bill_To — Bills_due_from is the operational name
// used to identify which company a bill belongs to (e.g. "Tata Consumer" vs
// the legal entity name "TATA CONSUMER PRODUCTS LIMITED" in Company/Bill_To,
// which are identical to each other in every sampled row).
//
// 2026-09-09, later same day — REWRITTEN from reading Nights/Room_Revenue/
// ADR directly off b2b_bills. That design was wrong per explicit
// PRD-consistent correction: "data should come from PMS, not b2b_bills —
// b2b_bills is only for mapping, because it only captures pending/entered
// bills, but PMS has all the data for these B2B metrics." Concretely wrong
// in two ways, both confirmed live:
// 1. b2b_bills' own Nights/Room_Revenue for April 2026 summed to only
//    ₹1.08 Cr — 75% of the true PMS B2B total for that same month/scope
//    (₹1.44 Cr, matching Booking Category Mix's own B2B figure). The gap
//    is real bookings whose bill either hadn't been fully entered yet or
//    was entered at a different (adjusted/partial) amount than the PMS
//    daily-revenue total.
// 2. BH4's real September B2B revenue (~₹7.83L across 22 folios, confirmed
//    directly in sales_booking) had ZERO matching rows in b2b_bills under
//    ANY Bill_Month/Financial_Year — not mislabeled, genuinely absent,
//    because those bills hadn't been raised yet (b2b_bills' own
//    Overall_Delay/Bill_Submit_Date columns show this is a sheet that
//    tracks bills through a multi-day/week submission-and-payment
//    workflow, not a same-day mirror of PMS activity).
//
// Fix: join sales_booking to b2b_bills on (Property, FolioNo = Folio_No) —
// verified live this key matches cleanly (BH4 FolioNo F2627BHMG9: 3 nights/
// ₹9,000 in sales_booking, exactly Nights=3/Room_Revenue=₹9,000 in
// b2b_bills for the same folio, for an already-billed example) — then sum
// sales_booking's own DailyRevenue/nights, using b2b_bills ONLY for
// Bills_due_from and Contract_Status. b2b_bills is deduplicated to one row
// per (Property, Folio_No) first (ANY_VALUE) before joining: 28 (Property,
// Folio_No) pairs table-wide have duplicate b2b_bills rows (mostly the
// legacy "Hyber-GB" property code, not one of the 5 active properties, plus
// a handful of historical FY24-25/25-26 folios on GB/KDP/HTC) — undeduped,
// those would fan out against sales_booking's one-row-per-night grain and
// silently inflate revenue for the affected folios.
//
// A booking whose bill hasn't been raised in b2b_bills at all simply has no
// company attached yet and drops out of the ranking, same as before — just
// for a narrower and more honest reason (no bill yet, vs. "no bill yet AND
// wrongly bucketed by a billing-workflow month label"). Validated live:
// this join recovers ~99% of April 2026's true PMS B2B revenue (₹1.424 Cr
// of ₹1.44 Cr) as company-mapped, vs. 75% under the old design — the
// unmapped remainder is surfaced explicitly in the UI (BookingsContent.tsx)
// rather than silently vanishing.
//
// getCorporateAccountRetention is untouched and stays b2b_bills-native:
// Contract_Status is a b2b_bills-only concept (sales_booking has no notion
// of a contract), so "which companies had a Contract last FY and still
// appear this FY" is inherently a question about b2b_bills' own records,
// not something a PMS join changes. It also remains un-period-scoped
// (inherently an FY-vs-FY question, same as Booking Pace).
import { runQuery, table } from "../client";
import { safeDivide } from "@/lib/format/currency";
import { DateRange } from "@/lib/reference/financialYear";
import { PeriodFilter, resolvePeriodFromFilter } from "@/lib/reference/period";
import { SALES_BOOKING_STAY_FILTER, roomNightUnitsSqlExpr } from "./filters";

export interface B2bContractRanking {
  company: string; // Bills_due_from
  contractStatus: string | null;
  roomRevenue: number; // SUM(sales_booking.DailyRevenue) for this company's matched folios — PMS, tax-exclusive
  nights: number; // SUM(roomNightUnitsSqlExpr()) — weighted the same way every other nights figure on the dashboard is (BH4's "3 Bedroom Apartments" rows count 3x)
  adr: number | null; // roomRevenue / nights — a weighted average across the company's own folios, not an average of individual bill-level ADRs
  /** Share of TOTAL company-wide sales revenue (B2B+B2C+OTA combined, from sales_booking) this one company's B2B revenue represents — not just its share of the B2B channel. */
  contributionPct: number | null;
}

/** Total revenue across every channel (B2B+B2C+OTA) for the same property+period scope, from sales_booking — the "overall sales revenue" denominator for Contribution %. */
async function getOverallRevenue(properties: string[], range: DateRange): Promise<number> {
  const rows = await runQuery<{ revenue: number | null }>(`
    SELECT SUM(DailyRevenue) AS revenue
    FROM ${table("sales_booking")}
    WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end AND ${SALES_BOOKING_STAY_FILTER}
  `, { properties, start: range.start, end: range.end });
  return rows[0]?.revenue ?? 0;
}

export async function getB2bContractRanking(properties: string[], filter: PeriodFilter): Promise<B2bContractRanking[]> {
  const range = resolvePeriodFromFilter(filter).current;
  const [rows, overallRevenue] = await Promise.all([
    runQuery<{ company: string; contractStatus: string | null; roomRevenue: number | null; nights: number }>(`
      WITH dedup_bills AS (
        -- One row per (Property, Folio_No) — see file header for why.
        SELECT Property, Folio_No, ANY_VALUE(Bills_due_from) AS Bills_due_from, ANY_VALUE(Contract_Status) AS Contract_Status
        FROM ${table("b2b_bills")}
        WHERE Bills_due_from IS NOT NULL AND Financial_Year != 'FY 99-00'
        GROUP BY Property, Folio_No
      )
      SELECT
        b.Bills_due_from AS company,
        ANY_VALUE(b.Contract_Status) AS contractStatus,
        SUM(sb.DailyRevenue) AS roomRevenue,
        SUM(${roomNightUnitsSqlExpr("sb.")}) AS nights
      FROM ${table("sales_booking")} sb
      JOIN dedup_bills b ON sb.Property = b.Property AND sb.FolioNo = b.Folio_No
      WHERE sb.Property IN UNNEST(@properties) AND CAST(sb.StayDate AS DATE) BETWEEN @start AND @end
        AND sb.${SALES_BOOKING_STAY_FILTER}
      GROUP BY company
      ORDER BY roomRevenue DESC
    `, { properties, start: range.start, end: range.end }),
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
