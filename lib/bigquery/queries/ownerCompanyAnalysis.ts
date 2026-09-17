// "Company Analysis" inside the Leads tab's By Owner Detail card
// (2026-09-10/11, "Final Dashboard Changes" item 6).
//
// 2026-09-11 — REWRITTEN to source from `company_revenue_summary` (a view
// over the new `sales_company_bills` table) instead of `b2b_bills`, per the
// user's own build spec. This replaces the b2b_bills-based join entirely —
// `sales_company_bills` is a cleaner, FRESHER company-billing extract:
// verified live its data reaches through today (11 Sept 2026 — b2b_bills
// had zero Sep 26 rows at all), and it already carries a proper
// CompanyId/CompanyName, not just a billing-sheet free-text field.
//
// Two things confirmed live that the build spec called out as open
// questions:
// 1. OTA business-source values genuinely appear here too (Agoda, Go-MMT,
//    Expedia, Cleartrip, ...) — not filtered out, classified like
//    everything else via the existing `bookingCategorySqlExpr`
//    (§1.3's B2B/B2C/OTA classifier, reused as directed rather than
//    duplicated).
// 2. "Mayrakhee Hospitality" (spelled "MAYRAHKEE HOSPITALITY" here) and
//    "Blue Orange Hospitality" — the two companies asked for repeatedly
//    this session, absent from every PMS/b2b_bills table checked earlier
//    — DO exist in `sales_company_bills`, at HTC. Both are
//    `BusinessSource = 'Relocation (B2C)'`, which `bookingCategorySqlExpr`
//    classifies B2C, not B2B. That's WHY they never surfaced in a
//    B2B-only view: they're real, just genuinely B2C-sourced, not an
//    "unmapped" gap. This query doesn't filter by category, so both now
//    appear in the Company Analysis table/donut like any other company.
//
// Owner: LEFT JOIN `company_owner_map` (CompanyId -> Owner). That table is
// currently EMPTY (confirmed live, 0 rows) — every row's owner comes back
// null, mapped to "Unassigned" below. The UI (LeadsContent.tsx) shows
// "Unassigned" rows under every owner tab for now, since there's no real
// per-owner split to filter by yet; once company_owner_map is populated,
// filtering starts working with zero code changes here (still just a
// LEFT JOIN + COALESCE).
//
// Contribution %: computed client-side in LeadsContent.tsx, scoped to
// whichever Business Source the user has clicked (or "all sources" when
// none is selected) — not as a fixed SQL window function. The build spec's
// suggested `SUM(...) OVER (PARTITION BY ClassifiedCategory, FinancialYear)`
// would only support ONE fixed grouping; the actual UI already lets a user
// toggle between "all sources" and one clicked source, which a client-side
// recompute over the (small, already-fetched) per-owner row set handles
// more flexibly without a second query shape.
//
// `MonthStart` is calendar-month grain (the view's own aggregation grain),
// so scoping to a mid-month custom range still only resolves to whole
// months touched — the same inherent limitation the old b2b_bills' `Month`
// column had.
import { runQuery, table } from "../client";
import { KpiFilter, resolveFilter } from "./filters";
import { bookingCategorySqlExpr } from "@/lib/reference/bookingSourceMap";
import type { OwnerCompanyRow } from "@/lib/reference/owners";

export type { OwnerCompanyRow } from "@/lib/reference/owners";

export async function getOwnerCompanyAnalysis(filter: KpiFilter): Promise<OwnerCompanyRow[]> {
  const { properties, period } = resolveFilter(filter);
  // 2026-09-17: same free-text CompanyName dedup as b2bContracts.ts's
  // Company Rankings fix (see that file's header comment for the full
  // story — confirmed live duplicates here too, e.g. Synergy split across
  // "LIMITED (Subsidiary..." / "LIMITED(Subsidiary..." under the same
  // owner+source+category). No b2b_bills join here by design (this card
  // stays fully PMS-sourced), so only the text-normalization layer
  // applies, not the Bills_due_from name preference.
  //
  // The canonical display name is picked in its OWN CTE (`canonical`,
  // keyed by normKey across the WHOLE result set) rather than per
  // (owner, source, category) bucket. Picking it per-bucket (ANY_VALUE
  // grouped with the rest) would let the same real company get a
  // different display string in different buckets — e.g. one raw variant
  // showing up for "Relocation (B2B)" and a different one for "Corporate
  // Sales" — which would silently defeat LeadsContent.tsx's client-side
  // merge-by-company-name across sources (drillTable's `reduce` keys off
  // this exact string). Computing one canonical name globally first
  // guarantees every bucket for the same normalized company gets the
  // identical display string.
  const rows = await runQuery<{ owner: string | null; business_source: string; category: string; company: string; revenue: number | null; nights: number }>(`
    WITH per_row AS (
      SELECT
        m.Owner AS owner,
        c.BusinessSource AS business_source,
        ${bookingCategorySqlExpr("c.BusinessSource")} AS category,
        c.CompanyName AS raw_company,
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(c.CompanyName), r'\\.', ''), r'\\s*\\(', ' ('), r'\\s+', ' ')) AS normKey,
        c.TotalRevenue AS revenue,
        c.TotalNights AS nights
      FROM ${table("company_revenue_summary")} c
      LEFT JOIN ${table("company_owner_map")} m ON c.CompanyId = m.CompanyId
      WHERE c.Property IN UNNEST(@properties)
        AND c.MonthStart BETWEEN DATE_TRUNC(@start, MONTH) AND DATE_TRUNC(@end, MONTH)
    ),
    canonical AS (
      SELECT normKey, MIN(raw_company) AS company
      FROM per_row
      GROUP BY normKey
    )
    SELECT
      p.owner AS owner,
      p.business_source AS business_source,
      p.category AS category,
      can.company AS company,
      SUM(p.revenue) AS revenue,
      SUM(p.nights) AS nights
    FROM per_row p
    JOIN canonical can ON p.normKey = can.normKey
    GROUP BY owner, business_source, category, company
    HAVING revenue > 0
    ORDER BY revenue DESC
  `, { properties, start: period.current.start, end: period.current.end });

  return rows.map((r) => ({
    owner: r.owner ?? "Unassigned",
    businessSource: r.business_source,
    category: r.category as OwnerCompanyRow["category"],
    company: r.company,
    revenue: r.revenue ?? 0,
    nights: r.nights,
  }));
}
