import { BigQuery } from "@google-cloud/bigquery";

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID ?? "skyla-analytics";
export const DATASET = process.env.BIGQUERY_DATASET ?? "Skyla_Sales_Automation";

function buildClient(): BigQuery {
  const keyB64 = process.env.GCP_SERVICE_ACCOUNT_KEY_B64;
  if (keyB64) {
    const credentials = JSON.parse(Buffer.from(keyB64, "base64").toString("utf8"));
    return new BigQuery({ projectId: PROJECT_ID, credentials });
  }
  // Local dev falls back to GOOGLE_APPLICATION_CREDENTIALS file path.
  return new BigQuery({ projectId: PROJECT_ID });
}

let client: BigQuery | undefined;

export function getBigQueryClient(): BigQuery {
  if (!client) client = buildClient();
  return client;
}

/** Table reference helper: qualifies a bare table name with project.dataset. */
export function table(name: string): string {
  return `\`${PROJECT_ID}.${DATASET}.${name}\``;
}

// 2026-09-19 — F&B POS data (PRD_Reports_Section_Final.md §0) lives in a
// separate dataset from the rest of the pipeline (`skyla_data`, not
// `Skyla_Sales_Automation`), so it needs its own qualifier rather than
// `table()`'s hardcoded DATASET.
const FNB_DATASET = "skyla_data";
export function fnbTable(name: string): string {
  return `\`${PROJECT_ID}.${FNB_DATASET}.${name}\``;
}

export async function runQuery<T = Record<string, unknown>>(
  query: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const bq = getBigQueryClient();
  const [rows] = await bq.query({ query, params, useLegacySql: false });
  return rows as T[];
}
