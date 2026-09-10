// "Company Analysis" inside the Leads tab's By Owner Detail card
// (2026-09-10, "Final Dashboard Changes" item 6). For each account owner
// (b2b_bills.POC), what B2B companies did they bring, split by Business
// Source — with every number sourced from PMS (sales_booking), joined to
// b2b_bills ONLY for the POC / Business_Source / company mapping. Same
// join as Company Rankings (see b2bContracts.ts): (Property, FolioNo =
// Folio_No), b2b_bills deduplicated to one row per folio first.
//
// One query returns every owner's full breakdown at once (grouped by POC
// too); the card slices it to the tab's selected owner client-side, so
// switching owners doesn't re-hit BigQuery. Owner names are matched
// case-insensitively with a small alias map (lead_tracker spells one POC
// "Dikhita", b2b_bills spells it "Dikitha").
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter, SALES_BOOKING_STAY_FILTER, roomNightUnitsSqlExpr } from "./filters";
import type { OwnerCompanyRow } from "@/lib/reference/owners";

export type { OwnerCompanyRow } from "@/lib/reference/owners";

export async function getOwnerCompanyAnalysis(filter: KpiFilter): Promise<OwnerCompanyRow[]> {
  const { properties, period } = resolveFilter(filter);
  const rows = await runQuery<{ owner: string | null; business_source: string | null; company: string; revenue: number | null; nights: number }>(`
    WITH dedup_bills AS (
      SELECT Property, Folio_No,
        ANY_VALUE(Bills_due_from) AS company,
        ANY_VALUE(POC) AS poc,
        ANY_VALUE(Business_Source) AS business_source
      FROM ${table("b2b_bills")}
      WHERE Bills_due_from IS NOT NULL AND Financial_Year != 'FY 99-00' AND POC IS NOT NULL
      GROUP BY Property, Folio_No
    )
    SELECT
      b.poc AS owner,
      b.business_source AS business_source,
      b.company AS company,
      SUM(sb.DailyRevenue) AS revenue,
      SUM(${roomNightUnitsSqlExpr("sb.")}) AS nights
    FROM ${table("sales_booking")} sb
    JOIN dedup_bills b ON sb.Property = b.Property AND sb.FolioNo = b.Folio_No
    WHERE sb.Property IN UNNEST(@properties)
      AND CAST(sb.StayDate AS DATE) BETWEEN @start AND @end
      AND sb.${SALES_BOOKING_STAY_FILTER}
    GROUP BY owner, business_source, company
    HAVING revenue > 0
    ORDER BY revenue DESC
  `, { properties, start: period.current.start, end: period.current.end });

  return rows.map((r) => ({
    owner: r.owner ?? "—",
    businessSource: r.business_source ?? "Unspecified",
    company: r.company,
    revenue: r.revenue ?? 0,
    nights: r.nights,
  }));
}
