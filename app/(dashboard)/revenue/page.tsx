import { getOverviewKpis } from "@/lib/bigquery/queries/overview";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import RevenueContent from "@/components/revenue/RevenueContent";

export default async function RevenuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);

  const overview = await getOverviewKpis(filter);

  return <RevenueContent overview={overview} />;
}
