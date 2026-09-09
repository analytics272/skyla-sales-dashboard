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

// 2026-09-08: KDP corrected 63 -> 64. The FY27 planning workbook (see
// propertyTargets.ts's own header comment) used 63 and this file matched it
// to cross-check the workbook's column order — but the live PMS Annual Sales
// Report (annualsalesreport_skyla, user-provided 2026-09-08) shows KDP's
// "Rooms Available" as 1920/1984/1792 across every one of its 12 months
// (Sep 2026 - Aug 2027), which is 64 rooms x days-in-month in every single
// case, not 63. roomCountOf() drives live Available Room Nights (Occupancy%,
// ADR, RevPAR) sourced from sales_booking — it should match the PMS's actual
// physical room count, not the planning workbook's. This does NOT touch
// PROPERTY_TARGETS_FY27's own per-month `available` figures (still the
// workbook's 63-based numbers, per "targets are static, confirmed not to
// change") — only the live/achieved side changes, which is the correct side
// to fix since the discrepancy is in physical inventory, not in the target
// plan.
//
// 2026-09-09: BH4 corrected 18 -> 24, user-confirmed as real bookable rooms
// (not a separate product) after finding a room-count/room-type mismatch —
// sales_booking has 24 distinct RoomNo values under BH4 (100/101/102/103,
// 200/201/202/203, ... 600/601/602/603 — six blocks of four), and
// lib/reference/roomTypeMapping.ts's own BH4 list already enumerates all 24
// (e.g. "100-3BHK Apartment"), but roomCount here only counted 18 — missing
// the six "X00" units ("3BHK Apartment", ~₹16,000/night, mostly long-stay
// "Relocation (B2B)" bookings, vs ~₹3,400-5,000/night and near-continuous
// turnover for the other 18). Because Available Room Nights used 18 while
// Sold Room Nights/Room Revenue already included all 24 rooms' activity,
// BH4's Occupancy % was inflated (nights from 24 rooms measured against an
// 18-room denominator) and its ADR was a distorted blend of two very
// different rate tiers relative to what an 18-room reading implied — the
// exact "ADR and Occupancy wrong only for BH4" symptom reported live. The
// business's own PMS Annual Sales Report still shows 18 for BH4 (unlike
// KDP's case, where the PMS report was the source of the correction) — this
// fix trusts the live per-room booking data plus the codebase's own
// already-24-room mapping over that summary report, per explicit user
// confirmation these are real rooms, not a separate revenue stream. Same
// "static target sheet stays untouched, only the live side changes"
// treatment as KDP: PROPERTY_TARGETS_FY27.BH4 keeps its own workbook-based
// 18-room `available` figures unchanged.
export const PROPERTIES: PropertyRef[] = [
  { code: "KDP", name: "KDP", brand: "Skyla", roomCount: 64, status: "active" },
  { code: "HTC", name: "HTC", brand: "Skyla", roomCount: 34, status: "active" },
  { code: "JHS", name: "JHS", brand: "Skyla", roomCount: 33, status: "active" },
  { code: "BH4", name: "BH4", brand: "Aptly", roomCount: 24, status: "active" },
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
