// PRD §6.9 — B2B Contracts (b2b_bills). Grouped by Bills_due_from (per
// user direction 2026-08-24), not Company/Bill_To — Bills_due_from is the
// operational name used to identify which company a bill belongs to (e.g.
// "Tata Consumer" vs the legal entity name "TATA CONSUMER PRODUCTS LIMITED"
// in Company/Bill_To, which are identical to each other in every sampled
// row). b2b_bills is itself PMS/finance-system billing data (invoice
// numbers, GST numbers, payment dates) — its own Room_Revenue/Nights columns
// are used as-is; only the company grouping key changed. Same
// Financial_Year-column trust and 'FY 99-00' junk-row exclusion as
// guestDetail.ts's getB2bByCompany — see that file's comment for why the
// sheet's own column is used instead of a recomputed FY.
import { runQuery, table } from "../client";

export interface B2bContractRanking {
  company: string; // Bills_due_from
  contractStatus: string | null;
  roomRevenue: number; // Room_Revenue — tax-exclusive (col_21 was inclusive-of-tax; see PRD tax-exclusive requirement)
  nights: number;
  /** Share of total Contract_Status='Contract' revenue this company represents. Null for non-contract rows — they aren't part of that pool. */
  contributionPct: number | null;
}

export async function getB2bContractRanking(properties: string[], fys?: string[]): Promise<B2bContractRanking[]> {
  const params: Record<string, unknown> = { properties };
  let fyClause = "";
  if (fys && fys.length > 0) {
    params.fys = fys;
    fyClause = " AND Financial_Year IN UNNEST(@fys)";
  }

  const rows = await runQuery<{ company: string; contractStatus: string | null; roomRevenue: number | null; nights: number }>(`
    SELECT
      Bills_due_from AS company,
      ANY_VALUE(Contract_Status) AS contractStatus,
      SUM(Room_Revenue) AS roomRevenue,
      SUM(Nights) AS nights
    FROM ${table("b2b_bills")}
    WHERE Bills_due_from IS NOT NULL AND Financial_Year != 'FY 99-00' AND Property IN UNNEST(@properties)${fyClause}
    GROUP BY company
    ORDER BY roomRevenue DESC
  `, params);

  const contractTotal = rows
    .filter((r) => r.contractStatus === "Contract")
    .reduce((s, r) => s + (r.roomRevenue ?? 0), 0);

  return rows.map((r) => ({
    company: r.company,
    contractStatus: r.contractStatus,
    roomRevenue: r.roomRevenue ?? 0,
    nights: r.nights,
    contributionPct: r.contractStatus === "Contract" && contractTotal > 0 ? (r.roomRevenue ?? 0) / contractTotal : null,
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
export async function getB2bTopAdrContracts(properties: string[], fys?: string[]): Promise<B2bTopAdrContract[]> {
  const params: Record<string, unknown> = { properties };
  let fyClause = "";
  if (fys && fys.length > 0) {
    params.fys = fys;
    fyClause = " AND Financial_Year IN UNNEST(@fys)";
  }

  // total_nights (not "nights"): BigQuery resolves HAVING identifiers
  // case-insensitively against SELECT aliases first, so an alias merely
  // differing in case from the source column (nights vs Nights) gets matched to
  // its own SUM() aggregate, producing an "aggregation of aggregations" error.
  const rows = await runQuery<{ company: string; avgAdr: number; total_nights: number }>(`
    SELECT Bills_due_from AS company, AVG(ADR) AS avgAdr, SUM(Nights) AS total_nights
    FROM ${table("b2b_bills")}
    WHERE Bills_due_from IS NOT NULL AND Financial_Year != 'FY 99-00' AND Property IN UNNEST(@properties)${fyClause}
    GROUP BY company
    HAVING total_nights > 0
    ORDER BY avgAdr DESC
  `, params);
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
