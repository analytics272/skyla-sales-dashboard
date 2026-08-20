import {
  getCategoryAchievement,
  getRevenueAchievement,
  getMonthlyRevenueTargets,
  getAdrTargetVsAchieved,
  getOccupancyTargetVsAchieved,
} from "@/lib/bigquery/queries/targets";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import TargetsContent from "@/components/targets/TargetsContent";

export default async function TargetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  // leadership_targets isn't property-scoped (§6.5) — only FY/quarter/month apply.
  const targetsFilter = { fy: filter.fy, quarter: filter.quarter, months: filter.months };

  const [categoryAchievement, revenueAchievement, monthlyRevenueTargets, adrTargetVsAchieved, occupancyTargetVsAchieved] =
    await Promise.all([
      getCategoryAchievement(targetsFilter),
      getRevenueAchievement(targetsFilter),
      getMonthlyRevenueTargets(filter.fy),
      getAdrTargetVsAchieved(filter.fy),
      getOccupancyTargetVsAchieved(filter.fy),
    ]);

  return (
    <TargetsContent
      categoryAchievement={categoryAchievement}
      revenueAchievement={revenueAchievement}
      monthlyRevenueTargets={monthlyRevenueTargets}
      adrTargetVsAchieved={adrTargetVsAchieved}
      occupancyTargetVsAchieved={occupancyTargetVsAchieved}
    />
  );
}
