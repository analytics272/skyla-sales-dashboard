"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import type { FolioReport, B2bDetailReport } from "@/lib/bigquery/queries/reports";
import FolioReportTable from "./FolioReportTable";
import B2bDetailContent from "./B2bDetailContent";

type ReportTab = "Folio Based Report" | "B2B Details";
const REPORT_TABS: ReportTab[] = ["Folio Based Report", "B2B Details"];

// 2026-09-19 (PRD_Reports_Section_Final.md §1/§2) — each report gets its own
// dedicated FY selector, synced to its own URL param (?folioFy=/?b2bFy=) so
// it survives refresh/sharing the same way the dashboard's global filters
// do — but kept deliberately independent of FiltersContext (lib/filters/),
// since the PRD is explicit that neither report should move with the
// dashboard-wide period-tab filter, and the two reports' FY selections are
// independent of each other too (switching one never affects the other).
function FySelector({ value, options, onChange }: { value: string; options: string[]; onChange: (fy: string) => void }) {
  return (
    <div role="tablist" className="flex w-fit flex-wrap items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
      {options.map((fy) => (
        <button
          key={fy}
          type="button"
          role="tab"
          aria-selected={value === fy}
          onClick={() => onChange(fy)}
          className={clsx(
            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            value === fy
              ? "bg-teal-700 text-white shadow-sm"
              : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          )}
        >
          {fy}
        </button>
      ))}
    </div>
  );
}

// Skyla_Dashboard_Reports_Tab_PRD.md §3: one nav item, two reports, switched
// by an in-page toggle rather than a second route (see lib/navigation.ts's
// comment for why) — both reports are already fetched server-side (cheap
// enough combined; neither is refetched on toggle, only on its own FY change).
export default function ReportsContent({
  folioReport,
  b2bDetailReport,
  availableFys,
}: {
  folioReport: FolioReport;
  b2bDetailReport: B2bDetailReport;
  availableFys: string[];
}) {
  const [tab, setTab] = useState<ReportTab>(REPORT_TABS[0]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFy = useCallback(
    (key: "b2bFy" | "folioFy", fy: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, fy);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex w-fit flex-wrap items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
        {REPORT_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === t
                ? "bg-teal-700 text-white shadow-sm"
                : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 2026-09-19: the period pills (Today/This Month/etc.) and the
          Compare-to-Last-Year toggle are hidden entirely on this page (see
          FilterBar.tsx's hidePeriodControls) since neither report uses
          them — each has its own FY selector instead, independent of the
          other report's and of the dashboard's global period filter. Only
          the Property filter (still global, still visible) narrows either
          report. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">Financial Year:</span>
        {tab === "Folio Based Report" ? (
          <FySelector value={folioReport.fy} options={availableFys} onChange={(fy) => setFy("folioFy", fy)} />
        ) : (
          <FySelector value={b2bDetailReport.fy} options={availableFys} onChange={(fy) => setFy("b2bFy", fy)} />
        )}
      </div>

      {tab === "Folio Based Report" ? <FolioReportTable report={folioReport} /> : <B2bDetailContent report={b2bDetailReport} />}
    </div>
  );
}
