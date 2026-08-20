import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery({ projectId: "skyla-analytics" });
const T = (n) => `\`skyla-analytics.Skyla_Sales_Automation.${n}\``;

const [rows] = await bq.query({
  query: `
    SELECT DATE, EXTRACT(MONTH FROM CAST(DATE AS DATE)) AS month_num, COUNT(*) AS n
    FROM ${T("ota")}
    WHERE CAST(DATE AS DATE) BETWEEN '2025-04-01' AND '2026-03-31'
    GROUP BY DATE, month_num
    ORDER BY DATE
  `,
});
console.log("total rows in range:", rows.reduce((s, r) => s + r.n, 0));
console.table(rows);
