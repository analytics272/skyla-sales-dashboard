import {
  getCategoryAchievement,
  getRevenueAchievement,
  getMonthlyRevenueTargets,
  getAdrTargetVsAchieved,
  getOccupancyTargetVsAchieved,
} from "@/lib/bigquery/queries/targets";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import { latestSelectedFy } from "@/lib/reference/financialYear";
import TargetsContent from "@/components/targets/TargetsContent";

export default async function TargetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  // leadership_targets isn't property-scoped (§6.5) — only FY/quarter/month apply.
  const targetsFilter = { fys: filter.fys, quarter: filter.quarter, months: filter.months };
  const fy = latestSelectedFy(filter);

  const [categoryAchievement, revenueAchievement, monthlyRevenueTargets, adrTargetVsAchieved, occupancyTargetVsAchieved] =
    await Promise.all([
      getCategoryAchievement(targetsFilter),
      getRevenueAchievement(targetsFilter),
      getMonthlyRevenueTargets(fy),
      getAdrTargetVsAchieved(fy),
      getOccupancyTargetVsAchieved(fy),
    ]);

  return (
    <TargetsContent
      fy={fy}
      categoryAchievement={categoryAchievement}
      revenueAchievement={revenueAchievement}
      monthlyRevenueTargets={monthlyRevenueTargets}
      adrTargetVsAchieved={adrTargetVsAchieved}
      occupancyTargetVsAchieved={occupancyTargetVsAchieved}
    />
  );
}
