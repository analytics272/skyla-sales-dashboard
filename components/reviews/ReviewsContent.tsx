"use client";

import { ReviewStats, RatingTrendPoint } from "@/lib/bigquery/queries/reviews";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import { FISCAL_MONTH_ORDER, MONTH_ABBR } from "@/lib/charts/pivotByFiscalMonth";

// Fiscal months for the selected FY(s) — summed across FYs when more than one
// is selected (blended, same aggregation convention as every other multi-select
// filter here), not a multi-year comparison with separate lines.
function RatingTrendCard({ title, trend }: { title: string; trend: RatingTrendPoint[] }) {
  const totalCount = trend.reduce((s, p) => s + p.count, 0);
  const data: BarDatum[] = FISCAL_MONTH_ORDER.map((month) => ({
    name: MONTH_ABBR[month],
    value: trend.filter((p) => p.monthNumber === month).reduce((s, p) => s + p.count, 0),
    color: "var(--series-1)",
  }));
  return (
    <Card title={title}>
      {totalCount === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
          No reviews for this period.
        </p>
      ) : (
        <SingleMetricBarChart data={data} valueFormatter={(v) => v.toLocaleString("en-IN")} />
      )}
    </Card>
  );
}

export default function ReviewsContent({
  googleStats,
  googleTrend,
  otaStats,
  otaTrend,
}: {
  googleStats: ReviewStats;
  googleTrend: RatingTrendPoint[];
  otaStats: ReviewStats;
  otaTrend: RatingTrendPoint[];
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Reviews</h2>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Google Reviews</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Overall Avg Rating" value={googleStats.avgRating !== null ? googleStats.avgRating.toFixed(2) : "—"} />
          <StatTile label="Total Reviews" value={googleStats.totalReviews.toLocaleString("en-IN")} />
        </div>
        <div className="mt-3">
          <RatingTrendCard title="Rating Count Trend" trend={googleTrend} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">OTA Reviews</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Overall Avg Rating" value={otaStats.avgRating !== null ? otaStats.avgRating.toFixed(2) : "—"} />
          <StatTile label="Total Reviews" value={otaStats.totalReviews.toLocaleString("en-IN")} />
        </div>
        <div className="mt-3">
          <RatingTrendCard title="Rating Count Trend" trend={otaTrend} />
        </div>
      </div>
    </div>
  );
}
