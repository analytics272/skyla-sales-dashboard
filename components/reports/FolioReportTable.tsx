"use client";

// Types only from the query file (erased at compile time, no runtime import)
// — see lib/reference/reportProperties.ts's own comment for why a runtime
// value (as opposed to a type) can't be imported here: it would pull the
// BigQuery SDK into the browser bundle and fail the build. This component
// renders from `report.columns` (which columns actually exist, e.g. a
// Property-filtered report), never from the static REPORT_COLUMNS constant
// there — see the crash this caused, noted at its usage below.
import type { FolioReport, FolioReportBlock, FolioReportMetrics } from "@/lib/bigquery/queries/reports";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";

const money = (v: number) => formatIndianCurrency(v);
const rupee = (v: number | null) => (v !== null ? `₹${Math.round(v).toLocaleString("en-IN")}` : "—");
const count = (v: number) => v.toLocaleString("en-IN");
const pct = (v: number | null) => (v !== null ? formatPercent(v, 1) : "—");
const nights = (v: number | null) => (v !== null ? `${v.toFixed(1)} nights` : "—");

type MetricRow = { kind: "metric"; label: string; value: (m: FolioReportMetrics) => string; note?: string };
type SectionRow = { kind: "section"; label: string };
type Row = MetricRow | SectionRow;

// Sheet's own row grouping (PRD §1.1/§1.2). "Not yet confirmed" rows (PRD
// §1.3 — B2C/OTA revenue-adr-share, the whole booking-behavior section) are
// still built and shown, per the PRD's own "doesn't block the build"
// direction — flagged with `note` instead of being left out.
const ROWS: Row[] = [
  { kind: "section", label: "Revenue" },
  { kind: "metric", label: "Room Revenue", value: (m) => money(m.roomRevenue) },
  { kind: "metric", label: "F&B Revenue", value: (m) => money(m.fnbRevenue) },
  { kind: "metric", label: "Total Revenue", value: (m) => money(m.totalRevenue) },
  { kind: "metric", label: "F&B Revenue Share", value: (m) => pct(m.fnbRevenueSharePct) },

  { kind: "section", label: "Room Sales" },
  { kind: "metric", label: "Available Room Nights", value: (m) => count(m.availableRoomNights) },
  { kind: "metric", label: "Sold Room Nights", value: (m) => count(m.soldRoomNights) },
  { kind: "metric", label: "Occupancy %", value: (m) => pct(m.occupancyPct) },
  { kind: "metric", label: "Guests Served", value: (m) => count(m.guestsServed) },
  { kind: "metric", label: "RevPAR", value: (m) => rupee(m.revPar) },
  { kind: "metric", label: "ADR", value: (m) => rupee(m.adr) },
  { kind: "metric", label: "Rev per Guest", value: (m) => rupee(m.revPerGuest) },

  { kind: "section", label: "B2B" },
  { kind: "metric", label: "B2B Nights", value: (m) => count(m.b2bNights) },
  { kind: "metric", label: "B2B Revenue", value: (m) => money(m.b2bRevenue) },
  { kind: "metric", label: "B2B ADR", value: (m) => rupee(m.b2bAdr) },
  {
    kind: "metric",
    label: "B2B Revenue Share",
    value: (m) => pct(m.b2bRevenueSharePct),
    note: "b2b_bills' all-time revenue ÷ this column's Room Revenue — not a normal share, can exceed 100% by design (PRD §1.2). Only the Overall column's magnitude was checked against the source sheet; individual month values are not independently confirmed.",
  },

  { kind: "section", label: "B2C" },
  { kind: "metric", label: "B2C Nights", value: (m) => count(m.b2cNights) },
  { kind: "metric", label: "B2C Revenue", value: (m) => money(m.b2cRevenue), note: "Not yet independently confirmed against the source sheet (PRD §1.3)." },
  { kind: "metric", label: "B2C ADR", value: (m) => rupee(m.b2cAdr), note: "Not yet independently confirmed against the source sheet (PRD §1.3)." },
  { kind: "metric", label: "B2C Revenue Share", value: (m) => pct(m.b2cRevenueSharePct), note: "Not yet independently confirmed against the source sheet (PRD §1.3)." },

  { kind: "section", label: "OTA" },
  { kind: "metric", label: "OTA Nights", value: (m) => count(m.otaNights), note: "Structure not yet directly inspected against the source sheet (PRD §1.3)." },
  { kind: "metric", label: "OTA Revenue", value: (m) => money(m.otaRevenue), note: "Structure not yet directly inspected against the source sheet (PRD §1.3)." },
  { kind: "metric", label: "OTA ADR", value: (m) => rupee(m.otaAdr), note: "Structure not yet directly inspected against the source sheet (PRD §1.3)." },
  { kind: "metric", label: "OTA Revenue Share", value: (m) => pct(m.otaRevenueSharePct), note: "Structure not yet directly inspected against the source sheet (PRD §1.3)." },

  { kind: "section", label: "Booking Behavior" },
  { kind: "metric", label: "Total Bookings", value: (m) => count(m.totalBookings), note: "Row group not yet independently confirmed against the source sheet's own grouping (PRD §1.3)." },
  { kind: "metric", label: "Repeat Count", value: (m) => count(m.repeatCount) },
  { kind: "metric", label: "Unique Count", value: (m) => count(m.uniqueCount) },
  { kind: "metric", label: "Repeat %", value: (m) => pct(m.repeatSharePct) },
  { kind: "metric", label: "ALOS", value: (m) => nights(m.alos) },

  { kind: "section", label: "Expats" },
  { kind: "metric", label: "Expat Bookings", value: (m) => count(m.expatBookings) },
  { kind: "metric", label: "Expat Revenue", value: (m) => money(m.expatRevenue) },
  { kind: "metric", label: "Expat Revenue %", value: (m) => pct(m.expatRevenueSharePct) },
  { kind: "metric", label: "Expat Nights", value: (m) => count(m.expatNights) },
  { kind: "metric", label: "Expat ALOS", value: (m) => nights(m.expatAlos) },
  { kind: "metric", label: "Expat Repeat Count", value: (m) => count(m.expatRepeatCount) },
  { kind: "metric", label: "Expat Repeat Share", value: (m) => pct(m.expatRepeatSharePct) },
];

