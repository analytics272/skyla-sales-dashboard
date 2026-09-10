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
// 2026-09-09, REVERTED same day: BH4 was briefly changed 18 -> 24 after
// finding 24 distinct RoomNo values under BH4 in sales_booking (100-103,
// 200-203, ... 600-603 — six blocks of four, the "X00" ones being a "3BHK
// Apartment" unit type at ~₹16,000/night, mostly long-stay "Relocation
// (B2B)" bookings) and lib/reference/roomTypeMapping.ts's BH4 list already
// enumerating all 24. That was wrong. The user cross-checked against the
// business's live Looker Studio report (their actual BI tool, not a static
// export) for the same September window, across all 5 operating
// properties: GB matched the dashboard exactly on every figure (Available,
// Sold, Revenue, Occ%, ADR, RevPAR, zero difference), confirming Looker
// Studio is a reliable reference here — and BH4's "Rooms Available" was
// 540, not 720: exactly 180 = 6×30 less, i.e. exactly the six 3BHK rooms
// this fix had added. Room Revenue matched the dashboard exactly either way
// (₹14,99,350) — the 3BHK units' revenue really is counted in Room Revenue
// — but Looker Studio's own "Rooms Available" deliberately excludes them
// from capacity. So the six 3BHK apartments are real, billed, revenue-
// generating rooms, but the business's own occupancy/capacity convention
// doesn't count them as part of BH4's 18-room inventory — a genuine "extra,
// off-inventory revenue" case, not the "real rooms, count is 24" reading
// this fix assumed. Reverted to 18. (KDP's 63->64 correction two days
// earlier is unaffected and still confirmed correct — Looker Studio's own
// KDP "Rooms Available" for the same September window is 1,920 = 64×30,
// matching that fix exactly.)
// 2026-09-10 — LP set to "removed" (user direction): LP (Lotus Pond) is a
// retired hotel whose backfill data (`sales_booking_lp_monthly`) ends
// Mar 2026, so it has ZERO data from FY 26-27 onward and never will. It was
// re-integrated 2026-08-26 (LP PRD Addendum) but a forward-looking sales
// dashboard shouldn't surface a property with no current/future data — so
// LP is dropped from the property filter, from "All", and from every
// visual. The LP query/merge code (lpMonthly.ts, the `includeLp` branches)
// is left in place, just never triggered, so historical LP analysis stays
// one status-flip away if it's ever wanted.
export const PROPERTIES: PropertyRef[] = [
  { code: "KDP", name: "KDP", brand: "Skyla", roomCount: 64, status: "active" },
  { code: "HTC", name: "HTC", brand: "Skyla", roomCount: 34, status: "active" },
  { code: "JHS", name: "JHS", brand: "Skyla", roomCount: 33, status: "active" },
  { code: "BH4", name: "BH4", brand: "Aptly", roomCount: 18, status: "active" },
  { code: "LP", name: "LP", brand: "Aptly", roomCount: 16, status: "removed" },
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
