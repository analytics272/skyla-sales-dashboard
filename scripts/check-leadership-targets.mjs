import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery({ projectId: "skyla-analytics" });

const [cols] = await bq.query({
  query: `SELECT column_name, data_type FROM \`skyla-analytics.Skyla_Sales_Automation.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = 'leadership_targets' ORDER BY ordinal_position`,
});
console.log("--- columns ---");
for (const c of cols) console.log(c.column_name, c.data_type);

const [sample] = await bq.query({
  query: `SELECT * FROM \`skyla-analytics.Skyla_Sales_Automation.leadership_targets\` LIMIT 3`,
});
console.log("--- sample rows ---");
for (const r of sample) console.log(JSON.stringify(r, null, 2));
