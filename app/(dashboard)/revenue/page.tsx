import { getOverviewKpis, getAdrByProperty, getOccupancyPace, getLastMonthCategoryBreakdown } from "@/lib/bigquery/queries/overview";
import { getMonthlyTrends } from "@/lib/bigquery/queries/trends";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import { resolveFilter } from "@/lib/bigquery/queries/filters";
import { latestSelectedFy } from "@/lib/reference/financialYear";
import RevenueContent from "@/components/revenue/RevenueContent";

export default async function RevenuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  const resolved = resolveFilter(filter);
  const fy = latestSelectedFy(filter);

  const [overview, adrByProperty, occupancyPace, monthlyTrends, lastMonthCategoryBreakdown] = await Promise.all([
    getOverviewKpis(filter),
    getAdrByProperty(filter),
    getOccupancyPace(resolved.properties),
    getMonthlyTrends({ properties: filter.properties }),
    getLastMonthCategoryBreakdown(resolved.properties),
  ]);

  const monthlyForFy = monthlyTrends.filter((p) => p.fy === fy);

  return (
    <RevenueContent
      overview={overview}
      adrByProperty={adrByProperty}
      occupancyPace={occupancyPace}
      monthlyForFy={monthlyForFy}
      fy={fy}
      lastMonthCategoryBreakdown={lastMonthCategoryBreakdown}
    />
  );
}
