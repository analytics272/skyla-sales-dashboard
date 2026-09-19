// Client-safe half of the Reports tab's property/column constants
// (Skyla_Dashboard_Reports_Tab_PRD.md). Split out from
// lib/bigquery/queries/reports.ts specifically because these are runtime
// values, not types — a "use client" component importing a runtime value
// from a query file pulls the whole module (BigQuery SDK included) into the
// browser bundle and fails the build. Pure TypeScript interfaces (like
// FolioReportMetrics) don't have this problem — they're erased entirely at
// compile time — only actual exported consts/arrays do.
export const REPORT_PROPERTIES = ["KDP", "HTC", "JHS", "BH4", "GB"] as const;
export type ReportProperty = (typeof REPORT_PROPERTIES)[number];

// 2026-09-19 (PRD_Reports_Section_Final.md §2): "FO" (café outlet, not a
// room property) is NOT its own column here — per explicit user direction
// ("include FO in F&B Revenue, don't separate it"). Its F&B revenue is
// folded into the TOTAL column's F&B/Total Revenue only, counted exactly
// once (see reports.ts's factsToColumns) — it never appears as its own
// row/column, and it's never added into any individual hotel property's
// own F&B figure either.
export type ReportColumn = ReportProperty | "TOTAL";
export const REPORT_COLUMNS: ReportColumn[] = [...REPORT_PROPERTIES, "TOTAL"];
