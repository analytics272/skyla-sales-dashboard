// Guest Served: sheet-vs-BigQuery accuracy check (redesign §8, restored per
// explicit user direction 2026-09-02 after an initial pass declined to ship
// it — see HANDOVER for the full back-and-forth).
//
// This is a fixed, one-time reference snapshot, not a live query — same
// pattern as lib/reference/propertyTargets.ts. The "Skyla Revenue Sheets
// Master" Google Sheet's Transposed Data tab was read directly (2026-09-02)
// and its Guest Served row for April 2026, per property, extracted and
// cross-validated: that same row's Room Revenue figures were checked against
// BigQuery's independently-computed April 2026 revenue-by-property and
// matched, confirming the extraction lined up with the right row/columns
// before trusting the Guest Served figures next to it.
//
// Root cause CONFIRMED (2026-09-02, sixth pass, item #8): BigQuery's
// guest-served figure originally summed each booking's peak occupancy once
// (MAX(NoOfGuest) per booking), undercounting the sheet by ~82%. Checked
// whether NoOfGuest itself was the problem (e.g. recorded as 1 pax for an
// actual double-occupancy stay) — it wasn't: NoOfGuest matched Adult+Child
// exactly on every one of April 2026's 3,722 room-nights, zero mismatches.
// The gap was the AGGREGATION: summing NoOfGuest across every night of stay
// (guest-*nights*, not one peak reading per booking) landed at 4,928 against
// the sheet's 5,093 — within ~3%, not ~82%. lib/bigquery/queries/guestDetail.ts
// (getBookingStats, getGuestServedAccuracyCheck) now sum guest-nights
// directly; the residual ~3% gap is surfaced as "Data Error Rate" in the UI.
export const GUEST_SERVED_SNAPSHOT_LABEL = "April 2026";
export const GUEST_SERVED_SNAPSHOT_RANGE = { start: "2026-04-01", end: "2026-04-30" };

export const GUEST_SERVED_SHEET_SNAPSHOT: Record<string, number> = {
  KDP: 1716,
  HTC: 985,
  JHS: 1206,
  BH4: 802,
  GB: 384,
};
