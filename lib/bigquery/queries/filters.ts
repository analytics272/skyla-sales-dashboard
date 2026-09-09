import { PeriodDef, PeriodFilter, resolvePeriodFromFilter } from "@/lib/reference/period";
import { ACTIVE_PROPERTY_CODES } from "@/lib/reference/propertyReference";

export interface KpiFilter extends PeriodFilter {
  /** Property codes to include. Omit/empty = all active properties (includes LP as of the 2026-08-26 re-integration — see the LP PRD addendum). */
  properties?: string[];
}

export interface ResolvedFilter {
  properties: string[];
  period: PeriodDef;
}

export function resolveFilter(filter: KpiFilter): ResolvedFilter {
  return {
    properties: filter.properties && filter.properties.length > 0 ? filter.properties : ACTIVE_PROPERTY_CODES,
    period: resolvePeriodFromFilter(filter),
  };
}

/**
 * 2026-09-08: sales_booking (and sales_booking_cancelled, same schema) carries
 * two BookingStatus values that never represent an actual occupied room —
 * confirmed live against the Sept-2026 PMS annual sales report, which the
 * user cross-checked directly: "Void" (a corrected/rebooked folio — e.g. a
 * guest's booking re-entered under a new FolioNo, with the old one left in
 * the table marked Void) and "No Show" (guest never arrived). Both are 100%
 * DailyRevenue = 0 across the whole table (verified: 2,635 Void + 64 No Show
 * rows, zero of them carrying any revenue) — so SUM(DailyRevenue) was never
 * wrong, but every COUNT(*) "sold room nights" figure on the dashboard was,
 * since a bare COUNT(*) counts these rows as if a room had been sold that
 * night. This was invisible on Revenue (₹0 either way) but threw off every
 * KPI derived from nights — Occupancy %, ADR, RevPAR — dashboard-wide,
 * reproduced for Sept 2026: BigQuery counted 800 KDP room-nights against the
 * PMS report's 748 actual occupied rooms; excluding these two statuses brings
 * it to 738, closing all but the residual PMS-sync-timing gap.
 * Applied via scopeClauseForRange below (covers every buildScopeClause /
 * buildPreviousScopeClause caller automatically) and exported here for the
 * handful of call sites that build their own raw WHERE clause instead of
 * going through buildScopeClause.
 */
export const SALES_BOOKING_STAY_FILTER = "BookingStatus NOT IN ('Void', 'No Show')";

/**
 * 2026-09-09: a bare `COUNT(*)` "sold room nights" undercounts BH4
 * specifically. BH4 has six real "3BHK Apartment" units (`RoomShortCode =
 * '3 Bedroom Apartments'`, `RoomNo` 100/200/300/400/500/600) that the
 * business's own reporting (confirmed live against Looker Studio, the
 * user's BI tool) credits as **3 room-nights per stay-night**, not 1 — one
 * night in that apartment occupies the equivalent of 3 standard rooms'
 * worth of capacity, even though it's physically one unit and Available
 * Room Nights correctly stays at BH4's 18-room count (these apartments
 * aren't additional bookable inventory — see the 2026-09-09 room-count
 * revert in propertyReference.ts's own comment; this is a completely
 * separate, additive fix on the SOLD side only, not a reversal of that
 * revert). Verified live: Sept 2026 BH4 had 257 standard-room nights + 25
 * "3 Bedroom Apartments" nights; `COUNT(*)` gives 282, but
 * `257*1 + 25*3 = 332` — exactly Looker Studio's reported Sold Room Nights,
 * and `332/540 = 61.48%` occupancy / `revenue/332 = ~₹4,516` ADR both match
 * Looker Studio's own figures for the same month too.
 *
 * This is deliberately scoped to the exact `RoomShortCode` text, not a
 * generic "parse the bedroom count out of the room name" rule — `JHS` has
 * 1,790+ nights of its own "Two Bedroom Suite" (and HTC/KDP have "One
 * Bedroom Suite" types), which are ordinary single-room product tiers, one
 * physical room each, already correctly inside those properties' own room
 * counts — those three properties already tied out to Looker Studio using
 * a plain `COUNT(*)` (checked directly), so a broad "any *Bedroom* type
 * gets multiplied" rule would have been wrong and would have broken them.
 * No other property currently has a `RoomShortCode` matching this pattern.
 *
 * Applies only to metrics that represent physical room-night capacity
 * (Sold Room Nights and everything computed from it — Occupancy %, ADR,
 * RevPAR, category/brand/room-format nights breakdowns) — NOT to Total
 * Bookings (a 3BHK stay is still one booking) or Guests Served (a
 * multi-bedroom apartment sleeping N guests is still N guests, not N×3).
 */
export function roomNightUnitsSqlExpr(alias = ""): string {
  return `CASE WHEN ${alias}RoomShortCode = '3 Bedroom Apartments' THEN 3 ELSE 1 END`;
}

/**
 * WHERE-clause fragment + params scoping a date-bearing table by property
 * list + the active period's CURRENT date range. Use `buildPreviousScopeClause`
 * for the comparison side of a current-vs-previous KPI.
 */
export function buildScopeClause(
  propertyCol: string,
  dateColAsDate: string,
  resolved: ResolvedFilter,
  paramPrefix: string
): { clause: string; params: Record<string, unknown> } {
  return scopeClauseForRange(propertyCol, dateColAsDate, resolved.properties, resolved.period.current, paramPrefix);
}

/** Same as `buildScopeClause` but scoped to the period's PREVIOUS (comparison) range. */
export function buildPreviousScopeClause(
  propertyCol: string,
  dateColAsDate: string,
  resolved: ResolvedFilter,
  paramPrefix: string
): { clause: string; params: Record<string, unknown> } {
  return scopeClauseForRange(propertyCol, dateColAsDate, resolved.properties, resolved.period.previous, paramPrefix);
}

function scopeClauseForRange(
  propertyCol: string,
  dateColAsDate: string,
  properties: string[],
  range: { start: string; end: string },
  paramPrefix: string
): { clause: string; params: Record<string, unknown> } {
  const params: Record<string, unknown> = {
    [`${paramPrefix}Properties`]: properties,
    [`${paramPrefix}Start`]: range.start,
    [`${paramPrefix}End`]: range.end,
  };
  // propertyCol is always "<alias.>Property" across every call site (plain
  // "Property", or "b.Property" for guestDetail's room-type join) — reuse
  // that same alias for BookingStatus so the Void/No-Show exclusion reaches
  // the right table even when the query joins in another one.
  const alias = propertyCol.slice(0, propertyCol.length - "Property".length);
  const clause = `${propertyCol} IN UNNEST(@${paramPrefix}Properties) AND ${dateColAsDate} BETWEEN @${paramPrefix}Start AND @${paramPrefix}End AND ${alias}${SALES_BOOKING_STAY_FILTER}`;
  return { clause, params };
}
