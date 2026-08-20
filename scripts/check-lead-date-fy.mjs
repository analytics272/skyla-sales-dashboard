import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery({ projectId: "skyla-analytics" });

const [rows] = await bq.query({
  query: `
    SELECT date, Month, Month_Number,
      EXTRACT(MONTH FROM date) AS calendar_month,
      EXTRACT(YEAR FROM date) AS calendar_year
    FROM \`skyla-analytics.Skyla_Sales_Automation.lead_tracker\`
    WHERE Name IS NOT NULL AND TRIM(Name) != '' AND date IS NOT NULL
    ORDER BY date DESC
    LIMIT 10
  `,
});
console.log(rows);

const [range] = await bq.query({
  query: `
    SELECT MIN(date) AS min_date, MAX(date) AS max_date, COUNTIF(date IS NULL) AS null_dates, COUNT(*) AS total
    FROM \`skyla-analytics.Skyla_Sales_Automation.lead_tracker\`
    WHERE Name IS NOT NULL AND TRIM(Name) != ''
  `,
});
console.log(range);
