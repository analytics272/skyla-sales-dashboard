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
  const clause = `${propertyCol} IN UNNEST(@${paramPrefix}Properties) AND ${dateColAsDate} BETWEEN @${paramPrefix}Start AND @${paramPrefix}End`;
  return { clause, params };
}
