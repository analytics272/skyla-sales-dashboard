// PRD §6.9 — Company Contracts / Company Rankings (Bookings tab).
//
// 2026-09-11 — REWRITTEN onto `sales_company_bills` (the new PMS
// company-billing table — see ownerCompanyAnalysis.ts for the full
// data-source writeup: it reaches through TODAY, unlike `b2b_bills` which
// had zero Sep 26 rows at all). Queries the base table directly, not the
// `company_revenue_summary` view, specifically so day-level `BillDate` is
// available to filter the exact selected range (the view only exposes
// month-truncated `MonthStart`) and so `FolioNo` is available to join.
//
// Per explicit user direction ("just mapping and status u can use b2b
// bills except that every data is from pms for this"): every NUMBER
// (Revenue/Nights/ADR/Contribution %) comes from `sales_company_bills`;
// `b2b_bills` is used ONLY for `Contract_Status` (the green/amber "under
// contract" colouring — a concept that exists only in b2b_bills, no PMS
// equivalent), joined on (Property, FolioNo = Folio_No), the same key
// that matched cleanly for the earlier sales_booking-based join. Verified
// live: 370/412 (90%) of April 2026's sales_company_bills rows found a
// Contract_Status via this join.
//
// 2026-09-17 — BROADENED from B2B-only to B2B + B2C, per explicit user
// direction ("Company Rankings = all companies (B2B + B2C), same
// underlying company population as By Owner Detail"). OTA stays excluded
// deliberately — this dashboard already has a dedicated OTA Breakdown
// card, and Contract_Status (the whole point of the donut/colouring on
// this card's Revenue tab) is a B2B/B2C client-relationship concept, not
// an OTA-channel one. Reuses the existing `bookingCategorySqlExpr` on
// `BusinessSource` — same classifier as everywhere else on the
// dashboard, not duplicated.
//
// getCorporateAccountRetention is UNTOUCHED and stays b2b_bills-native —
// "which companies had a Contract last FY and still appear this FY" is
// inherently a question about b2b_bills' own records. Not part of this ask.
import { runQuery, table } from "../client";
import { safeDivide } from "@/lib/format/currency";
import { DateRange } from "@/lib/reference/financialYear";
import { PeriodFilter, resolvePeriodFromFilter } from "@/lib/reference/period";
import { SALES_BOOKING_STAY_FILTER } from "./filters";
import { bookingCategorySqlExpr } from "@/lib/reference/bookingSourceMap";

export interface B2bContractRanking {
  company: string; // sales_company_bills.CompanyName
  contractStatus: string | null; // b2b_bills.Contract_Status, joined by (Property, FolioNo) — "Contract" | "No Contract" | null (no match found — expected for every B2C row, and any B2B row not yet in b2b_bills)
  roomRevenue: number; // SUM(RoomRevenueExclTax) for this company, B2B+B2C-classified BusinessSource only (OTA excluded) — PMS, tax-exclusive
  nights: number; // SUM(Nights)
  adr: number | null; // roomRevenue / nights — a weighted average across the company's own bills
  /** Share of TOTAL company-wide sales revenue (B2B+B2C+OTA combined, from sales_booking) this one company's revenue represents — not just its share of the B2B+B2C channels. */
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
        -- One row per (Property, Folio_No) — mirrors the same dedup this
        -- file has always needed before joining b2b_bills, to avoid
        -- fanning out against a table with duplicate (Property, Folio_No)
        -- rows (confirmed present, mostly the legacy "Hyber-GB" code).
        SELECT Property, Folio_No, ANY_VALUE(Contract_Status) AS Contract_Status
        FROM ${table("b2b_bills")}
        WHERE Financial_Year != 'FY 99-00'
        GROUP BY Property, Folio_No
      )
      SELECT
        c.CompanyName AS company,
        ANY_VALUE(b.Contract_Status) AS contractStatus,
        SUM(c.RoomRevenueExclTax) AS roomRevenue,
        SUM(c.Nights) AS nights
      FROM ${table("sales_company_bills")} c
      LEFT JOIN dedup_bills b ON c.Property = b.Property AND c.FolioNo = b.Folio_No
      WHERE c.Property IN UNNEST(@properties)
        AND c.BillDate BETWEEN @start AND @end
        AND ${bookingCategorySqlExpr("c.BusinessSource")} IN ('B2B', 'B2C')
      GROUP BY company
      HAVING roomRevenue > 0
      ORDER BY roomRevenue DESC
    `, { properties, start: range.start, end: range.end }),
    getOverallRevenue(properties, range),
  ]);

  // Each company's share of TOTAL company-wide sales revenue — B2B + B2C +
  // OTA combined (from sales_booking, the PMS source), not just this
  // company's slice of the B2B+B2C channels — per user direction 2026-08-24.
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
