import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery({ projectId: "skyla-analytics" });

const [cols] = await bq.query({
  query: `SELECT column_name, data_type FROM \`skyla-analytics.Skyla_Sales_Automation.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = 'lead_tracker' ORDER BY ordinal_position`,
});
console.log("--- columns ---");
for (const c of cols) console.log(c.column_name, c.data_type);

const [formatVals] = await bq.query({
  query: `SELECT Format, COUNT(*) AS n FROM \`skyla-analytics.Skyla_Sales_Automation.lead_tracker\` WHERE Name IS NOT NULL AND TRIM(Name) != '' GROUP BY Format ORDER BY n DESC LIMIT 15`,
});
console.log("--- Format distinct values ---");
for (const r of formatVals) console.log(r);

const [monthVals] = await bq.query({
  query: `SELECT Month, Month_Number, COUNT(*) AS n FROM \`skyla-analytics.Skyla_Sales_Automation.lead_tracker\` WHERE Name IS NOT NULL AND TRIM(Name) != '' GROUP BY Month, Month_Number ORDER BY Month_Number LIMIT 15`,
});
console.log("--- Month/Month_Number sample ---");
for (const r of monthVals) console.log(r);
