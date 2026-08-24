// Shared by any chart plotting "one series per FY, monthly x-axis" (§6.3, §6.8)
// — pivots a flat {fy, month, ...} array into fiscal-month-ordered rows with
// one column per FY.
import { isFutureFiscalMonth } from "@/lib/reference/financialYear";

export const FISCAL_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
export const MONTH_ABBR: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

export function pivotByFiscalMonth<T extends { fy: string }>(
  points: T[],
  fyList: string[],
  monthOf: (p: T) => number,
  valueOf: (p: T) => number | null
): Record<string, unknown>[] {
  return FISCAL_MONTH_ORDER.map((month) => {
    const row: Record<string, unknown> = { monthLabel: MONTH_ABBR[month] };
    for (const fy of fyList) {
      if (isFutureFiscalMonth(fy, month)) {
        // Hasn't happened yet — leave the series absent here (null, not 0) so
        // the line simply stops at the last real month instead of either (a)
        // connectNulls bridging a false diagonal across the gap, or (b)
        // flat-lining at 0 all the way to fiscal year-end as if "nothing sold"
        // were a real, elapsed fact.
        row[fy] = null;
        continue;
      }
      // An elapsed month absent from `points` genuinely had zero rows (e.g. a
      // rare zero-booking month) — plotted as a real 0 so the line holds flat
      // there rather than being mistaken for missing data.
      const point = points.find((p) => p.fy === fy && monthOf(p) === month);
      row[fy] = point ? (valueOf(point) ?? 0) : 0;
    }
    return row;
  });
}
