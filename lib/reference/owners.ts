// Account-owner (b2b_bills.POC) helpers — pure, no BigQuery import, so
// client components can use them (2026-09-10).

export interface OwnerCompanyRow {
  owner: string; // company_owner_map.Owner, or "Unassigned" (that table is currently empty)
  businessSource: string; // raw BusinessSource (e.g. "Corporate Sales", "Relocation (B2C)", "Agoda")
  /** B2B/B2C/OTA classification of businessSource via the shared bookingCategorySqlExpr — not used to filter, just carried through for a future badge/filter if wanted. */
  category: "B2B" | "B2C" | "OTA";
  company: string;
  revenue: number;
  nights: number;
}

/** lead_tracker Owner spelling -> b2b_bills POC spelling, both lowercased. */
export const OWNER_ALIASES: Record<string, string> = {
  dikhita: "dikitha",
};

export function canonicalOwner(name: string): string {
  const k = name.trim().toLowerCase();
  return OWNER_ALIASES[k] ?? k;
}
