// Shared by any chart plotting "one series per FY, monthly x-axis" (§6.3, §6.8)
// — pivots a flat {fy, month, ...} array into fiscal-month-ordered rows with
// one column per FY.
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
      const point = points.find((p) => p.fy === fy && monthOf(p) === month);
      row[fy] = point ? valueOf(point) : null;
    }
    return row;
  });
}
