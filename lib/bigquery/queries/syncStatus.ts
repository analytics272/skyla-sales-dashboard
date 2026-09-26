// "Last Updated" (2026-09-02 redesign, §3) + per-tab data freshness
// (2026-09-26, added after `lead_tracker`'s sync silently retyped two
// columns and broke the entire Leads page — see leads.ts's own comment on
// LEAD_DATE_EXPR for the full incident). There's no explicit sync-log
// table or timestamp column anywhere in the schema (checked directly via
// INFORMATION_SCHEMA.COLUMNS).
import { runQuery, table, fnbTable } from "../client";

export interface SyncStatus {
  lastUpdated: string | null; // ISO timestamp
}

// Legacy global indicator (Sidebar) — table WRITE recency via BigQuery's
// own `__TABLES__` metadata, for the two tables the PMS sync writes to.
// Kept as-is: still a real, non-fabricated signal for sales_booking, whose
// sync has never shown the "table touched but content stale" failure mode
// documented below for getDataFreshness.
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

// --- Per-tab data freshness ------------------------------------------------
//
// WHY this checks actual DATA CONTENT (MAX of a real date column), not just
// `__TABLES__.last_modified_time` like the function above: `lead_tracker`
// proved a table's storage can be touched (updating last_modified_time)
// while the DATA itself has stopped advancing — its sync ran and rewrote
// the table on 2026-09-25, but the newest row was still dated 2026-09-11,
// 14 days stale. A metadata-only check would have shown that sync as
// perfectly healthy. Checking the newest real row's own date catches this
// failure mode; `__TABLES__` alone can't.
//
// Each source is queried independently and wrapped in its own try/catch —
// deliberately NOT combined into one UNION ALL query — so a schema drift
// in any single table (exactly what broke `lead_tracker` mid-session: a
// column silently retyped STRING -> DATE/INT64, which turns a query into a
// hard BigQuery error, not a soft NULL) can only mark THAT source as
// erroring, never take down freshness reporting for every other tab too.
export type FreshnessSourceKey = "pms" | "leads" | "b2bBills" | "fnb";

interface FreshnessSourceDef {
  label: string;
  fetchMaxDate: () => Promise<string | null>; // ISO date string, or null if genuinely no rows
}

// ReservationDate (when a booking was MADE), not StayDate — StayDate is
// legitimately future-dated for advance bookings, so its own MAX is
// meaningless as a "is new data still arriving" signal. ReservationDate
// trends at or near today for an actively-syncing PMS feed (confirmed
// live: MAX(ReservationDate) = today, 2026-09-25, when checked).
const SOURCES: Record<FreshnessSourceKey, FreshnessSourceDef> = {
  pms: {
    label: "PMS Bookings",
    fetchMaxDate: async () => {
      const rows = await runQuery<{ d: string | null }>(`SELECT CAST(MAX(CAST(ReservationDate AS DATE)) AS STRING) AS d FROM ${table("sales_booking")}`);
      return rows[0]?.d ?? null;
    },
  },
  leads: {
    label: "Lead Tracker",
    fetchMaxDate: async () => {
      // Same type-agnostic expression as leads.ts's LEAD_DATE_EXPR — kept
      // duplicated rather than imported, since importing from a query file
      // into a shared status checker would invert this module's own
      // dependency direction for one constant; if LEAD_DATE_EXPR changes
      // again, update both (there are only two).
      const rows = await runQuery<{ d: string | null }>(
        `SELECT CAST(MAX(SAFE_CAST(SUBSTR(CAST(date AS STRING), 1, 10) AS DATE)) AS STRING) AS d FROM ${table("lead_tracker")}`
      );
      return rows[0]?.d ?? null;
    },
  },
  b2bBills: {
    label: "B2B Bills",
    fetchMaxDate: async () => {
      const rows = await runQuery<{ d: string | null }>(`SELECT CAST(MAX(Bill_Date) AS STRING) AS d FROM ${table("b2b_bills")}`);
      return rows[0]?.d ?? null;
    },
  },
  fnb: {
    label: "F&B Sales",
    fetchMaxDate: async () => {
      const rows = await runQuery<{ d: string | null }>(`SELECT CAST(MAX(CAST(date AS DATE)) AS STRING) AS d FROM ${fnbTable("fnb_sale")}`);
      return rows[0]?.d ?? null;
    },
  },
};

// Which sources feed each tab — deliberately conservative: only sources a
// tab actually queries from. Performance's own actuals also come from
// sales_booking, but its review stats (Google/OTA) are a separate,
// external source this doesn't check (no freshness signal investigated
// for those yet).
export const TAB_FRESHNESS_SOURCES: Record<string, FreshnessSourceKey[]> = {
  overview: ["pms"],
  bookings: ["pms", "b2bBills"],
  leads: ["leads"],
  performance: ["pms"],
  reports: ["pms", "b2bBills", "fnb"],
};

export interface DataFreshness {
  key: FreshnessSourceKey;
  label: string;
  lastDataDate: string | null; // null means either no rows, or the check itself failed
  daysStale: number | null;
  errored: boolean;
}

// 3 days: generous enough to ride out a weekend/holiday gap on a
// once-a-day sync without a false alarm, tight enough to catch a genuine
// multi-day stall like the ones found live in b2b_bills (45 days) and
// lead_tracker's incident (14 days) — both far past any reasonable normal
// gap for these sources.
export const STALE_THRESHOLD_DAYS = 3;

export async function getDataFreshness(keys: FreshnessSourceKey[]): Promise<DataFreshness[]> {
  const today = new Date();
  return Promise.all(
    keys.map(async (key): Promise<DataFreshness> => {
      const source = SOURCES[key];
      try {
        const lastDataDate = await source.fetchMaxDate();
        const daysStale = lastDataDate ? Math.floor((today.getTime() - new Date(`${lastDataDate}T00:00:00`).getTime()) / 86400000) : null;
        return { key, label: source.label, lastDataDate, daysStale, errored: false };
      } catch {
        // The exact failure mode that took the Leads page down — a schema
        // drift turns the freshness query itself into a hard error. Report
        // it as an errored source (always flagged) rather than letting it
        // throw and take the whole freshness check (or the page) down.
        return { key, label: source.label, lastDataDate: null, daysStale: null, errored: true };
      }
    })
  );
}

/** True if any source in the list is stale, errored, or has never had data — the "should this tab show a warning" check. */
export function hasStaleSource(sources: DataFreshness[]): boolean {
  return sources.some((s) => s.errored || s.lastDataDate === null || (s.daysStale !== null && s.daysStale > STALE_THRESHOLD_DAYS));
}
