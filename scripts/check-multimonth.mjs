import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery({ projectId: "skyla-analytics" });
const T = (n) => `\`skyla-analytics.Skyla_Sales_Automation.${n}\``;

// April 2025 (FY25-26 month 4) + December 2025 (FY25-26 month 12), non-contiguous
const [rows] = await bq.query({
  query: `
    SELECT
      SUM(DailyRevenue) AS revenue,
      COUNT(*) AS nights
    FROM ${T("sales_booking")}
    WHERE Property IN UNNEST(['KDP','HTC','JHS','BH4','GB'])
      AND EXTRACT(MONTH FROM CAST(StayDate AS DATE)) IN (4, 12)
      AND CAST(StayDate AS DATE) BETWEEN '2025-04-01' AND '2026-03-31'
  `,
});
console.log("April + December FY25-26 (correct, gap excluded):", rows[0]);

const [wrongRows] = await bq.query({
  query: `
    SELECT SUM(DailyRevenue) AS revenue, COUNT(*) AS nights
    FROM ${T("sales_booking")}
    WHERE Property IN UNNEST(['KDP','HTC','JHS','BH4','GB'])
      AND CAST(StayDate AS DATE) BETWEEN '2025-04-01' AND '2025-12-31'
  `,
});
console.log("Naive BETWEEN Apr-Dec (WRONG, would include May-Nov gap):", wrongRows[0]);
