import { getBrandOccupancy, getCategoryRevenueByFy } from "../lib/bigquery/queries/brandCategory";

async function main() {
  console.log("--- Brand Occupancy, FY 25-26 ---");
  console.log(await getBrandOccupancy({ fys: ["FY 25-26"] }));

  console.log("--- Category Revenue by FY ---");
  console.log(await getCategoryRevenueByFy({}));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
