import {
  getLeadsSummary,
  getLeadsTrend,
  getLeadsByProperty,
  getLeadsBySource,
  getFormatLeadsRevenue,
  getAdrByFormat,
  getLostLeadReasons,
  getBookingPace,
  getLeadsByOwner,
  getLeadsByOwnerSource,
} from "@/lib/bigquery/queries/leads";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import LeadsContent from "@/components/leads/LeadsContent";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  const leadsFilter = { properties: filter.properties, period: filter.period, customStart: filter.customStart, customEnd: filter.customEnd, compareYoY: filter.compareYoY };

  // Item #5 (2026-09-02, eighth pass): Leads MoM is day-wise only now — the
  // month/FY grains from a prior pass are gone.
  const [summary, momByDay, byProperty, bySource, formatLeadsRevenue, adrByFormat, lostReasons, bookingPace, byOwner, byOwnerSource] =
    await Promise.all([
      getLeadsSummary(leadsFilter),
      getLeadsTrend(leadsFilter, "day"),
      getLeadsByProperty(leadsFilter),
      getLeadsBySource(leadsFilter),
      getFormatLeadsRevenue(leadsFilter),
      getAdrByFormat(leadsFilter),
      getLostLeadReasons(leadsFilter),
      getBookingPace(leadsFilter),
      getLeadsByOwner(leadsFilter),
      getLeadsByOwnerSource(leadsFilter),
    ]);

  return (
    <LeadsContent
      summary={summary}
      momByDay={momByDay}
      byProperty={byProperty}
      bySource={bySource}
      formatLeadsRevenue={formatLeadsRevenue}
      adrByFormat={adrByFormat}
      lostReasons={lostReasons}
      bookingPace={bookingPace}
      byOwner={byOwner}
      byOwnerSource={byOwnerSource}
      compareYoY={filter.compareYoY ?? false}
    />
  );
}
