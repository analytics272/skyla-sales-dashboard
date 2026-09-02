import {
  getCategoryAchievement,
  summarizeRevenueAchievement,
  getMonthlyRevenueTargets,
  getAdrTargetVsAchieved,
  getOccupancyTargetVsAchieved,
  resolveTargetsFy,
} from "@/lib/bigquery/queries/targets";
import { getPropertyTargetComparison } from "@/lib/bigquery/queries/propertyTargets";
import { getGoogleReviewStats, getGoogleRatingTrend, getOtaReviewStats, getOtaRatingTrend } from "@/lib/bigquery/queries/reviews";
import { resolveFilter } from "@/lib/bigquery/queries/filters";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import PerformanceContent from "@/components/performance/PerformanceContent";

// 2026-09-02 redesign, fifth pass — merges the old Targets and Reviews pages.
export default async function PerformancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  // leadership_targets isn't property-scoped (§6.5) — only the period tab applies.
  const targetsFilter = { period: filter.period, customStart: filter.customStart, customEnd: filter.customEnd, compareYoY: filter.compareYoY };
  // Reviews tables aren't restricted to "active properties" (§2.6 keeps FO in
  // scope, and LP has historical rows) — only apply a property filter when the
  // user explicitly picked one.
  const reviewsFilter = { properties: filter.properties, period: filter.period, customStart: filter.customStart, customEnd: filter.customEnd, compareYoY: filter.compareYoY };
  const fy = resolveTargetsFy(targetsFilter);
  const resolved = resolveFilter(filter);

  // monthlyRevenueTargets is fetched once here and reused for both the
  // monthly chart AND the revenueAchievement summary (via
  // summarizeRevenueAchievement, a pure function — no extra BigQuery round trip).
  const [categoryAchievement, monthlyRevenueTargets, adrTargetVsAchieved, occupancyTargetVsAchieved, propertyTargetComparison, googleStats, googleTrend, otaStats, otaTrend] =
    await Promise.all([
      getCategoryAchievement(targetsFilter),
      getMonthlyRevenueTargets(fy),
      getAdrTargetVsAchieved(fy),
      getOccupancyTargetVsAchieved(fy),
      getPropertyTargetComparison(resolved.properties),
      getGoogleReviewStats(reviewsFilter),
      getGoogleRatingTrend(reviewsFilter),
      getOtaReviewStats(reviewsFilter),
      getOtaRatingTrend(reviewsFilter),
    ]);

  const revenueAchievement = summarizeRevenueAchievement(monthlyRevenueTargets);

  return (
    <PerformanceContent
      fy={fy}
      categoryAchievement={categoryAchievement}
      revenueAchievement={revenueAchievement}
      monthlyRevenueTargets={monthlyRevenueTargets}
      adrTargetVsAchieved={adrTargetVsAchieved}
      occupancyTargetVsAchieved={occupancyTargetVsAchieved}
      propertyTargetComparison={propertyTargetComparison}
      googleStats={googleStats}
      googleTrend={googleTrend}
      otaStats={otaStats}
      otaTrend={otaTrend}
      compareYoY={filter.compareYoY ?? false}
    />
  );
}
