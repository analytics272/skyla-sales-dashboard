import {
  getGoogleReviewStats,
  getGoogleRatingTrend,
  getOtaReviewStats,
  getOtaRatingTrend,
} from "../lib/bigquery/queries/reviews";

async function main() {
  console.log("--- Google Reviews, all-time (should include FO) ---");
  console.log(await getGoogleReviewStats({}));

  console.log("--- Google Reviews, FY 25-26 ---");
  console.log(await getGoogleReviewStats({ fys: ["FY 25-26"] }));

  console.log("--- Google Reviews, KDP only ---");
  console.log(await getGoogleReviewStats({ properties: ["KDP"] }));

  console.log("--- Google Rating Trend, FY 25-26 (first 4) ---");
  console.log((await getGoogleRatingTrend({})).filter((r) => r.fy === "FY 25-26").slice(0, 4));

  console.log("--- OTA Reviews, all-time ---");
  console.log(await getOtaReviewStats({}));

  console.log("--- OTA Rating Trend, FY 25-26 (first 4) ---");
  console.log((await getOtaRatingTrend({})).filter((r) => r.fy === "FY 25-26").slice(0, 4));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
