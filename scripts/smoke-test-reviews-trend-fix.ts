import { getGoogleRatingTrend, getOtaRatingTrend } from "../lib/bigquery/queries/reviews";

async function main() {
  const googleTrend = await getGoogleRatingTrend({ fys: ["FY 25-26"] });
  const otaTrend = await getOtaRatingTrend({ fys: ["FY 25-26"] });

  console.log("Google trend FY values (should be only FY 25-26):", [...new Set(googleTrend.map((p) => p.fy))]);
  console.log("Google trend points:", googleTrend.length);
  console.table(googleTrend);

  console.log("OTA trend FY values (should be only FY 25-26):", [...new Set(otaTrend.map((p) => p.fy))]);
  console.table(otaTrend);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
