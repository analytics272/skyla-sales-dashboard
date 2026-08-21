import { runQuery, table } from "../client";
import { ALL_PROPERTY_CODES, roomCountOf } from "@/lib/reference/propertyReference";
import { DateRange, fyBounds, fyMonthBounds } from "@/lib/reference/financialYear";

/** Builds the DateRange[] (one per FY x month combination) for getAvailableRoomNights(By Property) from a resolved fys+months pair. Mirrors resolveMonthRanges() but avoids importing ResolvedFilter here to keep this module filter-shape-agnostic. */
export function rangesForFysAndMonths(fys: string[], months: number[]): DateRange[] {
  const ranges: DateRange[] = [];
  for (const fy of fys) {
    if (months.length === 0) ranges.push(fyBounds(fy));
    else for (const m of months) ranges.push(fyMonthBounds(fy, m));
  }
  return ranges;
}

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
 * of a hardcoded date. Properties with zero rows (currently BH4, LP — known
 * pipeline gap) resolve to null bounds, i.e. zero Available Room Nights.
 */
export async function getPropertyActiveWindows(): Promise<Map<string, PropertyWindow>> {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;

  const rows = await runQuery<WindowRow>(`
    SELECT Property, MIN(StayDate) AS min_stay, MAX(StayDate) AS max_stay
    FROM (
      SELECT Property, StayDate FROM ${table("sales_booking")}
      UNION ALL
      SELECT Property, StayDate FROM ${table("sales_booking_cancelled")}
    )
    GROUP BY Property
  `);

  const map = new Map<string, PropertyWindow>();
  for (const code of ALL_PROPERTY_CODES) {
    map.set(code, { property: code, minStay: null, maxStay: null });
  }
  for (const r of rows) {
    map.set(r.Property, { property: r.Property, minStay: r.min_stay, maxStay: r.max_stay });
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
 * Available Room Nights (§3.3/§6.1), per property, summed across one or more
 * date ranges (one range per selected month when the Month filter is a
 * non-contiguous multi-select, so a gap month's days are never counted), each
 * clamped against that property's actual active window. `ranges: null` (no FY
 * selected) uses each property's full active window unclamped.
 */
export async function getAvailableRoomNightsByProperty(
  properties: string[],
  ranges: DateRange[] | null
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

    const effectiveRanges = ranges ?? [{ start: window.minStay, end: window.maxStay }];
    let nights = 0;
    for (const range of effectiveRanges) {
      const clamped = clampToActiveWindow(range.start, range.end, window);
      if (clamped) nights += roomCount * daysBetweenInclusive(clamped.start, clamped.end);
    }
    result[code] = nights;
  }

  return result;
}

export async function getAvailableRoomNights(properties: string[], ranges: DateRange[] | null): Promise<number> {
  const byProperty = await getAvailableRoomNightsByProperty(properties, ranges);
  return Object.values(byProperty).reduce((sum, n) => sum + n, 0);
}
