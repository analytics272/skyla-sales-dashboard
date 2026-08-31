// PRD §6.6 — Leads (lead_tracker). Every query starts from the §2.4 baseline
// filter (WHERE Name IS NOT NULL AND TRIM(Name) != '') — without it every KPI
// here is inflated ~8x by BigQuery-side sync padding (45,282 raw rows vs 5,694
// real). FY/Quarter/Month scoping uses the `date` column (lead capture date,
// confirmed aligned with the sheet's own Month/Month_Number fiscal numbering,
// e.g. calendar August -> Month_Number 5), not Check_in_date_2 (the guest's
// future stay date) — Total/Closed/Conversion Leads are about lead-generation
// activity over time, not the eventual stay.
//
// User-confirmed property remap (2026-08-19): lead_tracker has two Property
// codes outside the 6-property reference table. KOND -> KDP (Kondapur), JH44 ->
// JHS (Jubilee Hills). NULL Property displays as the literal "null" bucket.
import { runQuery, table } from "../client";
import { currentFYLabel, fyLabelSqlExpr, resolveSelectedFYs, resolveSelectedMonths, DateFilter } from "@/lib/reference/financialYear";
import { safeDivide } from "@/lib/format/currency";

const BASELINE_FILTER = "Name IS NOT NULL AND TRIM(Name) != ''";

const PROPERTY_DISPLAY_EXPR = `CASE
  WHEN Property = 'KOND' THEN 'KDP'
  WHEN Property = 'JH44' THEN 'JHS'
  WHEN Property IS NULL THEN 'null'
  ELSE Property
END`;

const TOTAL_EXPR = "SAFE_CAST(REPLACE(Total, ',', '') AS FLOAT64)";

export interface LeadsFilter extends DateFilter {
  properties?: string[]; // matched against the remapped display property
}

function whereForFilter(filter: LeadsFilter): { clause: string; params: Record<string, unknown> } {
  const conditions = [BASELINE_FILTER];
  const params: Record<string, unknown> = {};

  const fys = resolveSelectedFYs(filter);
  params.fys = fys;
  conditions.push(`${fyLabelSqlExpr("date")} IN UNNEST(@fys)`);
  const months = resolveSelectedMonths(filter);
  if (months.length > 0) {
    params.months = months;
    conditions.push("EXTRACT(MONTH FROM date) IN UNNEST(@months)");
  }
  if (filter.properties && filter.properties.length > 0) {
    params.properties = filter.properties;
    conditions.push(`${PROPERTY_DISPLAY_EXPR} IN UNNEST(@properties)`);
  }

  return { clause: conditions.join(" AND "), params };
}

// B2C acquisition channels: Exotel (phone), Business WA (WhatsApp), Website.
// Existing/Reference/Enquiry mail/etc. are tracked as their own separate
// stats (existingClosedLeads, referenceClosedLeads) rather than folded in
// here — every raw lead_tracker.Source value is ultimately a B2C lead (this
// table has no B2B/OTA source at all), but "B2C leads" specifically means
// the new-customer-acquisition channels, matching the existing design.
const B2C_SOURCES_SQL = "Source IN ('Exotel', 'Business WA', 'Website')";

export interface LeadsSummary {
  totalLeads: number;
  closedLeads: number;
  newLeads: number; // Source IN (Exotel, Business WA, Website) — same basis as b2cLeads below
  b2cLeads: number;
  b2cLeadsClosed: number;
  existingClosedLeads: number;
  referenceClosedLeads: number;
  revenue: number;
  conversionRate: number | null;
}

export async function getLeadsSummary(filter: LeadsFilter): Promise<LeadsSummary> {
  const { clause, params } = whereForFilter(filter);
  const rows = await runQuery<{
    total_leads: number;
    closed_leads: number;
    new_leads: number;
    b2c_leads_closed: number;
    existing_closed_leads: number;
    reference_closed_leads: number;
    revenue: number | null;
  }>(`
    SELECT
      COUNT(*) AS total_leads,
      COUNTIF(Stage = 'Closed') AS closed_leads,
      COUNTIF(${B2C_SOURCES_SQL}) AS new_leads,
      COUNTIF(${B2C_SOURCES_SQL} AND Stage = 'Closed') AS b2c_leads_closed,
      COUNTIF(Source = 'Existing' AND Stage = 'Closed') AS existing_closed_leads,
      COUNTIF(Source = 'Reference' AND Stage = 'Closed') AS reference_closed_leads,
      SUM(${TOTAL_EXPR}) AS revenue
    FROM ${table("lead_tracker")}
    WHERE ${clause}
  `, params);

  const r = rows[0] ?? {
    total_leads: 0, closed_leads: 0, new_leads: 0, b2c_leads_closed: 0, existing_closed_leads: 0, reference_closed_leads: 0, revenue: 0,
  };
  return {
    totalLeads: r.total_leads,
    closedLeads: r.closed_leads,
    newLeads: r.new_leads,
    b2cLeads: r.new_leads,
    b2cLeadsClosed: r.b2c_leads_closed,
    existingClosedLeads: r.existing_closed_leads,
    referenceClosedLeads: r.reference_closed_leads,
    revenue: r.revenue ?? 0,
    conversionRate: safeDivide(r.closed_leads, r.total_leads),
  };
}

