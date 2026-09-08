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
  // 2026-09-08: new tab, Skyla_Dashboard_Reports_Tab_PRD.md. One nav slot for
  // both new reports (Folio Based Report FY 26-27, FY 26-27 B2B Details) —
  // switched via an in-page toggle in ReportsContent.tsx, not a second route,
  // so the existing pathname === `/${slug}` matching in Sidebar/FilterBar
  // needs no changes for this. Both reports are fixed to FY 26-27 and ignore
  // the global period-tab filter (Property filter still applies) — same
  // "one nav item, its own filter scope" precedent as Property Targets'
  // fixed-FY section on Performance.
  { slug: "reports", label: "Reports" },
] as const;
