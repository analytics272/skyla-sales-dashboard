import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery({ projectId: "skyla-analytics" });
const T = (n) => `\`skyla-analytics.Skyla_Sales_Automation.${n}\``;

async function run(label, query) {
  const [rows] = await bq.query({ query });
  console.log(`--- ${label} ---`);
  for (const r of rows) console.log(r);
}

await run(
  "rating_sheet: distinct years from Date, sorted",
  `SELECT EXTRACT(YEAR FROM CAST(Date AS DATE)) AS yr, COUNT(*) AS n
   FROM ${T("rating_sheet")}
   GROUP BY yr ORDER BY yr`
);

await run(
  "rating_sheet: sample rows with year outside 2023-2027",
  `SELECT Date, Property, Platform, Name, FY_year, Month
   FROM ${T("rating_sheet")}
   WHERE EXTRACT(YEAR FROM CAST(Date AS DATE)) NOT BETWEEN 2023 AND 2027
   LIMIT 10`
);

await run(
  "ota: distinct years from DATE (string), sorted",
  `SELECT EXTRACT(YEAR FROM SAFE_CAST(DATE AS DATE)) AS yr, COUNT(*) AS n
   FROM ${T("ota")}
   GROUP BY yr ORDER BY yr`
);

await run(
  "ota: sample rows with year outside 2023-2027",
  `SELECT DATE, DATE_B, Property, Source, FY_year, Month
   FROM ${T("ota")}
   WHERE EXTRACT(YEAR FROM SAFE_CAST(DATE AS DATE)) NOT BETWEEN 2023 AND 2027
      OR SAFE_CAST(DATE AS DATE) IS NULL
   LIMIT 15`
);
