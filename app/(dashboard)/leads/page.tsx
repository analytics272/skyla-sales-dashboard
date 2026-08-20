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
} from "@/lib/bigquery/queries/leads";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import LeadsContent from "@/components/leads/LeadsContent";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  const leadsFilter = { properties: filter.properties, fy: filter.fy, quarter: filter.quarter, months: filter.months };

  const [summary, mom, byProperty, bySource, formatLeadsRevenue, adrByFormat, lostReasons, bookingPace, byOwner] =
    await Promise.all([
      getLeadsSummary(leadsFilter),
      getLeadsMoM(filter.fy),
      getLeadsByProperty(leadsFilter),
      getLeadsBySource(leadsFilter),
      getFormatLeadsRevenue(leadsFilter),
      getAdrByFormat(leadsFilter),
      getLostLeadReasons(leadsFilter),
      getBookingPace(leadsFilter),
      getLeadsByOwner(leadsFilter),
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
    />
  );
}
