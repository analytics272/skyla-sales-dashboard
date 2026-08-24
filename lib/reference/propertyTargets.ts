// Fixed per-property revenue targets for FY 26-27 — sourced from the
// business's own planning workbook ("FY27 Turnover Projection.xlsx",
// provided 2026-08-25). Per explicit user direction: these figures are set
// once for the year and confirmed not to change, so — unlike every other
// number on this dashboard — they are NOT read from BigQuery. Only this one
// FY has a per-property monthly breakdown; `leadership_targets` only carries
// the already-summed company-wide figure (its `dept_Total_Target` for each
// month equals the sum of every property's `revenue` below, exactly —
// cross-checked against live BigQuery data before adding this file).
//
// Property codes cross-checked against `propertyReference.ts` by room count
// (KDP=63, HTC=34, JHS=33, BH4=18, GB=21 — all match exactly, confirming the
// workbook's "Kondapur/Hitec City/Jubilee Hills/Banjara Hills Rd No 11/
// Gachibowli" columns map to these codes in this order).
//
// Actual/achieved figures for comparison against these targets still come
// from `sales_booking` (real PMS data) — see
// `lib/bigquery/queries/propertyTargets.ts`.

export const PROPERTY_TARGETS_FY = "FY 26-27";

export interface MonthlyPropertyTarget {
  calendarMonth: number; // 1-12
  available: number; // room-nights
  occPct: number; // fraction, e.g. 0.74
  arr: number; // average room rate, ₹
  revenue: number; // ₹
}

