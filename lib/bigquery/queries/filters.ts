import { DateFilter, resolveSelectedMonths, fyLabelSqlExpr } from "@/lib/reference/financialYear";
import { ACTIVE_PROPERTY_CODES } from "@/lib/reference/propertyReference";

export interface KpiFilter extends DateFilter {
  /** Property codes to include. Omit/empty = all active properties (LP excluded per §3.3 unless explicitly requested for historical views). */
  properties?: string[];
}

export interface ResolvedFilter {
  properties: string[];
  fy: string | null; // null = all-time, no FY scoping
  months: number[]; // [] = whole FY (or all-time if fy is also null) — otherwise an explicit, possibly non-contiguous, set
}

export function resolveFilter(filter: KpiFilter): ResolvedFilter {
  return {
    properties: filter.properties && filter.properties.length > 0 ? filter.properties : ACTIVE_PROPERTY_CODES,
    fy: filter.fy ?? null,
    months: resolveSelectedMonths(filter),
  };
}

/**
 * WHERE-clause fragment + params for scoping a date-bearing table by property
 * list + FY + (possibly non-contiguous) month set. Filters by FY-label equality
 * and EXTRACT(MONTH...) IN UNNEST(...) rather than a BETWEEN range, since a
 * multi-month selection like "Apr + Dec" isn't a contiguous span.
 */
export function buildScopeClause(
  propertyCol: string,
  dateColAsDate: string,
  resolved: ResolvedFilter,
  paramPrefix: string
): { clause: string; params: Record<string, unknown> } {
  const params: Record<string, unknown> = {};
  const conditions: string[] = [];

  params[`${paramPrefix}Properties`] = resolved.properties;
  conditions.push(`${propertyCol} IN UNNEST(@${paramPrefix}Properties)`);

  if (resolved.fy) {
    params[`${paramPrefix}Fy`] = resolved.fy;
    conditions.push(`${fyLabelSqlExpr(dateColAsDate)} = @${paramPrefix}Fy`);
    if (resolved.months.length > 0) {
      params[`${paramPrefix}Months`] = resolved.months;
      conditions.push(`EXTRACT(MONTH FROM ${dateColAsDate}) IN UNNEST(@${paramPrefix}Months)`);
    }
  }

  return { clause: conditions.join(" AND "), params };
}
