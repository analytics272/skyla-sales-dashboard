// One-off connectivity smoke test — not part of the app, run manually during Phase 1.
// Usage: node --env-file=.env.local scripts/smoke-test-bigquery.mjs
import { BigQuery } from "@google-cloud/bigquery";

const projectId = process.env.BIGQUERY_PROJECT_ID ?? "skyla-analytics";
const dataset = process.env.BIGQUERY_DATASET ?? "Skyla_Sales_Automation";

const bq = new BigQuery({ projectId });

const tables = [
  "sales_booking",
  "sales_booking_cancelled",
  "b2b_bills",
  "lead_tracker",
  "leadership_targets",
  "ota",
  "rating_sheet",
];

for (const t of tables) {
  const [rows] = await bq.query({
    query: `SELECT COUNT(*) AS row_count FROM \`${projectId}.${dataset}.${t}\``,
  });
  console.log(`${t}: ${rows[0].row_count} rows`);
}
