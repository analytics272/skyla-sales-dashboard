"use client";

import { Fragment, useMemo, useState } from "react";
import type { B2bDetailReport } from "@/lib/bigquery/queries/reports";
import Card from "@/components/ui/Card";
import { formatIndianCurrency } from "@/lib/format/currency";

const rupee = (v: number | null) => (v !== null ? `₹${Math.round(v).toLocaleString("en-IN")}` : "—");

type SortKey = "totalRevenue" | "totalNights" | "totalAdr";

export default function B2bDetailContent({ report }: { report: B2bDetailReport }) {
  const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const monthLabels = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of report.zoneA) for (const m of row.byMonth) seen.set(m.monthKey, m.monthLabel);
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [report.zoneA]);

  const sortedZoneA = useMemo(() => {
    const rows = [...report.zoneA];
    rows.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return rows;
  }, [report.zoneA, sortKey, sortDir]);

  function onSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortArrow = (key: SortKey) => (key === sortKey ? (sortDir === "desc" ? " ▼" : " ▲") : "");

  const totalRevenue = report.zoneA.reduce((s, r) => s + r.totalRevenue, 0);
  const totalNights = report.zoneA.reduce((s, r) => s + r.totalNights, 0);

  return (
    <div className="space-y-4">
      <Card
        title={`FY 26-27 B2B Details — Company × Month (${report.zoneA.length} companies)`}
        subtitle="Click a total column to sort. Source: b2b_bills, live — never a cached sheet pivot cell."
      >
        {/* Bounded scroll box on both axes — load-bearing, not just sizing:
            see FolioReportTable.tsx's identical comment for why a sticky-
            header table needs its own scroll ancestor rather than an
            unbounded Expandable panel (which removes the scroll box
            entirely once expanded, handing scrolling back to the page and
            breaking these sticky headers against the shared layout's own
            sticky FilterBar). */}
        <div className="max-h-[480px] overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 min-w-[200px] border-b border-r border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    Company
                  </th>
                  <th
                    className="sticky top-0 z-10 min-w-[110px] cursor-pointer select-none border-b border-l border-zinc-200 bg-zinc-50 px-2 py-1.5 text-right font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    onClick={() => onSort("totalRevenue")}
                  >
                    Total Revenue{sortArrow("totalRevenue")}
                  </th>
                  <th
                    className="sticky top-0 z-10 min-w-[100px] cursor-pointer select-none border-b border-l border-zinc-200 bg-zinc-50 px-2 py-1.5 text-right font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    onClick={() => onSort("totalNights")}
                  >
                    Total Nights{sortArrow("totalNights")}
                  </th>
                  <th
                    className="sticky top-0 z-10 min-w-[90px] cursor-pointer select-none border-b border-l border-zinc-200 bg-zinc-50 px-2 py-1.5 text-right font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    onClick={() => onSort("totalAdr")}
                  >
                    Total ADR{sortArrow("totalAdr")}
                  </th>
                  {monthLabels.map(([key, label]) => (
                    <th
                      key={key}
                      colSpan={3}
                      className="sticky top-0 z-10 border-b border-l border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 top-[27px] z-20 border-b border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
                  <th className="sticky top-[27px] z-10 border-b border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
                  <th className="sticky top-[27px] z-10 border-b border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
                  <th className="sticky top-[27px] z-10 border-b border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
                  {monthLabels.map(([key]) => (
                    <Fragment key={key}>
                      <th className="sticky top-[27px] z-10 min-w-[80px] border-b border-l border-zinc-200 bg-zinc-50 px-1 py-1 text-center text-[10px] font-medium text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                        Rev
                      </th>
                      <th className="sticky top-[27px] z-10 min-w-[60px] border-b border-zinc-200 bg-zinc-50 px-1 py-1 text-center text-[10px] font-medium text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                        Nts
                      </th>
                      <th className="sticky top-[27px] z-10 min-w-[70px] border-b border-zinc-200 bg-zinc-50 px-1 py-1 text-center text-[10px] font-medium text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                        ADR
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-zinc-100 font-semibold dark:bg-zinc-900">
                  <td className="sticky left-0 z-10 border-b border-r border-zinc-200 bg-inherit px-3 py-1 text-left text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
                    All companies
                  </td>
                  <td className="border-b border-l border-zinc-200 px-2 py-1 text-right tabular-nums text-zinc-800 dark:border-zinc-800 dark:text-zinc-100">
                    {formatIndianCurrency(totalRevenue)}
                  </td>
                  <td className="border-b border-l border-zinc-200 px-2 py-1 text-right tabular-nums text-zinc-800 dark:border-zinc-800 dark:text-zinc-100">
                    {totalNights.toLocaleString("en-IN")}
                  </td>
                  <td className="border-b border-l border-zinc-200 px-2 py-1 text-right tabular-nums text-zinc-800 dark:border-zinc-800 dark:text-zinc-100">
                    {rupee(totalNights > 0 ? totalRevenue / totalNights : null)}
                  </td>
                  {monthLabels.map(([key]) => (
                    <Fragment key={key}>
                      <td className="border-b border-l border-zinc-200 px-1 py-1 text-right tabular-nums text-zinc-500 dark:border-zinc-800 dark:text-zinc-400" />
                      <td className="border-b border-zinc-200 dark:border-zinc-800" />
                      <td className="border-b border-zinc-200 dark:border-zinc-800" />
                    </Fragment>
                  ))}
                </tr>
                {sortedZoneA.map((row) => {
                  const byMonthMap = new Map(row.byMonth.map((m) => [m.monthKey, m]));
                  return (
                    <tr key={row.company} className="odd:bg-white even:bg-zinc-50 dark:odd:bg-zinc-950 dark:even:bg-zinc-900">
                      <td className="sticky left-0 z-10 border-b border-r border-zinc-100 bg-inherit px-3 py-1 text-left text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
                        {row.company}
                      </td>
                      <td className="border-b border-l border-zinc-100 px-2 py-1 text-right tabular-nums text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
                        {formatIndianCurrency(row.totalRevenue)}
                      </td>
                      <td className="border-b border-l border-zinc-100 px-2 py-1 text-right tabular-nums text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                        {row.totalNights.toLocaleString("en-IN")}
                      </td>
                      <td className="border-b border-l border-zinc-100 px-2 py-1 text-right tabular-nums text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                        {rupee(row.totalAdr)}
                      </td>
                      {monthLabels.map(([key]) => {
                        const m = byMonthMap.get(key);
                        return (
                          <Fragment key={key}>
                            <td className="border-b border-l border-zinc-100 px-1 py-1 text-right tabular-nums text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                              {m ? formatIndianCurrency(m.revenue) : "—"}
                            </td>
                            <td className="border-b border-zinc-100 px-1 py-1 text-right tabular-nums text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                              {m ? m.nights.toLocaleString("en-IN") : "—"}
                            </td>
                            <td className="border-b border-zinc-100 px-1 py-1 text-right tabular-nums text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                              {m ? rupee(m.adr) : "—"}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
      </Card>

      <Card title={`Invoice Detail (${report.zoneB.length} bills)`} subtitle="Sorted by Property, then Check In. Source: b2b_bills, live.">
        <div className="max-h-[480px] overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  {["Property", "Guest Name", "Check In", "Bill Date", "Inv No", "Business Source", "Nights", "Bills due from", "Room Revenue", "POC", "Month"].map((h) => (
                    <th key={h} className="sticky top-0 z-10 whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-left font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.zoneB.map((r, i) => (
                  <tr key={i} className="odd:bg-white even:bg-zinc-50 dark:odd:bg-zinc-950 dark:even:bg-zinc-900">
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">{r.property}</td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{r.guestName ?? "—"}</td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{r.checkIn ?? "—"}</td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{r.billDate ?? "—"}</td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{r.invNo ?? "—"}</td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{r.businessSource ?? "—"}</td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-right tabular-nums text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{r.nights.toLocaleString("en-IN")}</td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{r.billsDueFrom ?? "—"}</td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-right tabular-nums text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">{formatIndianCurrency(r.roomRevenue)}</td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{r.poc ?? "—"}</td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{r.month ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </Card>
    </div>
  );
}
