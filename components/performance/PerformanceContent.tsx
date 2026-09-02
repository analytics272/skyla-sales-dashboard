"use client";

// 2026-09-02 redesign, fifth pass — Performance merges the old Targets and
// Reviews pages. Google/OTA reviews and ADR/Occupancy target-vs-achieved were
// each already two side-by-side cards showing the same shape of chart for a
// different slice — folded into one TabbedCard apiece per item #11.
import { CategoryAchievement, RevenueAchievement, MonthlyRevenueTarget, MonthlyAdrTarget, MonthlyOccupancyTarget } from "@/lib/bigquery/queries/targets";
import type { PropertyTargetComparisonResult } from "@/lib/bigquery/queries/propertyTargets";
import { ReviewStats, RatingTrendPoint } from "@/lib/bigquery/queries/reviews";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import TabbedCard, { useTabbedCard } from "@/components/ui/TabbedCard";
import ProgressBar from "@/components/ui/ProgressBar";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import MultiSeriesLineChart from "@/components/charts/MultiSeriesLineChart";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { TARGET_VS_ACHIEVED_COLOR, REVENUE_ROLLOVER_COLOR } from "@/lib/design/tokens";
import { calendarMonthFromFiscal, isFutureFiscalMonth } from "@/lib/reference/financialYear";

const TA_SERIES = [
  { key: "target", color: TARGET_VS_ACHIEVED_COLOR.target },
  { key: "achieved", color: TARGET_VS_ACHIEVED_COLOR.achieved },
];

const ROLLOVER_SERIES = [
  { key: "deptTarget", color: REVENUE_ROLLOVER_COLOR.deptTarget },
  { key: "targetWithRollOver", color: REVENUE_ROLLOVER_COLOR.targetWithRollOver },
  { key: "achieved", color: REVENUE_ROLLOVER_COLOR.achieved },
];

// Null out "achieved" only when the month hasn't started AND there's
// genuinely nothing recorded yet — so the line stops there instead of
// flat-lining at 0 as if "achieved nothing" were a settled outcome. A
// calendar-future month with real advance/forward-booked revenue already
// against it (common in hospitality) still shows that real value. Target/plan
// series aren't touched either way — they're meant to project the full FY.
function shouldHideAchieved(fy: string, monthNumber: number, achieved: number) {
  return achieved === 0 && isFutureFiscalMonth(fy, calendarMonthFromFiscal(monthNumber));
}

function RatingTrendChart({ trend }: { trend: RatingTrendPoint[] }) {
  const data = trend.map((p) => ({ month: p.monthLabel, count: p.count }));
  return trend.length === 0 ? (
    <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">No reviews for this period.</p>
  ) : (
    <MultiSeriesLineChart data={data} xKey="month" series={[{ key: "count", color: "var(--series-1)" }]} valueFormatter={(v) => v.toLocaleString("en-IN")} />
  );
}

type TargetTrendTab = "ADR" | "Occupancy";
const TARGET_TREND_TABS: TargetTrendTab[] = ["ADR", "Occupancy"];

type ReviewsTab = "Google" | "OTA";
const REVIEWS_TABS: ReviewsTab[] = ["Google", "OTA"];

