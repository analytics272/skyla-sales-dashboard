// Server-side counterpart to FiltersContext: turns the same URL query params
// (?property=KDP,HTC&fy=FY 25-26,FY 26-27&quarter=2&months=4,5) into a
// KpiFilter for Server Components to pass straight into the BigQuery query
// functions.
import { KpiFilter } from "@/lib/bigquery/queries/filters";

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseKpiFilter(searchParams: SearchParams): KpiFilter {
  const propertyRaw = first(searchParams.property);
  const properties = propertyRaw ? propertyRaw.split(",").filter(Boolean) : undefined;

  const fyRaw = first(searchParams.fy);
  const fys = fyRaw ? fyRaw.split(",").filter(Boolean) : undefined;

  const quarterRaw = first(searchParams.quarter);
  const quarter = quarterRaw ? (Number(quarterRaw) as 1 | 2 | 3 | 4) : undefined;

  const monthsRaw = first(searchParams.months);
  const months = monthsRaw ? monthsRaw.split(",").map(Number).filter((n) => !Number.isNaN(n)) : undefined;

  return { properties, fys, quarter, months };
}
