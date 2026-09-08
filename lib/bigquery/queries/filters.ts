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
