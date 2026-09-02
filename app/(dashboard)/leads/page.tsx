import {
  getLeadsSummary,
  getLeadsMoM,
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

  const [summary, mom, byProperty, bySource, formatLeadsRevenue, adrByFormat, lostReasons, bookingPace, byOwner, byOwnerSource] =
    await Promise.all([
      getLeadsSummary(leadsFilter),
      getLeadsMoM(leadsFilter),
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
      mom={mom}
      byProperty={byProperty}
      bySource={bySource}
      formatLeadsRevenue={formatLeadsRevenue}
      adrByFormat={adrByFormat}
      lostReasons={lostReasons}
      bookingPace={bookingPace}
      byOwner={byOwner}
      byOwnerSource={byOwnerSource}
    />
  );
}