export interface LeadsMoMPoint {
  monthNumber: number;
  totalLeads: number;
  closedLeads: number;
}

export async function getLeadsMoM(fy: string | undefined, properties?: string[]): Promise<LeadsMoMPoint[]> {
  const resolvedFy = fy ?? currentFYLabel();
  const conditions = [BASELINE_FILTER, `${fyLabelSqlExpr("date")} = @fy`, "Month_Number IS NOT NULL"];
  const params: Record<string, unknown> = { fy: resolvedFy };
  if (properties && properties.length > 0) {
    params.properties = properties;
    conditions.push(`${PROPERTY_DISPLAY_EXPR} IN UNNEST(@properties)`);
  }

  const rows = await runQuery<{ month_number: number; total_leads: number; closed_leads: number }>(`
    SELECT
      Month_Number AS month_number,
      COUNT(*) AS total_leads,
      COUNTIF(Stage = 'Closed') AS closed_leads
    FROM ${table("lead_tracker")}
    WHERE ${conditions.join(" AND ")}
    GROUP BY month_number
    ORDER BY month_number
  `, params);

  return rows.map((r) => ({ monthNumber: r.month_number, totalLeads: r.total_leads, closedLeads: r.closed_leads }));
}

export interface LeadsByGroup {
  key: string;
  count: number;
}

export async function getLeadsByProperty(filter: LeadsFilter): Promise<LeadsByGroup[]> {
  const { clause, params } = whereForFilter(filter);
  const rows = await runQuery<{ key: string; count: number }>(`
    SELECT ${PROPERTY_DISPLAY_EXPR} AS key, COUNT(*) AS count
    FROM ${table("lead_tracker")}
    WHERE ${clause}
    GROUP BY key
    ORDER BY count DESC
  `, params);
  return rows;
}

export async function getLeadsBySource(filter: LeadsFilter): Promise<LeadsByGroup[]> {
  const { clause, params } = whereForFilter(filter);
  const rows = await runQuery<{ key: string | null; count: number }>(`
    SELECT Source AS key, COUNT(*) AS count
    FROM ${table("lead_tracker")}
    WHERE ${clause}
    GROUP BY key
    ORDER BY count DESC
  `, params);
  return rows.map((r) => ({ key: r.key ?? "null", count: r.count }));
}

export interface FormatLeadsRevenue {
  format: string;
  leads: number;
  revenue: number;
}

export async function getFormatLeadsRevenue(filter: LeadsFilter): Promise<FormatLeadsRevenue[]> {
  const { clause, params } = whereForFilter(filter);
  const rows = await runQuery<{ format: string | null; leads: number; revenue: number | null }>(`
    SELECT Format AS format, COUNT(*) AS leads, SUM(${TOTAL_EXPR}) AS revenue
    FROM ${table("lead_tracker")}
    WHERE ${clause}
    GROUP BY format
    ORDER BY leads DESC
  `, params);
  return rows.map((r) => ({ format: r.format ?? "null", leads: r.leads, revenue: r.revenue ?? 0 }));
}

export interface AdrByFormat {
  format: string;
  adr: number | null;
}

export async function getAdrByFormat(filter: LeadsFilter): Promise<AdrByFormat[]> {
  const { clause, params } = whereForFilter(filter);
  const rows = await runQuery<{ format: string | null; total: number | null; nights: number | null }>(`
    SELECT Format AS format, SUM(${TOTAL_EXPR}) AS total, SUM(No_of_nights) AS nights
    FROM ${table("lead_tracker")}
    WHERE ${clause} AND Stage = 'Closed'
    GROUP BY format
  `, params);
  return rows.map((r) => ({ format: r.format ?? "null", adr: safeDivide(r.total ?? 0, r.nights ?? 0) }));
}

export interface LostLeadReason {
  stage: string;
  count: number;
}

export async function getLostLeadReasons(filter: LeadsFilter): Promise<LostLeadReason[]> {
  const { clause, params } = whereForFilter(filter);
  // "Not Intersted" typo variant folded into "Not Interested" per §2.4.
  const rows = await runQuery<{ stage: string | null; count: number }>(`
    SELECT
      CASE WHEN Stage = 'Not Intersted' THEN 'Not Interested' ELSE Stage END AS stage,
      COUNT(*) AS count
    FROM ${table("lead_tracker")}
    WHERE ${clause} AND (Stage IS NULL OR Stage != 'Closed')
    GROUP BY stage
    ORDER BY count DESC
  `, params);
  return rows.map((r) => ({ stage: r.stage ?? "(open/in-progress)", count: r.count }));
}

