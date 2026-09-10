"use client";

// 2026-09-02 redesign, fifth pass — Performance merges the old Targets and
// Reviews pages. Google/OTA reviews and ADR/Occupancy target-vs-achieved were
// each already two side-by-side cards showing the same shape of chart for a
// different slice — folded into one TabbedCard apiece per item #11.
import { CategoryAchievement, RevenueAchievement, MonthlyRevenueTarget, MonthlyAdrTarget, MonthlyOccupancyTarget } from "@/lib/bigquery/queries/targets";
import type { PropertyTargetComparisonResult } from "@/lib/bigquery/queries/propertyTargets";
import { ReviewStats, RatingTrendSeries } from "@/lib/bigquery/queries/reviews";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import TabbedCard, { useTabbedCard } from "@/components/ui/TabbedCard";
import ProgressBar from "@/components/ui/ProgressBar";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import MultiSeriesLineChart from "@/components/charts/MultiSeriesLineChart";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { TARGET_VS_ACHIEVED_COLOR, REVENUE_ROLLOVER_COLOR, BRAND_COLOR } from "@/lib/design/tokens";
import { brandOf } from "@/lib/reference/propertyReference";
import BrandDot from "@/components/ui/BrandDot";
import { calendarMonthFromFiscal, isFutureFiscalMonth } from "@/lib/reference/financialYear";

const brandTickColor = (code: string) => BRAND_COLOR[brandOf(code) ?? ""];

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

// Item #4 (2026-09-02, seventh pass): one opt-in previous-year line, same
// pattern as every other trend chart, paired by index (this month's point
// vs. the same-position point 12 months back) — not the old one-line-per-FY
// model this file's history comment above still describes.
function RatingTrendChart({ trend, compareYoY }: { trend: RatingTrendSeries; compareYoY: boolean }) {
  const len = compareYoY ? Math.max(trend.current.length, trend.previous.length) : trend.current.length;
  const data = Array.from({ length: len }, (_, i) => {
    const c = trend.current[i];
    const p = trend.previous[i];
    return {
      month: c?.monthLabel ?? p?.monthLabel ?? `#${i + 1}`,
      count: c?.count ?? 0,
      ...(compareYoY ? { previousCount: p ? p.count : null } : {}),
    };
  });
  const series = [
    { key: "count", color: "var(--series-1)" },
    ...(compareYoY ? [{ key: "previousCount", color: "var(--chart-baseline)" }] : []),
  ];
  return trend.current.length === 0 ? (
    <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">No reviews for this period.</p>
  ) : (
    <MultiSeriesLineChart data={data} xKey="month" series={series} valueFormatter={(v) => v.toLocaleString("en-IN")} />
  );
}

type TargetTrendTab = "ADR" | "Occupancy";
const TARGET_TREND_TABS: TargetTrendTab[] = ["ADR", "Occupancy"];

type ReviewsTab = "Google" | "OTA";
const REVIEWS_TABS: ReviewsTab[] = ["Google", "OTA"];

