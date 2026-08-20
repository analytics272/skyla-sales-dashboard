import { getMonthlyTrends, getBusinessCategoryAdrTrend } from "../lib/bigquery/queries/trends";

async function main() {
  console.log("--- Monthly Trends (all active properties) ---");
  const trends = await getMonthlyTrends({});
  console.log("total points:", trends.length);
  console.log(trends.slice(0, 6));
  console.log("...");
  console.log(trends.slice(-6));

  console.log("--- Business Category ADR Trend ---");
  console.log(await getBusinessCategoryAdrTrend({}));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
