"use client";

import { ReviewStats, RatingTrendPoint } from "@/lib/bigquery/queries/reviews";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import MultiSeriesLineChart from "@/components/charts/MultiSeriesLineChart";

function RatingTrendCard({ title, trend }: { title: string; trend: RatingTrendPoint[] }) {
  const data = trend.map((p) => ({ month: p.monthLabel, count: p.count }));
  return (
    <Card title={title}>
      {trend.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
          No reviews for this period.
        </p>
      ) : (
        <MultiSeriesLineChart data={data} xKey="month" series={[{ key: "count", color: "var(--series-1)" }]} valueFormatter={(v) => v.toLocaleString("en-IN")} />
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

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Google Reviews</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Overall Avg Rating"
            value={googleStats.avgRating !== null ? googleStats.avgRating.toFixed(2) : "—"}
            delta={googleStats.comparison.avgRating.pctChange !== null ? { pct: googleStats.comparison.avgRating.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile
            label="Total Reviews"
            value={googleStats.totalReviews.toLocaleString("en-IN")}
            delta={googleStats.comparison.totalReviews.pctChange !== null ? { pct: googleStats.comparison.totalReviews.pctChange * 100, label: "vs previous" } : undefined}
          />
        </div>
        <div className="mt-3">
          <RatingTrendCard title="Rating Count Trend" trend={googleTrend} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">OTA Reviews</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Overall Avg Rating"
            value={otaStats.avgRating !== null ? otaStats.avgRating.toFixed(2) : "—"}
            delta={otaStats.comparison.avgRating.pctChange !== null ? { pct: otaStats.comparison.avgRating.pctChange * 100, label: "vs previous" } : undefined}
          />
          <StatTile
            label="Total Reviews"
            value={otaStats.totalReviews.toLocaleString("en-IN")}
            delta={otaStats.comparison.totalReviews.pctChange !== null ? { pct: otaStats.comparison.totalReviews.pctChange * 100, label: "vs previous" } : undefined}
          />
        </div>
        <div className="mt-3">
          <RatingTrendCard title="Rating Count Trend" trend={otaTrend} />
        </div>
      </div>
    </div>
  );
}
