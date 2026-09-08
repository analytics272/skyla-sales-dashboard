"use client";

import { useState } from "react";
import clsx from "clsx";
import type { FolioReport, B2bDetailReport } from "@/lib/bigquery/queries/reports";
import FolioReportTable from "./FolioReportTable";
import B2bDetailContent from "./B2bDetailContent";

type ReportTab = "Folio Based Report" | "B2B Details";
const REPORT_TABS: ReportTab[] = ["Folio Based Report", "B2B Details"];

// Skyla_Dashboard_Reports_Tab_PRD.md §3: one nav item, two reports, switched
// by an in-page toggle rather than a second route (see lib/navigation.ts's
// comment for why) — both reports are already fetched server-side (cheap
// enough combined; neither is refetched on toggle).
export default function ReportsContent({
  folioReport,
  b2bDetailReport,
}: {
  folioReport: FolioReport;
  b2bDetailReport: B2bDetailReport;
}) {
  const [tab, setTab] = useState<ReportTab>(REPORT_TABS[0]);

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

      {/* Both reports are fixed to FY 26-27 regardless of the period pills
          above (Today/This Month/etc.) — only the Property filter narrows
          either one. Stated plainly here since the period pills are still
          visible (shared layout) but don't do anything on this page. */}
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Fixed to <span className="font-medium text-zinc-500 dark:text-zinc-400">FY 26-27</span> — the period filter above doesn&apos;t apply here; only the Property filter does.
      </p>

      {tab === "Folio Based Report" ? <FolioReportTable report={folioReport} /> : <B2bDetailContent report={b2bDetailReport} />}
    </div>
  );
}
