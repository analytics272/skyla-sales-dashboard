// Account-owner (b2b_bills.POC) helpers — pure, no BigQuery import, so
// client components can use them (2026-09-10).

export interface OwnerCompanyRow {
  owner: string; // b2b_bills.POC
  businessSource: string;
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
