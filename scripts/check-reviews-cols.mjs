import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery({ projectId: "skyla-analytics" });

for (const t of ["rating_sheet", "ota"]) {
  const [cols] = await bq.query({
    query: `SELECT column_name, data_type FROM \`skyla-analytics.Skyla_Sales_Automation.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${t}' ORDER BY ordinal_position`,
  });
  console.log(`--- ${t} columns ---`);
  for (const c of cols) console.log(c.column_name, c.data_type);
}

const [sample1] = await bq.query({
  query: `SELECT * FROM \`skyla-analytics.Skyla_Sales_Automation.rating_sheet\` LIMIT 3`,
});
console.log("--- rating_sheet sample ---");
for (const r of sample1) console.log(r);

const [sample2] = await bq.query({
  query: `SELECT * FROM \`skyla-analytics.Skyla_Sales_Automation.ota\` LIMIT 3`,
});
console.log("--- ota sample ---");
for (const r of sample2) console.log(r);
