import { getFolioBasedReport, getB2bDetailReport } from "@/lib/bigquery/queries/reports";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import { recentFyLabels } from "@/lib/reference/financialYear";
import ReportsContent from "@/components/reports/ReportsContent";

// PRD_Reports_Section_Final.md §1/§2 — each report has its own dedicated FY
// selector (?b2bFy=, ?folioFy=), independent of both the other report's FY
// and the dashboard's global period-tab filter; only the Property filter
// (still global) applies to both. b2bFy/folioFy are read directly here
// (not via parseKpiFilter/KpiFilter, which model the shared dashboard
// filters) since they're specific to this one page.
function resolveFy(raw: string | string[] | undefined, validFys: string[], fallback: string): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && validFys.includes(value) ? value : fallback;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  const availableFys = recentFyLabels(3); // ["FY 26-27", "FY 25-26", "FY 24-25"] as of today — both reports share the same selectable set
  const currentFy = availableFys[0];

  const b2bFy = resolveFy(sp.b2bFy, availableFys, currentFy);
  const folioFy = resolveFy(sp.folioFy, availableFys, currentFy);

  const [folioReport, b2bDetailReport] = await Promise.all([
    getFolioBasedReport(filter.properties, folioFy),
    getB2bDetailReport(filter.properties, b2bFy),
  ]);

  return <ReportsContent folioReport={folioReport} b2bDetailReport={b2bDetailReport} availableFys={availableFys} />;
}
