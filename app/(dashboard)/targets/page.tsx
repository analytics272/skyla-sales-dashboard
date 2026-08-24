import {
  getCategoryAchievement,
  getRevenueAchievement,
  getMonthlyRevenueTargets,
  getAdrTargetVsAchieved,
  getOccupancyTargetVsAchieved,
} from "@/lib/bigquery/queries/targets";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import { resolveSelectedFYs } from "@/lib/reference/financialYear";
import TargetsContent from "@/components/targets/TargetsContent";

export default async function TargetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  // leadership_targets isn't property-scoped (§6.5) — only FY/quarter/month apply.
  const targetsFilter = { fys: filter.fys, quarter: filter.quarter, months: filter.months };
  const fys = resolveSelectedFYs(filter);

  const [categoryAchievement, revenueAchievement, monthlyRevenueTargetsByFy, adrTargetVsAchievedByFy, occupancyTargetVsAchievedByFy] =
    await Promise.all([
      getCategoryAchievement(targetsFilter),
      getRevenueAchievement(targetsFilter),
      Promise.all(fys.map(async (fy) => ({ fy, data: await getMonthlyRevenueTargets(fy) }))),
      Promise.all(fys.map(async (fy) => ({ fy, data: await getAdrTargetVsAchieved(fy) }))),
      Promise.all(fys.map(async (fy) => ({ fy, data: await getOccupancyTargetVsAchieved(fy) }))),
    ]);

  return (
    <TargetsContent
      categoryAchievement={categoryAchievement}
      revenueAchievement={revenueAchievement}
      monthlyRevenueTargetsByFy={monthlyRevenueTargetsByFy}
      adrTargetVsAchievedByFy={adrTargetVsAchievedByFy}
      occupancyTargetVsAchievedByFy={occupancyTargetVsAchievedByFy}
    />
  );
}
