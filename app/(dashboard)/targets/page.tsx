import {
  getCategoryAchievement,
  summarizeRevenueAchievement,
  getMonthlyRevenueTargets,
  getAdrTargetVsAchieved,
  getOccupancyTargetVsAchieved,
} from "@/lib/bigquery/queries/targets";
import { getPropertyTargetComparison } from "@/lib/bigquery/queries/propertyTargets";
import { resolveFilter } from "@/lib/bigquery/queries/filters";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import { resolveSelectedFYs, resolveSelectedMonths } from "@/lib/reference/financialYear";
import TargetsContent from "@/components/targets/TargetsContent";

export default async function TargetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  // leadership_targets isn't property-scoped (§6.5) — only FY/quarter/month apply.
  const targetsFilter = { fys: filter.fys, quarter: filter.quarter, months: filter.months };
  const fys = resolveSelectedFYs(filter);
  const months = resolveSelectedMonths(targetsFilter);
  const resolved = resolveFilter(filter);

  // monthlyRevenueTargetsByFy is fetched once here and reused for both the
  // monthly chart AND the revenueAchievement summary (via summarizeRevenueAchievement,
  // a pure function — no extra BigQuery round trip) — previously each was
  // fetched separately, doubling the BigQuery calls this page made per FY.
  const [categoryAchievement, monthlyRevenueTargetsByFy, adrTargetVsAchievedByFy, occupancyTargetVsAchievedByFy, propertyTargetComparison] =
    await Promise.all([
      getCategoryAchievement(targetsFilter),
      Promise.all(fys.map(async (fy) => ({ fy, data: await getMonthlyRevenueTargets(fy) }))),
      Promise.all(fys.map(async (fy) => ({ fy, data: await getAdrTargetVsAchieved(fy) }))),
      Promise.all(fys.map(async (fy) => ({ fy, data: await getOccupancyTargetVsAchieved(fy) }))),
      getPropertyTargetComparison(resolved.properties, months),
    ]);

  const revenueAchievement = summarizeRevenueAchievement(monthlyRevenueTargetsByFy, months);

  return (
    <TargetsContent
      categoryAchievement={categoryAchievement}
      revenueAchievement={revenueAchievement}
      monthlyRevenueTargetsByFy={monthlyRevenueTargetsByFy}
      adrTargetVsAchievedByFy={adrTargetVsAchievedByFy}
      occupancyTargetVsAchievedByFy={occupancyTargetVsAchievedByFy}
      propertyTargetComparison={propertyTargetComparison}
    />
  );
}
