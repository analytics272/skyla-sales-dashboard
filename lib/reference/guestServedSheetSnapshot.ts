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
// Caveat, kept visible in the UI, not just here: the resulting variance is
// large and consistent (roughly 4-8x higher in the sheet, every property) in
// a way that looks more like a different metric definition (e.g. total
// guest-*nights* in the sheet vs. BigQuery's per-booking peak-occupancy
// count) than a small number of bookings missing from the API sync. Shown
// anyway, per explicit request — a real, measured gap is still worth
// surfacing even without a confirmed root cause; the card says so.
export const GUEST_SERVED_SNAPSHOT_LABEL = "April 2026";
export const GUEST_SERVED_SNAPSHOT_RANGE = { start: "2026-04-01", end: "2026-04-30" };

export const GUEST_SERVED_SHEET_SNAPSHOT: Record<string, number> = {
  KDP: 1716,
  HTC: 985,
  JHS: 1206,
  BH4: 802,
  GB: 384,
};