export const PROPERTY_TARGETS_FY27: Record<string, MonthlyPropertyTarget[]> = {
  KDP: [
    { calendarMonth: 4, available: 1890, occPct: 0.74, arr: 6500, revenue: 9090900 },
    { calendarMonth: 5, available: 1953, occPct: 0.6, arr: 6500, revenue: 7616700 },
    { calendarMonth: 6, available: 1890, occPct: 0.7, arr: 6500, revenue: 8599500 },
    { calendarMonth: 7, available: 1953, occPct: 0.8, arr: 7000, revenue: 10936800 },
    { calendarMonth: 8, available: 1953, occPct: 0.78, arr: 7000, revenue: 10663380 },
    { calendarMonth: 9, available: 1890, occPct: 0.78, arr: 7000, revenue: 10319400 },
    { calendarMonth: 10, available: 1953, occPct: 0.76, arr: 7000, revenue: 10389960 },
    { calendarMonth: 11, available: 1890, occPct: 0.83, arr: 8200, revenue: 12863340 },
    { calendarMonth: 12, available: 1953, occPct: 0.78, arr: 8000, revenue: 12186720 },
    { calendarMonth: 1, available: 1953, occPct: 0.79, arr: 7200, revenue: 11108664 },
    { calendarMonth: 2, available: 1764, occPct: 0.82, arr: 7500, revenue: 10848600 },
    { calendarMonth: 3, available: 1953, occPct: 0.79, arr: 7200, revenue: 11108664 },
  ],
  HTC: [
    { calendarMonth: 4, available: 1020, occPct: 0.8, arr: 5000, revenue: 4080000 },
    { calendarMonth: 5, available: 1054, occPct: 0.7, arr: 5000, revenue: 3689000 },
    { calendarMonth: 6, available: 1020, occPct: 0.75, arr: 5000, revenue: 3825000 },
    { calendarMonth: 7, available: 1054, occPct: 0.81, arr: 5200, revenue: 4439448 },
    { calendarMonth: 8, available: 1054, occPct: 0.81, arr: 5200, revenue: 4439448 },
    { calendarMonth: 9, available: 1020, occPct: 0.81, arr: 5200, revenue: 4296240 },
    { calendarMonth: 10, available: 1054, occPct: 0.81, arr: 5200, revenue: 4439448 },
    { calendarMonth: 11, available: 1020, occPct: 0.86, arr: 5500, revenue: 4824600 },
    { calendarMonth: 12, available: 1054, occPct: 0.81, arr: 5400, revenue: 4610196 },
    { calendarMonth: 1, available: 1054, occPct: 0.81, arr: 5300, revenue: 4524822 },
    { calendarMonth: 2, available: 952, occPct: 0.85, arr: 5300, revenue: 4288760 },
    { calendarMonth: 3, available: 1054, occPct: 0.82, arr: 5300, revenue: 4580684 },
  ],
  JHS: [
    { calendarMonth: 4, available: 990, occPct: 0.75, arr: 5500, revenue: 4083750 },
    { calendarMonth: 5, available: 1023, occPct: 0.6, arr: 5500, revenue: 3375900 },
    { calendarMonth: 6, available: 990, occPct: 0.66, arr: 5500, revenue: 3593700 },
    { calendarMonth: 7, available: 1023, occPct: 0.78, arr: 6000, revenue: 4787640 },
    { calendarMonth: 8, available: 1023, occPct: 0.78, arr: 6000, revenue: 4787640 },
    { calendarMonth: 9, available: 990, occPct: 0.78, arr: 5700, revenue: 4401540 },
    { calendarMonth: 10, available: 1023, occPct: 0.78, arr: 5700, revenue: 4548258 },
    { calendarMonth: 11, available: 990, occPct: 0.82, arr: 7000, revenue: 5682600 },
    { calendarMonth: 12, available: 1023, occPct: 0.78, arr: 7000, revenue: 5585580 },
    { calendarMonth: 1, available: 1023, occPct: 0.78, arr: 6000, revenue: 4787640 },
    { calendarMonth: 2, available: 924, occPct: 0.8, arr: 6400, revenue: 4730880 },
    { calendarMonth: 3, available: 1023, occPct: 0.78, arr: 6300, revenue: 5027022 },
  ],
  BH4: [
    { calendarMonth: 4, available: 540, occPct: 0.85, arr: 4000, revenue: 1836000 },
    { calendarMonth: 5, available: 558, occPct: 0.65, arr: 4000, revenue: 1450800 },
    { calendarMonth: 6, available: 540, occPct: 0.7, arr: 4000, revenue: 1512000 },
    { calendarMonth: 7, available: 558, occPct: 0.85, arr: 4500, revenue: 2134350 },
    { calendarMonth: 8, available: 558, occPct: 0.8, arr: 4200, revenue: 1874880 },
    { calendarMonth: 9, available: 540, occPct: 0.8, arr: 4200, revenue: 1814400 },
    { calendarMonth: 10, available: 558, occPct: 0.8, arr: 4200, revenue: 1874880 },
    { calendarMonth: 11, available: 540, occPct: 0.9, arr: 4600, revenue: 2235600 },
    { calendarMonth: 12, available: 558, occPct: 0.9, arr: 4500, revenue: 2259900 },
    { calendarMonth: 1, available: 558, occPct: 0.8, arr: 4500, revenue: 2008800 },
    { calendarMonth: 2, available: 504, occPct: 0.9, arr: 4500, revenue: 2041200 },
    { calendarMonth: 3, available: 558, occPct: 0.85, arr: 4500, revenue: 2134350 },
  ],
  GB: [
    { calendarMonth: 4, available: 630, occPct: 0.51, arr: 3900, revenue: 1253070 },
    { calendarMonth: 5, available: 651, occPct: 0.56, arr: 4000, revenue: 1458240 },
    { calendarMonth: 6, available: 630, occPct: 0.65, arr: 4000, revenue: 1638000 },
    { calendarMonth: 7, available: 651, occPct: 0.78, arr: 4250, revenue: 2158065 },
    { calendarMonth: 8, available: 651, occPct: 0.78, arr: 4250, revenue: 2158065 },
    { calendarMonth: 9, available: 630, occPct: 0.78, arr: 4000, revenue: 1965600 },
    { calendarMonth: 10, available: 651, occPct: 0.78, arr: 4000, revenue: 2031120 },
    { calendarMonth: 11, available: 630, occPct: 0.86, arr: 4500, revenue: 2438100 },
    { calendarMonth: 12, available: 651, occPct: 0.75, arr: 4300, revenue: 2099475 },
    { calendarMonth: 1, available: 651, occPct: 0.81, arr: 4200, revenue: 2214702 },
    { calendarMonth: 2, available: 588, occPct: 0.8, arr: 4300, revenue: 2022720 },
    { calendarMonth: 3, available: 651, occPct: 0.8, arr: 4300, revenue: 2239440 },
  ],
};
