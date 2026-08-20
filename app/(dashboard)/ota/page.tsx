import { getOtaBreakdown } from "@/lib/bigquery/queries/otaBreakdown";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import OtaContent from "@/components/ota/OtaContent";

export default async function OtaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);

  const otaBreakdown = await getOtaBreakdown(filter);

  return <OtaContent otaBreakdown={otaBreakdown} />;
}
