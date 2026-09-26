import { getOverviewKpis, getAdrByProperty, getOccupancyPace, getUnmappedSourceStats } from "@/lib/bigquery/queries/overview";
import { getMonthlyTrends } from "@/lib/bigquery/queries/trends";
import { getBrandOccupancy } from "@/lib/bigquery/queries/brandCategory";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import { resolveFilter } from "@/lib/bigquery/queries/filters";
import { getDataFreshness, TAB_FRESHNESS_SOURCES } from "@/lib/bigquery/queries/syncStatus";
import SyncFreshnessBanner from "@/components/ui/SyncFreshnessBanner";
import OverviewContent from "@/components/overview/OverviewContent";

// 2026-09-02 redesign, fifth pass — merges the old Revenue Details, Trends,
// and Brand pages into one. getBusinessCategoryAdr (previously called
// separately by both Trends and Brand for the same B2B/B2C/OTA split) is
// dropped: overview.bySource already carries revenue + nights per category,
// which is all OverviewContent needs to derive both the revenue donut and
// the category ADR bar itself.
export default async function OverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  const resolved = resolveFilter(filter);

  const [overview, adrByProperty, occupancyPace, monthlyTrends, brandOccupancy, unmappedSource, freshness] = await Promise.all([
    getOverviewKpis(filter),
    getAdrByProperty(filter),
    getOccupancyPace(resolved.properties),
    getMonthlyTrends(filter),
    getBrandOccupancy(filter),
    getUnmappedSourceStats(filter),
    getDataFreshness(TAB_FRESHNESS_SOURCES.overview),
  ]);

  return (
    <>
      <SyncFreshnessBanner sources={freshness} />
      <OverviewContent
        overview={overview}
        adrByProperty={adrByProperty}
        occupancyPace={occupancyPace}
        monthlyTrends={monthlyTrends}
        brandOccupancy={brandOccupancy}
        unmappedSource={unmappedSource}
        compareYoY={filter.compareYoY ?? false}
      />
    </>
  );
}
