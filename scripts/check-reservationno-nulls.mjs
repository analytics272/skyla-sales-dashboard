import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery({ projectId: "skyla-analytics" });
const T = (n) => `\`skyla-analytics.Skyla_Sales_Automation.${n}\``;

const [rows] = await bq.query({
  query: `
    SELECT
      COUNTIF(ReservationNo IS NULL) AS null_resno,
      COUNTIF(TRIM(ReservationNo) = '') AS blank_resno,
      COUNT(DISTINCT CONCAT(Property, '|', ReservationNo)) AS concat_distinct,
      COUNT(*) AS total_rows
    FROM ${T("sales_booking")}
    WHERE CAST(StayDate AS DATE) BETWEEN '2025-04-01' AND '2026-03-31'
  `,
});
console.log(rows[0]);

const [grouped] = await bq.query({
  query: `
    SELECT COUNT(*) AS grouped_count FROM (
      SELECT Property, ReservationNo
      FROM ${T("sales_booking")}
      WHERE CAST(StayDate AS DATE) BETWEEN '2025-04-01' AND '2026-03-31'
      GROUP BY Property, ReservationNo
    )
  `,
});
console.log(grouped[0]);
