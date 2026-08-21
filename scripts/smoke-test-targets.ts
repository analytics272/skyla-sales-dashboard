import {
  getCategoryAchievement,
  getRevenueAchievement,
  getAdrTargetVsAchieved,
  getOccupancyTargetVsAchieved,
} from "../lib/bigquery/queries/targets";
import { formatIndianCurrency, formatPercent } from "../lib/format/currency";

async function main() {
  console.log("--- Category Achievement, FY 25-26 ---");
  console.log(await getCategoryAchievement({ fys: ["FY 25-26"] }));

  console.log("--- Revenue Achievement, FY 25-26 ---");
  const rev = await getRevenueAchievement({ fys: ["FY 25-26"] });
  console.log({
    ...rev,
    target: formatIndianCurrency(rev.target),
    achieved: formatIndianCurrency(rev.achieved),
    achievedPct: rev.achievedPct !== null ? formatPercent(rev.achievedPct) : null,
  });

  console.log("--- Revenue Achievement, FY 25-26, Q2 ---");
  console.log(await getRevenueAchievement({ fys: ["FY 25-26"], quarter: 2 }));

  console.log("--- ADR Target vs Achieved, FY 25-26 ---");
  console.log(await getAdrTargetVsAchieved("FY 25-26"));

  console.log("--- Occupancy Target vs Achieved, FY 25-26 ---");
  console.log(await getOccupancyTargetVsAchieved("FY 25-26"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
