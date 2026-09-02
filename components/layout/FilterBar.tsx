"use client";

// 2026-09-02 redesign: FY/Quarter/Month dropdowns replaced entirely by three
// clickable period-tab pills (Today / This FY / Last Year), matching the
// reference dashboard (skyla-fnb.lovable.app). Property stays a separate
// multi-select. "Last Updated" moved to the sidebar bottom-left (see §3).
import { useFilters } from "@/lib/filters/FiltersContext";
import { ACTIVE_PROPERTY_CODES } from "@/lib/reference/propertyReference";
import { PERIOD_OPTIONS } from "@/lib/reference/period";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import clsx from "clsx";

const PROPERTY_OPTIONS = ACTIVE_PROPERTY_CODES.map((code) => ({ value: code, label: code }));

export default function FilterBar() {
  const { properties, period, setProperties, setPeriod, resetAll } = useFilters();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
      <div role="tablist" aria-label="Comparison period" className="flex items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={period === opt.key}
            onClick={() => setPeriod(opt.key)}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
              period === opt.key
                ? "bg-teal-700 text-white shadow-sm"
                : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
