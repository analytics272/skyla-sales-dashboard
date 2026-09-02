// Server-side counterpart to FiltersContext: turns the same URL query params
// (?property=KDP,HTC&period=this_fy) into a KpiFilter for Server Components
// to pass straight into the BigQuery query functions.
import { KpiFilter } from "@/lib/bigquery/queries/filters";
import { isPeriodKey } from "@/lib/reference/period";

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseKpiFilter(searchParams: SearchParams): KpiFilter {
  const propertyRaw = first(searchParams.property);
  const properties = propertyRaw ? propertyRaw.split(",").filter(Boolean) : undefined;

  const periodRaw = first(searchParams.period);
  const period = isPeriodKey(periodRaw) ? periodRaw : undefined;

  return { properties, period };
}
