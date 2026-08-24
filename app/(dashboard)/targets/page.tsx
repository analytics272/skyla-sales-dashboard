import {
  getCategoryAchievement,
  summarizeRevenueAchievement,
  getMonthlyRevenueTargets,
  getAdrTargetVsAchieved,
  getOccupancyTargetVsAchieved,
} from "@/lib/bigquery/queries/targets";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import { resolveSelectedFYs, resolveSelectedMonths } from "@/lib/reference/financialYear";
import TargetsContent from "@/components/targets/TargetsContent";

export default async function TargetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  // leadership_targets isn't property-scoped (§6.5) — only FY/quarter/month apply.
  const targetsFilter = { fys: filter.fys, quarter: filter.quarter, months: filter.months };
  const fys = resolveSelectedFYs(filter);

  // monthlyRevenueTargetsByFy is fetched once here and reused for both the
  // monthly chart AND the revenueAchievement summary (via summarizeRevenueAchievement,
  // a pure function — no extra BigQuery round trip) — previously each was
  // fetched separately, doubling the BigQuery calls this page made per FY.
  const [categoryAchievement, monthlyRevenueTargetsByFy, adrTargetVsAchievedByFy, occupancyTargetVsAchievedByFy] =
    await Promise.all([
      getCategoryAchievement(targetsFilter),
      Promise.all(fys.map(async (fy) => ({ fy, data: await getMonthlyRevenueTargets(fy) }))),
      Promise.all(fys.map(async (fy) => ({ fy, data: await getAdrTargetVsAchieved(fy) }))),
      Promise.all(fys.map(async (fy) => ({ fy, data: await getOccupancyTargetVsAchieved(fy) }))),
    ]);

  const revenueAchievement = summarizeRevenueAchievement(monthlyRevenueTargetsByFy, resolveSelectedMonths(targetsFilter));

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
