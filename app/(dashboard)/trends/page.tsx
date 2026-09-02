import { getMonthlyTrends, getBusinessCategoryAdr } from "@/lib/bigquery/queries/trends";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import TrendsContent from "@/components/trends/TrendsContent";

export default async function TrendsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);

  const [monthlyTrends, categoryAdr] = await Promise.all([
    getMonthlyTrends(filter),
    getBusinessCategoryAdr(filter),
  ]);

  return <TrendsContent monthlyTrends={monthlyTrends} categoryAdr={categoryAdr} />;
}