export default function PerformanceContent({
  fy,
  targetsRangeLabel,
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
  compareYoY,
}: {
  fy: string;
  /** "Full FY 26-27" on the This FY tab, otherwise the active period's own label (e.g. "August 2026", "Last 30 Days") — every targets section below is now scoped to this, not always the whole FY. */
  targetsRangeLabel: string;
  categoryAchievement: CategoryAchievement[];
  revenueAchievement: RevenueAchievement;
  monthlyRevenueTargets: MonthlyRevenueTarget[];
  adrTargetVsAchieved: MonthlyAdrTarget[];
  occupancyTargetVsAchieved: MonthlyOccupancyTarget[];
  propertyTargetComparison: PropertyTargetComparisonResult;
  googleStats: ReviewStats;
  googleTrend: RatingTrendSeries;
  otaStats: ReviewStats;
  otaTrend: RatingTrendSeries;
  compareYoY: boolean;
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
    <div className="space-y-4">
      {/* 2026-09-07, tenth pass: "Revenue Achievement" (company-wide, from
          leadership_targets — a separately-maintained target-tracking table)
          and the four "Total Target/Achieved/..." tiles (this property's own
          fixed reference plan vs a LIVE sales_booking sum) are two genuinely
          different data sources that don't reconcile exactly — confirmed
          live 2026-09-07: 11.11 Cr vs 10.74 Cr for FY 26-27, a real ~3.3%
          gap between how the two systems track "achieved revenue", not a
          filter or dashboard bug. The prior pass's merge into one undivided
          row made that look like one consistent number when it isn't — a
          divider and an explicit caption now separate the two groups.
          Also 2026-09-07: this whole section used to always show FY 26-27
          regardless of the period filter (per explicit prior direction —
          "these are fixed annual targets"). Per newer explicit direction —
          "I want filter to apply to each and everything" — every tab other
          than This FY now prorates the fixed plan down to its own date
          range (see getPropertyTargetComparison / resolveTargetsRange);
          This FY alone keeps the original whole-year-plan reading, since
          prorating an annual target down to "today's slice of the year"
          would make the attainment % meaningless (it'd land near 100% by
          construction instead of reading as "on/behind/ahead of pace"). */}
      <div>
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Revenue Targets By Property</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Reference plan — {targetsRangeLabel}</p>
        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          Revenue Achievement (company-wide, leadership targets) and the property rollup beside it (fixed plan vs live bookings) are two
          separate tracking systems — they won&apos;t match exactly.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,4fr)]">
          <StatTile
            label="Revenue Achievement"
            value={revenueAchievement.achievedPct !== null ? formatPercent(revenueAchievement.achievedPct) : "—"}
            sub={`${formatIndianCurrency(revenueAchievement.achieved)} of ${formatIndianCurrency(revenueAchievement.target)} · leadership_targets`}
            progress={revenueAchievement.achievedPct !== null ? { pct: revenueAchievement.achievedPct } : undefined}
          />
          <div className="hidden w-px bg-zinc-200 dark:bg-zinc-800 sm:block" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total Target" value={formatIndianCurrency(propertyTargetComparison.total.targetRevenue)} />
            <StatTile label="Total Achieved" value={formatIndianCurrency(propertyTargetComparison.total.achievedRevenue)} sub="live sales_booking" />
            <StatTile
              label="Overall Achievement"
              value={propertyTargetComparison.total.achievedPct !== null ? formatPercent(propertyTargetComparison.total.achievedPct, 0) : "—"}
              progress={propertyTargetComparison.total.achievedPct !== null ? { pct: propertyTargetComparison.total.achievedPct } : undefined}
            />
            <StatTile label="Overall Occ %" value={propertyTargetComparison.total.achievedOccPct !== null ? formatPercent(propertyTargetComparison.total.achievedOccPct, 0) : "—"} />
          </div>
        </div>
        {/* Item #3: bar chart + its own per-property drill-down, paired side
            by side — both are "property targets" reads and neither needs
            full card width on its own. */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="Target Vs Achieved Revenue By Property">
            <GroupedBarChart
              data={propertyRevenueData}
              xKey="property"
              series={[
                { key: "Target", color: TARGET_VS_ACHIEVED_COLOR.target },
                { key: "Achieved", color: TARGET_VS_ACHIEVED_COLOR.achieved },
              ]}
              valueFormatter={(v) => formatIndianCurrency(v)}
              xTickColor={brandTickColor}
            />
          </Card>
          <TabbedCard
            title="Property Detail"
            tabs={propertyTabs}
            active={activeProperty}
            onChange={setActiveProperty}
            tabAccent={(code) => <BrandDot property={code} />}
          >
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
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
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
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Reviews</h3>
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
          <RatingTrendChart trend={activeReviewTrend} compareYoY={compareYoY} />
        </TabbedCard>
      </div>
    </div>
  );
}
