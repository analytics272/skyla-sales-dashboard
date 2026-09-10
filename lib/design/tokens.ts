// Fixed categorical color assignments (dataviz skill: "assign categorical hues
// in fixed order, never cycled"). CSS var() references so charts pick up the
// light/dark swap defined in globals.css automatically without JS theme logic.

export const CATEGORY_COLOR: Record<string, string> = {
  B2B: "var(--series-1)",
  B2C: "var(--series-2)",
  OTA: "var(--series-3)",
};

export const CATEGORY_ORDER = ["B2B", "B2C", "OTA"] as const;

// 2026-09-10: real brand identity colours (user Pic 3/4/5), not generic
// series slots. Use these anywhere a brand is a series in a chart.
export const BRAND_COLOR: Record<string, string> = {
  Skyla: "var(--brand-skyla)",
  Aptly: "var(--brand-aptly)",
  Hyber: "var(--brand-hyber)",
};

// Full per-brand palettes (Pic 3/4/5) — lightest → darkest. For when a
// single brand's own sub-categories need to be coloured within its colour
// family (e.g. a Skyla-only breakdown).
export const BRAND_PALETTE: Record<string, string[]> = {
  Skyla: ["#fce8f1", "#f59c9b", "#ef4f5e", "#af3241", "#7c1826"],
  Aptly: ["#fcddd6", "#e39b89", "#342c4c"],
  Hyber: ["#e8e2d6", "#f15e2c", "#395daa", "#2b2b2b"],
};

export const BRAND_ORDER = ["Skyla", "Aptly", "Hyber"] as const;

// §3.4 room types, in a fixed order across all 8 categorical slots (validated
// for adjacent-pair bar/stack use — see palette validation in session notes).
// 2026-09-10: "Banquet" removed (not a sellable room), "Premiere Supreme"
// added as the Skyla premium tier split out of "Executive Room" — see
// roomTypeMapping.ts.
export const ROOM_TYPE_ORDER = [
  "Premiere Supreme",
  "Executive Room",
  "Studio Room",
  "1 BHK",
  "2 BHK",
  "Hyber Room",
  "Hyber Room Lite",
  "Hyber Room Go",
] as const;

// Fixed oldest -> newest order so a given FY always gets the same color across
// every trend chart, regardless of how many FYs are in view.
// Target vs Achieved is a fixed two-series comparison, reused identically
// across every Targets-tab chart (ADR, Occupancy).
export const TARGET_VS_ACHIEVED_COLOR = {
  target: "var(--series-1)",
  achieved: "var(--series-6)",
};

// Three-series variant for the monthly Revenue Targets with Roll Over chart.
export const REVENUE_ROLLOVER_COLOR = {
  deptTarget: "var(--series-1)",
  targetWithRollOver: "var(--series-7)",
  achieved: "var(--series-6)",
};

export const ROOM_TYPE_COLOR: Record<string, string> = {
  "Premiere Supreme": "var(--series-1)",
  "Executive Room": "var(--series-2)",
  "Studio Room": "var(--series-3)",
  "1 BHK": "var(--series-4)",
  "2 BHK": "var(--series-5)",
  "Hyber Room": "var(--series-6)",
  "Hyber Room Lite": "var(--series-7)",
  "Hyber Room Go": "var(--series-8)",
};

export const CHART_TEXT = {
  primary: "var(--chart-text-primary)",
  secondary: "var(--chart-text-secondary)",
  muted: "var(--chart-text-muted)",
};

export const CHART_GRIDLINE = "var(--chart-gridline)";
export const CHART_BASELINE = "var(--chart-baseline)";
export const CHART_DELTA_GOOD = "var(--chart-delta-good)";
export const CHART_DELTA_BAD = "var(--chart-delta-bad)";
