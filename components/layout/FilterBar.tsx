"use client";

// 2026-09-02 redesign, third pass: matches the reference dashboard's exact
// arrangement (skyla-fnb.lovable.app/?preset=fy) — page title on the left,
// everything else (period pills, Compare-to-last-year toggle, Property,
// Reset) clustered on the right of the same bar. "Last Year" is a toggle
// here, not a 7th tab — see lib/reference/period.ts for why. "Last Updated"
// lives in the sidebar (§3), not here.
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useFilters } from "@/lib/filters/FiltersContext";
import { ACTIVE_PROPERTY_CODES } from "@/lib/reference/propertyReference";
import { PERIOD_OPTIONS, PeriodKey } from "@/lib/reference/period";
import { TABS } from "@/lib/navigation";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import clsx from "clsx";

const PROPERTY_OPTIONS = ACTIVE_PROPERTY_CODES.map((code) => ({ value: code, label: code }));

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CustomRangePopover({ onClose }: { onClose: () => void }) {
  const { customStart, customEnd, setCustomRange } = useFilters();
  const [start, setStart] = useState(customStart ?? todayIso());
  const [end, setEnd] = useState(customEnd ?? todayIso());

  return (
    <div className="absolute right-0 top-full z-30 mt-2 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-500 dark:text-zinc-400">
          From
          {/* No `min`/`max` tying these two fields to each other: an earlier
              version set the "From" field's max to the "To" field's current
              value (defaulting to today), which silently blocked picking any
              "From" date past today until "To" was extended first — the
              "stopped working after Sept 2nd" bug. Order of entry no longer
              matters; out-of-order values are normalized below on Apply.
              sales_booking legitimately holds forward/advance bookings with a
              future StayDate (see Remaining Room Nights), so a range entirely
              in the future, or spanning any past/future year, is valid. */}
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
        <label className="text-xs text-zinc-500 dark:text-zinc-400">
          To
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => {
          // Normalize here instead of constraining the inputs live — if the
          // user picked them out of order, swap rather than reject.
          const [from, to] = start <= end ? [start, end] : [end, start];
          setCustomRange(from, to);
          onClose();
        }}
        className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
      >
        Apply
      </button>
    </div>
  );
}

export default function FilterBar() {
  const pathname = usePathname();
  const { properties, period, compareYoY, setProperties, setPeriod, setCompareYoY, resetAll } = useFilters();
  const [customOpen, setCustomOpen] = useState(false);

  const activeTab = TABS.find((t) => pathname === `/${t.slug}`);

  function handlePillClick(key: PeriodKey) {
    if (key === "custom") {
      setCustomOpen((v) => !v);
      return;
    }
    setCustomOpen(false);
    setPeriod(key);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
      <h1 className="shrink-0 text-base font-semibold text-zinc-900 dark:text-zinc-50">{activeTab?.label ?? "Dashboard"}</h1>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div role="tablist" aria-label="Comparison period" className="relative flex flex-wrap items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
          {PERIOD_OPTIONS.map((opt) => (
            <div key={opt.key} className="relative">
              <button
                type="button"
                role="tab"
                aria-selected={period === opt.key}
                onClick={() => handlePillClick(opt.key)}
                className={clsx(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                  period === opt.key
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                )}
              >
                {opt.label}
              </button>
              {opt.key === "custom" && customOpen && <CustomRangePopover onClose={() => setCustomOpen(false)} />}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCompareYoY(!compareYoY)}
          title="Compare the current selection to the same dates last year, instead of the preceding period"
          className={clsx(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            compareYoY
              ? "border-teal-700 bg-teal-700 text-white"
              : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          )}
        >
          <span className={clsx("h-2 w-2 rounded-full", compareYoY ? "bg-white" : "bg-zinc-400")} />
          Compare to Last Year
        </button>

        <MultiSelectDropdown label="Property" options={PROPERTY_OPTIONS} selected={properties} onChange={setProperties} />

        <button
          type="button"
          onClick={resetAll}
          className="rounded-full border border-teal-700 px-3 py-1.5 text-xs font-medium text-teal-700 shadow-sm transition-colors hover:bg-teal-50 dark:border-teal-400 dark:text-teal-300 dark:hover:bg-teal-900/30"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
