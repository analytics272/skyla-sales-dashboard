import { runQuery, table } from "../client";
import { ALL_PROPERTY_CODES, roomCountOf } from "@/lib/reference/propertyReference";
import { DateRange } from "@/lib/reference/financialYear";

export interface PropertyWindow {
  property: string;
  minStay: string | null; // ISO date
  maxStay: string | null; // ISO date
}

let cache: Map<string, PropertyWindow> | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min — active windows barely move day to day

interface WindowRow {
  Property: string;
  min_stay: string | null;
  max_stay: string | null;
}

/**
 * Empirical active window per property: MIN/MAX(StayDate) across sales_booking +
 * sales_booking_cancelled. User-confirmed approach (2026-08-19) for Available Room
 * Nights scoping (§2.1/§3.3) — real data contradicted the documented "mid-2026"
 * GB go-live date, so all properties use their true first/last StayDate instead
 * of a hardcoded date. Properties with zero rows (currently BH4 — known
 * pipeline gap) resolve to null bounds, i.e. zero Available Room Nights.
 *
 * LP is a special case (LP Integration PRD Addendum, 2026-08-26): it has zero
 * rows in sales_booking/sales_booking_cancelled (retired, no PMS feed), so its
 * window comes from sales_booking_lp_monthly instead — MIN(MonthStartDate) to
 * the end of its last covered month. This is the ONLY place LP's window needs
 * special handling; once set here, the existing clamp/day-count logic below
 * (and every caller of getAvailableRoomNightsByProperty) handles LP the same
 * as every other property, using its real roomCount (16, propertyReference.ts).
 */
export async function getPropertyActiveWindows(): Promise<Map<string, PropertyWindow>> {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;

  const [rows, lpRows] = await Promise.all([
    runQuery<WindowRow>(`
      SELECT Property, MIN(StayDate) AS min_stay, MAX(StayDate) AS max_stay
      FROM (
        SELECT Property, StayDate FROM ${table("sales_booking")}
        UNION ALL
        SELECT Property, StayDate FROM ${table("sales_booking_cancelled")}
      )
      GROUP BY Property
    `),
    runQuery<{ min_stay: string | null; max_stay: string | null }>(`
      SELECT
        CAST(MIN(MonthStartDate) AS STRING) AS min_stay,
        CAST(LAST_DAY(MAX(MonthStartDate)) AS STRING) AS max_stay
      FROM ${table("sales_booking_lp_monthly")}
    `),
  ]);

  const map = new Map<string, PropertyWindow>();
  for (const code of ALL_PROPERTY_CODES) {
    map.set(code, { property: code, minStay: null, maxStay: null });
  }
  for (const r of rows) {
    map.set(r.Property, { property: r.Property, minStay: r.min_stay, maxStay: r.max_stay });
  }
  const lp = lpRows[0];
  if (lp && lp.min_stay && lp.max_stay) {
    map.set("LP", { property: "LP", minStay: lp.min_stay, maxStay: lp.max_stay });
  }

  cache = map;
  cacheAt = Date.now();
  return map;
}

/** Clamps [rangeStart, rangeEnd] to a property's active window, returns null if no overlap (0 available nights). */
export function clampToActiveWindow(
  rangeStart: string,
  rangeEnd: string,
  window: PropertyWindow
): { start: string; end: string } | null {
  if (!window.minStay || !window.maxStay) return null;
  const start = rangeStart > window.minStay ? rangeStart : window.minStay;
  const end = rangeEnd < window.maxStay ? rangeEnd : window.maxStay;
  if (start > end) return null;
  return { start, end };
}

/** Days inclusive between two ISO date strings. */
export function daysBetweenInclusive(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.floor(ms / 86400000) + 1;
}

/**
 * Available Room Nights (§3.3/§6.1), per property, for a single date range
 * (the active period's `current` or `previous` span — always contiguous
 * since the 2026-09-02 period-tabs redesign), clamped against each
 * property's actual active window. `range: null` uses each property's full
 * active window unclamped (its entire history).
 */
export async function getAvailableRoomNightsByProperty(
  properties: string[],
  range: DateRange | null
): Promise<Record<string, number>> {
  const windows = await getPropertyActiveWindows();
  const result: Record<string, number> = {};

  for (const code of properties) {
    const window = windows.get(code);
    const roomCount = roomCountOf(code) ?? 0;
    if (!window || !window.minStay || !window.maxStay || roomCount === 0) {
      result[code] = 0;
      continue;
    }

    const effectiveRange = range ?? { start: window.minStay, end: window.maxStay };
    const clamped = clampToActiveWindow(effectiveRange.start, effectiveRange.end, window);
    result[code] = clamped ? roomCount * daysBetweenInclusive(clamped.start, clamped.end) : 0;
  }

  return result;
}

export async function getAvailableRoomNights(properties: string[], range: DateRange | null): Promise<number> {
  const byProperty = await getAvailableRoomNightsByProperty(properties, range);
  return Object.values(byProperty).reduce((sum, n) => sum + n, 0);
}
