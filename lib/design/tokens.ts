// Fixed categorical color assignments (dataviz skill: "assign categorical hues
// in fixed order, never cycled"). CSS var() references so charts pick up the
// light/dark swap defined in globals.css automatically without JS theme logic.

export const CATEGORY_COLOR: Record<string, string> = {
  B2B: "var(--series-1)",
  B2C: "var(--series-2)",
  OTA: "var(--series-3)",
};

export const CATEGORY_ORDER = ["B2B", "B2C", "OTA"] as const;

export const BRAND_COLOR: Record<string, string> = {
  Skyla: "var(--series-1)",
  Aptly: "var(--series-2)",
  Hyber: "var(--series-3)",
};

export const BRAND_ORDER = ["Skyla", "Aptly", "Hyber"] as const;

// §3.4 room types, in a fixed order across all 8 categorical slots (validated
// for adjacent-pair bar/stack use — see palette validation in session notes).
export const ROOM_TYPE_ORDER = [
  "Executive Room",
  "Studio Room",
  "1 BHK",
  "2 BHK",
  "Banquet",
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

export const FY_COLOR: Record<string, string> = {
  "FY 24-25": "var(--series-1)",
  "FY 25-26": "var(--series-2)",
  "FY 26-27": "var(--series-3)",
};

export const ROOM_TYPE_COLOR: Record<string, string> = {
  "Executive Room": "var(--series-1)",
  "Studio Room": "var(--series-2)",
  "1 BHK": "var(--series-3)",
  "2 BHK": "var(--series-4)",
  Banquet: "var(--series-5)",
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
