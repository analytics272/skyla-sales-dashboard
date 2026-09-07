import {
  getCategoryAchievement,
  summarizeRevenueAchievement,
  filterMonthlyToRange,
  getMonthlyRevenueTargets,
  getAdrTargetVsAchieved,
  getOccupancyTargetVsAchieved,
  resolveTargetsFy,
  resolveTargetsRange,
} from "@/lib/bigquery/queries/targets";
import { getPropertyTargetComparison } from "@/lib/bigquery/queries/propertyTargets";
import { getGoogleReviewStats, getGoogleRatingTrend, getOtaReviewStats, getOtaRatingTrend } from "@/lib/bigquery/queries/reviews";
import { resolveFilter } from "@/lib/bigquery/queries/filters";
import { resolvePeriodFromFilter } from "@/lib/reference/period";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import PerformanceContent from "@/components/performance/PerformanceContent";

// 2026-09-02 redesign, fifth pass — merges the old Targets and Reviews pages.
// 2026-09-07: the period filter now applies to every leadership_targets and
// property-targets section too — see resolveTargetsRange / getPropertyTargetComparison.
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
  const range = resolveTargetsRange(targetsFilter, fy);
  const resolved = resolveFilter(filter);
  // "This FY" keeps the annual-plan reading ("Full FY 26-27"); every other
  // tab now genuinely scopes the targets sections to its own window, so the
  // caption should say which one rather than always claiming "Fixed — {fy}".
  const targetsPeriod = resolvePeriodFromFilter(targetsFilter);
  const targetsRangeLabel = targetsPeriod.key === "this_fy" ? `Full ${fy}` : targetsPeriod.currentLabel;

  // monthlyRevenueTargets is always fetched for the FULL FY (its rollover
  // cascade needs every prior month regardless of what's displayed) and
  // reused for both the monthly chart (filtered to `range` below) AND the
  // revenueAchievement summary (via summarizeRevenueAchievement, which
  // prorates internally) — no extra BigQuery round trip either way.
  const [categoryAchievement, monthlyRevenueTargets, adrTargetVsAchieved, occupancyTargetVsAchieved, propertyTargetComparison, googleStats, googleTrend, otaStats, otaTrend] =
    await Promise.all([
      getCategoryAchievement(targetsFilter),
      getMonthlyRevenueTargets(fy),
      getAdrTargetVsAchieved(fy, range),
      getOccupancyTargetVsAchieved(fy, range),
      getPropertyTargetComparison(resolved.properties, targetsFilter),
      getGoogleReviewStats(reviewsFilter),
      getGoogleRatingTrend(reviewsFilter),
      getOtaReviewStats(reviewsFilter),
      getOtaRatingTrend(reviewsFilter),
    ]);

  const revenueAchievement = summarizeRevenueAchievement(monthlyRevenueTargets, fy, range);
  const monthlyRevenueTargetsInRange = filterMonthlyToRange(monthlyRevenueTargets, fy, range);

  return (
    <PerformanceContent
      fy={fy}
      targetsRangeLabel={targetsRangeLabel}
      categoryAchievement={categoryAchievement}
      revenueAchievement={revenueAchievement}
      monthlyRevenueTargets={monthlyRevenueTargetsInRange}
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