export async function getBookingPace(filter: LeadsFilter): Promise<number | null> {
  const { clause, params } = whereForFilter(filter);
  const rows = await runQuery<{ avg_pace: number | null }>(`
    SELECT AVG(Booking_Pace) AS avg_pace
    FROM ${table("lead_tracker")}
    WHERE ${clause}
  `, params);
  return rows[0]?.avg_pace ?? null;
}

// --- Leads by Owner (lead_tracker.Owner) ---
// `Owner` is meant to be the employee/department a lead is assigned to, but
// the raw data also has lead-source values leaking into it ("Business WA",
// "Website", "Walk in"/"walk in") — confirmed by inspecting distinct Owner
// values live (2026-08-25): 5 real names (Anjali, Rajesh, Dikhita, Sajal,
// Bhanu) plus those 3 source-like entries. Excluded here so this view stays
// employee-level, matching its purpose — "Leads by source" (a different
// chart, `getLeadsBySource` below) is where those channel names belong.
const OWNER_EXCLUDE_SQL = "LOWER(TRIM(Owner)) NOT IN ('business wa', 'website', 'walk in')";

export interface OwnerLeadStats {
  owner: string;
  revenue: number;
  totalLeads: number;
  closedLeads: number;
  closedPct: number | null;
  exotelLeads: number;
  exotelClosed: number;
  referenceLeads: number;
  existingLeads: number;
  adr: number | null;
}

export interface OwnerLeadStatsResult {
  rows: OwnerLeadStats[];
  /** Grand total row — computed from the true underlying summed counts/revenue, not by averaging each owner's own closedPct/ADR (which would misrepresent the combined figure across owners with very different lead volumes). */
  total: OwnerLeadStats;
}

export async function getLeadsByOwner(filter: LeadsFilter): Promise<OwnerLeadStatsResult> {
  const { clause, params } = whereForFilter(filter);
  const rawRows = await runQuery<{
    owner: string | null;
    revenue: number | null;
    total_leads: number;
    closed_leads: number;
    exotel_leads: number;
    exotel_closed: number;
    reference_leads: number;
    existing_leads: number;
    closed_nights: number | null;
  }>(`
    SELECT
      Owner AS owner,
      SUM(${TOTAL_EXPR}) AS revenue,
      COUNT(*) AS total_leads,
      COUNTIF(Stage = 'Closed') AS closed_leads,
      COUNTIF(Source = 'Exotel') AS exotel_leads,
      COUNTIF(Source = 'Exotel' AND Stage = 'Closed') AS exotel_closed,
      COUNTIF(Source = 'Reference') AS reference_leads,
      COUNTIF(Source = 'Existing') AS existing_leads,
      SUM(CASE WHEN Stage = 'Closed' THEN No_of_nights ELSE 0 END) AS closed_nights
    FROM ${table("lead_tracker")}
    WHERE ${clause} AND ${OWNER_EXCLUDE_SQL}
    GROUP BY owner
    ORDER BY revenue DESC
  `, params);

  const rows = rawRows.map((r) => ({
    owner: r.owner ?? "null",
    revenue: r.revenue ?? 0,
    totalLeads: r.total_leads,
    closedLeads: r.closed_leads,
    closedPct: safeDivide(r.closed_leads, r.total_leads),
    exotelLeads: r.exotel_leads,
    exotelClosed: r.exotel_closed,
    referenceLeads: r.reference_leads,
    existingLeads: r.existing_leads,
    adr: safeDivide(r.revenue ?? 0, r.closed_nights ?? 0),
  }));

  const sum = (f: (r: (typeof rawRows)[number]) => number | null) => rawRows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const totalRevenue = sum((r) => r.revenue);
  const totalLeads = sum((r) => r.total_leads);
  const totalClosedLeads = sum((r) => r.closed_leads);
  const totalClosedNights = sum((r) => r.closed_nights);
  const total: OwnerLeadStats = {
    owner: "Grand total",
    revenue: totalRevenue,
    totalLeads,
    closedLeads: totalClosedLeads,
    closedPct: safeDivide(totalClosedLeads, totalLeads),
    exotelLeads: sum((r) => r.exotel_leads),
    exotelClosed: sum((r) => r.exotel_closed),
    referenceLeads: sum((r) => r.reference_leads),
    existingLeads: sum((r) => r.existing_leads),
    adr: safeDivide(totalRevenue, totalClosedNights),
  };

  return { rows, total };
}
