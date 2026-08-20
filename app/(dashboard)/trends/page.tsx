import { getMonthlyTrends, getBusinessCategoryAdrTrend } from "@/lib/bigquery/queries/trends";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import TrendsContent from "@/components/trends/TrendsContent";

export default async function TrendsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);

  const [monthlyTrends, categoryAdrTrend] = await Promise.all([
    getMonthlyTrends({ properties: filter.properties }),
    getBusinessCategoryAdrTrend({ properties: filter.properties }),
  ]);

  return <TrendsContent monthlyTrends={monthlyTrends} categoryAdrTrend={categoryAdrTrend} />;
}
