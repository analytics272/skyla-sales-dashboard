import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery({ projectId: "skyla-analytics" });
const T = (n) => `\`skyla-analytics.Skyla_Sales_Automation.${n}\``;

const [rows] = await bq.query({
  query: `SELECT Financial_Year, COUNT(*) AS n FROM ${T("b2b_bills")} GROUP BY Financial_Year ORDER BY n DESC LIMIT 15`,
});
console.log("--- Financial_Year distinct values ---");
for (const r of rows) console.log(r);

const [sample] = await bq.query({
  query: `SELECT Check_In, Financial_Year, Property, Company, Nights, ADR, Contract_Status FROM ${T("b2b_bills")} WHERE Company IS NOT NULL LIMIT 5`,
});
console.log("--- sample rows ---");
for (const r of sample) console.log(r);
