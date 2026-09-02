import { getOverviewKpis, getAdrByProperty, getOccupancyPace } from "@/lib/bigquery/queries/overview";
import { getMonthlyTrends } from "@/lib/bigquery/queries/trends";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import { resolveFilter } from "@/lib/bigquery/queries/filters";
import RevenueContent from "@/components/revenue/RevenueContent";

export default async function RevenuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  const resolved = resolveFilter(filter);

  const [overview, adrByProperty, occupancyPace, monthlyTrends] = await Promise.all([
    getOverviewKpis(filter),
    getAdrByProperty(filter),
    getOccupancyPace(resolved.properties),
    getMonthlyTrends(filter),
  ]);

  return (
    <RevenueContent
      overview={overview}
      adrByProperty={adrByProperty}
      occupancyPace={occupancyPace}
      monthlyTrends={monthlyTrends}
    />
  );
}
