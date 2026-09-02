import { getGoogleReviewStats, getGoogleRatingTrend, getOtaReviewStats, getOtaRatingTrend } from "@/lib/bigquery/queries/reviews";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import ReviewsContent from "@/components/reviews/ReviewsContent";

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  // Reviews tables aren't restricted to "active properties" (§2.6 keeps FO in
  // scope, and LP has historical rows) — only apply a property filter when the
  // user explicitly picked one.
  const reviewsFilter = { properties: filter.properties, period: filter.period };

  const [googleStats, googleTrend, otaStats, otaTrend] = await Promise.all([
    getGoogleReviewStats(reviewsFilter),
    getGoogleRatingTrend(reviewsFilter),
    getOtaReviewStats(reviewsFilter),
    getOtaRatingTrend(reviewsFilter),
  ]);

  return <ReviewsContent googleStats={googleStats} googleTrend={googleTrend} otaStats={otaStats} otaTrend={otaTrend} />;
}
