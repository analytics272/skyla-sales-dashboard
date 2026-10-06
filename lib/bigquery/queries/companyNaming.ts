// SHARED company-name mapping used by every company-based surface that must show
// the SAME name for the same company: Bookings → Company Rankings (b2bContracts.ts)
// and Reports → B2B Details (reports.ts). (Leads' Company Analysis applies the same
// normalization key; it just doesn't prefer the b2b_bills name — see ownerCompanyAnalysis.ts.)
//
// The mapping, as established for Company Rankings (2026-09-17):
//   1. GROUP companies by a NORMALIZED name key — normKeySql(): upper-case, strip periods,
//      collapse whitespace, force a space before "(" — so free-text spelling variants of one
//      real company ("X (Y)" / "X(Y)", "ADP" / "adp") become one company.
//   2. DISPLAY name = COALESCE(MAX(Bills_due_from), the PMS name):
//      b2b_bills.Bills_due_from is the curated, business-recognised company name (e.g. "ACT"
//      for ATRIA CONVERGENCE TECHNOLOGIES LTD). It is looked up per folio through
//      (Property, FolioNo = Folio_No) against b2b_bills, de-duplicated first (below). If ANY
//      folio in the normalized group matched, the whole group shows that name; if none did,
//      the company keeps its ORIGINAL PMS name (sales_company_bills.CompanyName).
// b2b_bills is used here ONLY as a name lookup — never for revenue/nights.
import { table } from "../client";
export { normKeySql } from "@/lib/reference/ownerCompanyMapping";

/** `dedup_bills AS (...)` CTE: one row per (Property, Folio_No), so joining b2b_bills can't fan out (it holds duplicate (Property, Folio_No) rows, mostly the legacy "Hyber-GB" code). Exposes Contract_Status and Bills_due_from. */
export function dedupB2bBillsCte(): string {
  return `dedup_bills AS (
        -- One row per (Property, Folio_No) — mirrors the same dedup this
        -- file has always needed before joining b2b_bills, to avoid
        -- fanning out against a table with duplicate (Property, Folio_No)
        -- rows (confirmed present, mostly the legacy "Hyber-GB" code).
        SELECT Property, Folio_No, ANY_VALUE(Contract_Status) AS Contract_Status, ANY_VALUE(Bills_due_from) AS Bills_due_from
        FROM ${table("b2b_bills")}
        WHERE Financial_Year != 'FY 99-00'
        GROUP BY Property, Folio_No
      )`;
}
