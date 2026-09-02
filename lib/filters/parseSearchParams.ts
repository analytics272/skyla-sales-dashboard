// Server-side counterpart to FiltersContext: turns the same URL query params
// (?property=KDP,HTC&period=this_fy, or ?period=custom&start=...&end=...)
// into a KpiFilter for Server Components to pass straight into the BigQuery
// query functions.
import { KpiFilter } from "@/lib/bigquery/queries/filters";
import { isPeriodKey } from "@/lib/reference/period";

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseKpiFilter(searchParams: SearchParams): KpiFilter {
  const propertyRaw = first(searchParams.property);
  const properties = propertyRaw ? propertyRaw.split(",").filter(Boolean) : undefined;

  const periodRaw = first(searchParams.period);
  const period = isPeriodKey(periodRaw) ? periodRaw : undefined;

  const startRaw = first(searchParams.start);
  const endRaw = first(searchParams.end);
  const customStart = startRaw && ISO_DATE.test(startRaw) ? startRaw : undefined;
  const customEnd = endRaw && ISO_DATE.test(endRaw) ? endRaw : undefined;

  return { properties, period, customStart, customEnd };
}
