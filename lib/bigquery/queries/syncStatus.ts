// "Last Updated" (2026-09-02 redesign, §3): the freshness of the latest
// successful Apps Script -> BigQuery sync. There's no explicit sync-log
// table or timestamp column anywhere in the schema (checked directly via
// INFORMATION_SCHEMA.COLUMNS) — so this uses BigQuery's own table metadata
// (`last_modified_time`, exposed via the legacy `__TABLES__` view) on the
// two tables the PMS sync actually writes to, sales_booking and
// sales_booking_cancelled. Whichever of the two was written to most
// recently IS the last successful sync — a real, non-fabricated signal,
// not a guess or a client-side "now".
import { runQuery, table } from "../client";

export interface SyncStatus {
  lastUpdated: string | null; // ISO timestamp
}

export async function getLastSyncTime(): Promise<SyncStatus> {
  // CAST to STRING server-side: BigQuery's client library otherwise returns a
  // BigQueryTimestamp class instance, which isn't a plain serializable value
  // and can't cross the Server->Client Component boundary (Sidebar is "use client").
  const rows = await runQuery<{ last_modified: string | null }>(`
    SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E3SZ', MAX(TIMESTAMP_MILLIS(last_modified_time))) AS last_modified
    FROM ${table("__TABLES__")}
    WHERE table_id IN ('sales_booking', 'sales_booking_cancelled')
  `);
  return { lastUpdated: rows[0]?.last_modified ?? null };
}
