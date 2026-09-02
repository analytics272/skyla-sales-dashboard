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

  // Item #2: Leads MoM drills day -> month -> FY. All three grains are
  // prefetched (cheap COUNT/COUNTIF aggregations over the same scoped rows)
  // so switching grain in the UI is instant, with no extra round trip.
  const [summary, momByDay, momByMonth, momByFy, byProperty, bySource, formatLeadsRevenue, adrByFormat, lostReasons, bookingPace, byOwner, byOwnerSource] =
    await Promise.all([
      getLeadsSummary(leadsFilter),
      getLeadsTrend(leadsFilter, "day"),
      getLeadsTrend(leadsFilter, "month"),
      getLeadsTrend(leadsFilter, "fy"),
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
      momByMonth={momByMonth}
      momByFy={momByFy}
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
