import { BigQuery } from "@google-cloud/bigquery";

const bq = new BigQuery({ projectId: "skyla-analytics" });

async function run(label, query) {
  const [rows] = await bq.query({ query });
  console.log(`--- ${label} ---`);
  for (const r of rows) console.log(r);
}

await run(
  "sales_booking+cancelled StayDate range per property (StayDate is STRING)",
  `SELECT Property, MIN(StayDate) AS min_stay, MAX(StayDate) AS max_stay, COUNT(*) AS n
   FROM (
     SELECT Property, StayDate FROM \`skyla-analytics.Skyla_Sales_Automation.sales_booking\`
     UNION ALL
     SELECT Property, StayDate FROM \`skyla-analytics.Skyla_Sales_Automation.sales_booking_cancelled\`
   )
   GROUP BY Property ORDER BY Property`
);

await run(
  "b2b_bills distinct Property values",
  `SELECT Property, COUNT(*) AS n FROM \`skyla-analytics.Skyla_Sales_Automation.b2b_bills\`
   GROUP BY Property ORDER BY n DESC`
);

await run(
  "ota distinct Property-like column check",
  `SELECT column_name FROM \`skyla-analytics.Skyla_Sales_Automation.INFORMATION_SCHEMA.COLUMNS\`
   WHERE table_name = 'ota'`
);
