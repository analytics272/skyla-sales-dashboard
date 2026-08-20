import { getOtaBreakdown } from "../lib/bigquery/queries/otaBreakdown";

async function main() {
  console.log("--- OTA Breakdown, FY 25-26 ---");
  console.log(await getOtaBreakdown({ fy: "FY 25-26" }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