function ColumnHeaderGroup({ block, columnCount, colWidthPx }: { block: FolioReportBlock; columnCount: number; colWidthPx: number }) {
  return (
    <th colSpan={columnCount} className="sticky top-0 z-10 border-b border-l border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center text-[11px] font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300" style={{ minWidth: colWidthPx * columnCount }}>
      {block.label}
    </th>
  );
}

const COL_WIDTH = 84;

export default function FolioReportTable({ report }: { report: FolioReport }) {
  const blocks = [report.overall, ...report.months];
  // Never the static REPORT_COLUMNS constant here — the Property filter
  // narrows which columns actually exist on every block (see FolioReport's
  // own `columns` field doc comment); rendering a column the report didn't
  // fetch crashes on `row.value(undefined)` (caught live: filtering to just
  // KDP threw "Cannot read properties of undefined (reading 'roomRevenue')"
  // the moment the table tried to render the HTC/JHS/BH4/GB columns that
  // simply weren't in the filtered report).
  const columns = report.columns;

  return (
    <div className="min-w-0 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Folio Based Report {report.fy}</h3>
        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
          &quot;Overall – till date&quot; is {report.fy}&apos;s start through {report.asOfLabel} (inclusive). Every other block is a full calendar month —
          months after {report.asOfLabel} show real advance-booking data already on the books, not a projection.
        </p>
      </div>
      {/* Bounded scroll box, both axes, is load-bearing here — not just a
          size preference. The table's own sticky header cells stick
          relative to their nearest scrolling ancestor; without one, that's
          the whole page, which is ALSO where the shared layout's own
          sticky FilterBar lives (app/(dashboard)/layout.tsx) — the two
          fought over the same top:0 slot and the FilterBar visibly broke
          (confirmed live in the browser before this fix). A bounded
          max-height + overflow-auto gives the table its own scroll
          context, so its sticky headers only ever stick within this box. */}
      <div className="max-h-[75vh] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 top-0 z-30 min-w-[180px] border-b border-r border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                Metric
              </th>
              {blocks.map((b) => (
                <ColumnHeaderGroup key={b.key} block={b} columnCount={columns.length} colWidthPx={COL_WIDTH} />
              ))}
            </tr>
            <tr>
              {blocks.map((b) =>
                columns.map((c) => (
                  <th
                    key={`${b.key}-${c}`}
                    className="sticky top-[27px] z-10 border-b border-l border-zinc-200 bg-zinc-50 px-2 py-1 text-center font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                    style={{ minWidth: COL_WIDTH }}
                  >
                    {c}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) =>
              row.kind === "section" ? (
                <tr key={`section-${i}`}>
                  <td
                    colSpan={1 + blocks.length * columns.length}
                    className="sticky left-0 z-10 border-b border-zinc-200 bg-zinc-100 px-3 py-1 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                  >
                    {row.label}
                  </td>
                </tr>
              ) : (
                <tr key={row.label} className="odd:bg-white even:bg-zinc-50 dark:odd:bg-zinc-950 dark:even:bg-zinc-900">
                  <td
                    className="sticky left-0 z-10 border-b border-r border-zinc-100 bg-inherit px-3 py-1 text-left text-zinc-700 dark:border-zinc-800 dark:text-zinc-200"
                    title={row.note}
                  >
                    {row.label}
                    {row.note && <span className="ml-1 text-amber-500" title={row.note}>⚠</span>}
                  </td>
                  {blocks.map((b) =>
                    columns.map((c) => (
                      <td
                        key={`${b.key}-${c}`}
                        className={
                          "border-b border-l border-zinc-100 px-2 py-1 text-right tabular-nums dark:border-zinc-800 " +
                          (c === "TOTAL" ? "font-semibold text-zinc-800 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400")
                        }
                      >
                        {row.value(b.columns[c])}
                      </td>
                    ))
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