export default function PerformanceContent({
  fy,
  categoryAchievement,
  revenueAchievement,
  monthlyRevenueTargets,
  adrTargetVsAchieved,
  occupancyTargetVsAchieved,
  propertyTargetComparison,
  googleStats,
  googleTrend,
  otaStats,
  otaTrend,
}: {
  fy: string;
  categoryAchievement: CategoryAchievement[];
  revenueAchievement: RevenueAchievement;
  monthlyRevenueTargets: MonthlyRevenueTarget[];
  adrTargetVsAchieved: MonthlyAdrTarget[];
  occupancyTargetVsAchieved: MonthlyOccupancyTarget[];
  propertyTargetComparison: PropertyTargetComparisonResult;
  googleStats: ReviewStats;
  googleTrend: RatingTrendPoint[];
  otaStats: ReviewStats;
  otaTrend: RatingTrendPoint[];
}) {
  const categoryData = categoryAchievement.map((c) => ({ category: c.category, target: c.target, achieved: c.achieved }));
  const propertyRevenueData = propertyTargetComparison.rows.map((r) => ({ property: r.property, Target: r.targetRevenue, Achieved: r.achievedRevenue }));

  const propertyTabs = propertyTargetComparison.rows.map((r) => r.property);
  const [activeProperty, setActiveProperty] = useTabbedCard(propertyTabs);
  const activeRow = propertyTargetComparison.rows.find((r) => r.property === activeProperty) ?? propertyTargetComparison.rows[0];

  const [targetTrendTab, setTargetTrendTab] = useTabbedCard(TARGET_TREND_TABS);
  const [reviewsTab, setReviewsTab] = useTabbedCard(REVIEWS_TABS);
  const activeReviewStats = reviewsTab === "Google" ? googleStats : otaStats;
  const activeReviewTrend = reviewsTab === "Google" ? googleTrend : otaTrend;

  return (
    <div className="space-y-6">
      <div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2">
          <StatTile
            label="Revenue Achievement"
            value={revenueAchievement.achievedPct !== null ? formatPercent(revenueAchievement.achievedPct) : "—"}
            sub={`${formatIndianCurrency(revenueAchievement.achieved)} of ${formatIndianCurrency(revenueAchievement.target)}`}
            progress={revenueAchievement.achievedPct !== null ? { pct: revenueAchievement.achievedPct } : undefined}
          />
          <StatTile label="Target" value={formatIndianCurrency(revenueAchievement.target)} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Revenue Targets By Property</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Fixed reference plan — {fy}</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total Target" value={formatIndianCurrency(propertyTargetComparison.total.targetRevenue)} />
          <StatTile label="Total Achieved" value={formatIndianCurrency(propertyTargetComparison.total.achievedRevenue)} />
          <StatTile
            label="Overall Achievement"
            value={propertyTargetComparison.total.achievedPct !== null ? formatPercent(propertyTargetComparison.total.achievedPct, 0) : "—"}
            progress={propertyTargetComparison.total.achievedPct !== null ? { pct: propertyTargetComparison.total.achievedPct } : undefined}
          />
          <StatTile label="Overall Occ %" value={propertyTargetComparison.total.achievedOccPct !== null ? formatPercent(propertyTargetComparison.total.achievedOccPct, 0) : "—"} />
        </div>
        <Card title="Target Vs Achieved Revenue By Property">
          <GroupedBarChart
            data={propertyRevenueData}
            xKey="property"
            series={[
              { key: "Target", color: TARGET_VS_ACHIEVED_COLOR.target },
              { key: "Achieved", color: TARGET_VS_ACHIEVED_COLOR.achieved },
            ]}
            valueFormatter={(v) => formatIndianCurrency(v)}
          />
        </Card>
        <div className="mt-3">
          <TabbedCard title="Property Detail" tabs={propertyTabs} active={activeProperty} onChange={setActiveProperty}>
            {activeRow && (
              <>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Achieved Revenue</p>
                <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{formatIndianCurrency(activeRow.achievedRevenue)}</p>
                {activeRow.achievedPct !== null && (
                  <div className="mt-2">
                    <ProgressBar pct={activeRow.achievedPct} />
                    <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                      {formatPercent(activeRow.achievedPct, 0)} of {formatIndianCurrency(activeRow.targetRevenue)} target
                    </p>
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800 sm:grid-cols-4">
                  <StatTile label="Target Occ %" value={activeRow.targetOccPct !== null ? formatPercent(activeRow.targetOccPct, 0) : "—"} />
                  <StatTile label="Achieved Occ %" value={activeRow.achievedOccPct !== null ? formatPercent(activeRow.achievedOccPct, 0) : "—"} />
                  <StatTile label="Target ARR" value={activeRow.targetArr !== null ? `₹${Math.round(activeRow.targetArr).toLocaleString("en-IN")}` : "—"} />
                  <StatTile label="Achieved ARR" value={activeRow.achievedArr !== null ? `₹${Math.round(activeRow.achievedArr).toLocaleString("en-IN")}` : "—"} />
                </div>
              </>
            )}
          </TabbedCard>
        </div>
      </div>

      <Card title="B2B / B2C / OTA Achievement">
        <GroupedBarChart data={categoryData} xKey="category" series={TA_SERIES} valueFormatter={(v) => formatIndianCurrency(v)} />
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          {categoryAchievement.map((c) => (
            <div key={c.category}>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{c.category}</p>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {c.achievedPct !== null ? formatPercent(c.achievedPct) : "—"}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Revenue Targets With Roll Over">
        <MultiSeriesLineChart
          data={monthlyRevenueTargets.map((r) => ({
            month: r.month,
            deptTarget: r.deptTarget,
            targetWithRollOver: r.targetWithRollOver,
            achieved: shouldHideAchieved(fy, r.monthNumber, r.achievedRevenue) ? null : r.achievedRevenue,
          }))}
          xKey="month"
          series={ROLLOVER_SERIES}
          valueFormatter={(v) => formatIndianCurrency(v)}
          height={260}
        />
      </Card>

      <TabbedCard title="Target Vs Achieved" tabs={TARGET_TREND_TABS} active={targetTrendTab} onChange={setTargetTrendTab}>
        {targetTrendTab === "ADR" ? (
          <MultiSeriesLineChart
            data={adrTargetVsAchieved.map((r) => ({ month: r.month, target: r.targetAdr, achieved: shouldHideAchieved(fy, r.monthNumber, r.achievedAdr) ? null : r.achievedAdr }))}
            xKey="month"
            series={TA_SERIES}
            valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`}
            height={260}
          />
        ) : (
          <MultiSeriesLineChart
            data={occupancyTargetVsAchieved.map((r) => ({
              month: r.month,
              target: r.targetOccupancyPct * 100,
              achieved: shouldHideAchieved(fy, r.monthNumber, r.achievedOccupancyPct) ? null : r.achievedOccupancyPct * 100,
            }))}
            xKey="month"
            series={TA_SERIES}
            valueFormatter={(v) => `${v.toFixed(0)}%`}
            height={260}
          />
        )}
      </TabbedCard>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Reviews</h3>
        <TabbedCard title="Rating Count Trend" subtitle={`${reviewsTab} reviews`} tabs={REVIEWS_TABS} active={reviewsTab} onChange={setReviewsTab}>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Overall Avg Rating"
              value={activeReviewStats.avgRating !== null ? activeReviewStats.avgRating.toFixed(2) : "—"}
              delta={activeReviewStats.comparison.avgRating.pctChange !== null ? { pct: activeReviewStats.comparison.avgRating.pctChange * 100, label: "vs previous" } : undefined}
            />
            <StatTile
              label="Total Reviews"
              value={activeReviewStats.totalReviews.toLocaleString("en-IN")}
              delta={activeReviewStats.comparison.totalReviews.pctChange !== null ? { pct: activeReviewStats.comparison.totalReviews.pctChange * 100, label: "vs previous" } : undefined}
            />
          </div>
          <RatingTrendChart trend={activeReviewTrend} />
        </TabbedCard>
      </div>
    </div>
  );
}
