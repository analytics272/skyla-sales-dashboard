// PRD §6.9 — B2B Contracts (b2b_bills). Same Financial_Year-column trust and
// 'FY 99-00' junk-row exclusion as guestDetail.ts's getB2bByCompany — see that
// file's comment for why the sheet's own column is used instead of a recomputed FY.
import { runQuery, table } from "../client";

export interface B2bContractRanking {
  company: string;
  contractStatus: string | null;
  roomChargesWithTax: number; // col_21
  nights: number;
}

export async function getB2bContractRanking(fys?: string[]): Promise<B2bContractRanking[]> {
  const params: Record<string, unknown> = {};
  let fyClause = "";
  if (fys && fys.length > 0) {
    params.fys = fys;
    fyClause = " AND Financial_Year IN UNNEST(@fys)";
  }

  return runQuery<B2bContractRanking>(`
    SELECT
      Company AS company,
      ANY_VALUE(Contract_Status) AS contractStatus,
      SUM(col_21) AS roomChargesWithTax,
      SUM(Nights) AS nights
    FROM ${table("b2b_bills")}
    WHERE Company IS NOT NULL AND Financial_Year != 'FY 99-00'${fyClause}
    GROUP BY company
    ORDER BY roomChargesWithTax DESC
  `, params);
}

export interface B2bTopAdrContract {
  company: string;
  avgAdr: number;
  nights: number;
}

/** Ranked by AVG(ADR), filtered to meaningful volume (Nights > 0) per PRD. */
export async function getB2bTopAdrContracts(fys?: string[]): Promise<B2bTopAdrContract[]> {
  const params: Record<string, unknown> = {};
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
    SELECT Company AS company, AVG(ADR) AS avgAdr, SUM(Nights) AS total_nights
    FROM ${table("b2b_bills")}
    WHERE Company IS NOT NULL AND Financial_Year != 'FY 99-00'${fyClause}
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
export async function getCorporateAccountRetention(): Promise<RetentionPoint[]> {
  const fyRows = await runQuery<{ fy: string }>(`
    SELECT DISTINCT Financial_Year AS fy
    FROM ${table("b2b_bills")}
    WHERE Financial_Year != 'FY 99-00' AND Company IS NOT NULL
    ORDER BY fy
  `);
  const fys = fyRows.map((r) => r.fy).sort(); // "FY 24-25" < "FY 25-26" < "FY 26-27" sorts correctly as text

  const points: RetentionPoint[] = [];
  for (let i = 0; i < fys.length - 1; i++) {
    const fromFy = fys[i];
    const toFy = fys[i + 1];

    const rows = await runQuery<{ companies_from: number; retained: number }>(`
      WITH from_companies AS (
        SELECT DISTINCT Company
        FROM ${table("b2b_bills")}
        WHERE Financial_Year = @fromFy AND Company IS NOT NULL AND Contract_Status = 'Contract'
      ),
      to_companies AS (
        SELECT DISTINCT Company
        FROM ${table("b2b_bills")}
        WHERE Financial_Year = @toFy AND Company IS NOT NULL
      )
      SELECT
        (SELECT COUNT(*) FROM from_companies) AS companies_from,
        (SELECT COUNT(*) FROM from_companies f WHERE f.Company IN (SELECT Company FROM to_companies)) AS retained
    `, { fromFy, toFy });

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
