import {
  getCategoryAchievement,
  summarizeRevenueAchievement,
  getMonthlyRevenueTargets,
  getAdrTargetVsAchieved,
  getOccupancyTargetVsAchieved,
  resolveTargetsFy,
} from "@/lib/bigquery/queries/targets";
import { getPropertyTargetComparison } from "@/lib/bigquery/queries/propertyTargets";
import { resolveFilter } from "@/lib/bigquery/queries/filters";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import TargetsContent from "@/components/targets/TargetsContent";

export default async function TargetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  // leadership_targets isn't property-scoped (§6.5) — only the period tab applies.
  const targetsFilter = { period: filter.period, customStart: filter.customStart, customEnd: filter.customEnd };
  const fy = resolveTargetsFy(targetsFilter);
  const resolved = resolveFilter(filter);

  // monthlyRevenueTargets is fetched once here and reused for both the
  // monthly chart AND the revenueAchievement summary (via
  // summarizeRevenueAchievement, a pure function — no extra BigQuery round trip).
  const [categoryAchievement, monthlyRevenueTargets, adrTargetVsAchieved, occupancyTargetVsAchieved, propertyTargetComparison] =
    await Promise.all([
      getCategoryAchievement(targetsFilter),
      getMonthlyRevenueTargets(fy),
      getAdrTargetVsAchieved(fy),
      getOccupancyTargetVsAchieved(fy),
      getPropertyTargetComparison(resolved.properties),
    ]);

  const revenueAchievement = summarizeRevenueAchievement(monthlyRevenueTargets);

  return (
    <TargetsContent
      fy={fy}
      categoryAchievement={categoryAchievement}
      revenueAchievement={revenueAchievement}
      monthlyRevenueTargets={monthlyRevenueTargets}
      adrTargetVsAchieved={adrTargetVsAchieved}
      occupancyTargetVsAchieved={occupancyTargetVsAchieved}
      propertyTargetComparison={propertyTargetComparison}
    />
  );
}
