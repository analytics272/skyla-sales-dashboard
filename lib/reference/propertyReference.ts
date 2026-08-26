// PRD §3.3 / Reference Data §1 — property brand/room-count reference.
//
// Active windows are NOT hardcoded here. User-confirmed decision: Available Room
// Nights must be scoped to each property's *actual* empirical MIN/MAX(StayDate) in
// sales_booking + sales_booking_cancelled (not a documented "added mid-2026"-style
// date, which real data contradicted for GB). See lib/bigquery/queries/propertyWindows.ts.
//
// Known gap (user-confirmed 2026-08-19, "known pipeline gap — build it anyway"):
// BH4 currently has ZERO rows in sales_booking/sales_booking_cancelled, despite
// being Active. Stay-based KPIs (§6.1-6.4) will render as zero/blank for it until
// the eZee sync backfills. B2B/Leads/Reviews KPIs are unaffected since those
// tables do have BH4 rows.
//
// LP re-activated 2026-08-26 per the LP Integration PRD Addendum
// (Skyla_Sales_Dashboard_PRD_LP_Addendum.md): LP is permanently retired and has
// no PMS API key, so it has zero rows in sales_booking/sales_booking_cancelled
// (unaffected by the "removed" flip — those queries just correctly get 0 rows
// for it, i.e. "silently absent"). Its real historical data lives at monthly
// grain in sales_booking_lp_monthly / sales_booking_lp_monthly_roomtype, merged
// in explicitly by overview.ts/trends.ts/brandCategory.ts (see the addendum
// §5 for exactly which KPIs LP does and doesn't participate in) and by
// getPropertyActiveWindows() below (propertyWindows.ts) for availability.
// "active" here just means "a currently reportable property, selectable in
// the Property filter" — not "operating."

export type Brand = "Skyla" | "Aptly" | "Hyber";
export type PropertyStatus = "active" | "removed";

export interface PropertyRef {
  code: string;
  name: string;
  brand: Brand;
  roomCount: number;
  status: PropertyStatus;
}

export const PROPERTIES: PropertyRef[] = [
  { code: "KDP", name: "KDP", brand: "Skyla", roomCount: 63, status: "active" },
  { code: "HTC", name: "HTC", brand: "Skyla", roomCount: 34, status: "active" },
  { code: "JHS", name: "JHS", brand: "Skyla", roomCount: 33, status: "active" },
  { code: "BH4", name: "BH4", brand: "Aptly", roomCount: 18, status: "active" },
  { code: "LP", name: "LP", brand: "Aptly", roomCount: 16, status: "active" },
  { code: "GB", name: "GB", brand: "Hyber", roomCount: 21, status: "active" },
];

export const PROPERTY_BY_CODE: Record<string, PropertyRef> = Object.fromEntries(
  PROPERTIES.map((p) => [p.code, p])
);

/** Properties valid in current/future filters. */
export const ACTIVE_PROPERTY_CODES = PROPERTIES.filter((p) => p.status === "active").map(
  (p) => p.code
);

/** All property codes with a room-count (currently identical to ACTIVE_PROPERTY_CODES — kept as a separate export since call sites use it for "including any historically-relevant property" intent). */
export const ALL_PROPERTY_CODES = PROPERTIES.map((p) => p.code);

export const BRANDS: Brand[] = ["Skyla", "Aptly", "Hyber"];

export function brandOf(propertyCode: string): Brand | undefined {
  return PROPERTY_BY_CODE[propertyCode]?.brand;
}

export function roomCountOf(propertyCode: string): number | undefined {
  return PROPERTY_BY_CODE[propertyCode]?.roomCount;
}
