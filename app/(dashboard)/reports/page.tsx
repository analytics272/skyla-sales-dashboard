import { getFolioBasedReport, getB2bDetailReport } from "@/lib/bigquery/queries/reports";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import ReportsContent from "@/components/reports/ReportsContent";

// Skyla_Dashboard_Reports_Tab_PRD.md — both reports are fixed to FY 26-27
// (per each report's own name) and don't use the global period-tab filter;
// only Property narrows them, same convention as every other tab.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);

  const [folioReport, b2bDetailReport] = await Promise.all([
    getFolioBasedReport(filter.properties),
    getB2bDetailReport(filter.properties),
  ]);

  return <ReportsContent folioReport={folioReport} b2bDetailReport={b2bDetailReport} />;
}
