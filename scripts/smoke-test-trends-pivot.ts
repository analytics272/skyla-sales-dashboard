import { getMonthlyTrends, getBusinessCategoryAdrTrend } from "../lib/bigquery/queries/trends";

const FISCAL_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_ABBR: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

function pivotByFy(points: { fy: string; month: number; occupancyPct: number | null }[], fyList: string[]) {
  return FISCAL_MONTH_ORDER.map((month) => {
    const row: Record<string, unknown> = { monthLabel: MONTH_ABBR[month] };
    for (const fy of fyList) {
      const point = points.find((p) => p.fy === fy && p.month === month);
      row[fy] = point ? (point.occupancyPct !== null ? point.occupancyPct * 100 : null) : null;
    }
    return row;
  });
}

async function main() {
  const monthlyTrends = await getMonthlyTrends({});
  const fyList = [...new Set(monthlyTrends.map((p) => p.fy))].sort();
  console.log("FY list (should be oldest->newest):", fyList);

  const occupancyPivot = pivotByFy(monthlyTrends, fyList);
  console.log("\nOccupancy pivot (fiscal month order Apr..Mar):");
  console.table(occupancyPivot);

  const categoryAdrTrend = await getBusinessCategoryAdrTrend({});
  console.log("\nRaw category ADR trend rows:", categoryAdrTrend.length);
  console.table(categoryAdrTrend.slice(0, 12));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
