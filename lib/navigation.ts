// 2026-09-02 redesign, fifth pass: consolidated from 8 tabs down to 4,
// grouped by business theme, per explicit user direction and inspired by
// the reference dashboard's own minimal (3-tab) nav. Each new tab folds in
// what used to be 2-3 separate pages — see each page's own file for exactly
// which old sections live where now.
export const TABS = [
  { slug: "overview", label: "Overview" }, // was: Revenue Details + Trends + Brand
  { slug: "bookings", label: "Bookings" }, // was: Booking Details + OTA Breakdown
  { slug: "leads", label: "Leads" }, // unchanged
  { slug: "performance", label: "Performance" }, // was: Targets + Reviews
] as const;
