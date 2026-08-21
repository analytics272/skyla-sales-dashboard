"use client";

import { useFilters } from "@/lib/filters/FiltersContext";
import { ACTIVE_PROPERTY_CODES } from "@/lib/reference/propertyReference";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";

// Matches the confirmed data range (sales_booking spans FY24-25 through FY26-27
// forward bookings; leadership_targets covers the same 3 FYs).
const FY_OPTIONS = ["FY 24-25", "FY 25-26", "FY 26-27"];

const QUARTER_OPTIONS: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: "Q1 (Apr-Jun)" },
  { value: 2, label: "Q2 (Jul-Sep)" },
  { value: 3, label: "Q3 (Oct-Dec)" },
  { value: 4, label: "Q4 (Jan-Mar)" },
];

const MONTH_OPTIONS = [
  { value: "1", label: "January" }, { value: "2", label: "February" }, { value: "3", label: "March" },
  { value: "4", label: "April" }, { value: "5", label: "May" }, { value: "6", label: "June" },
  { value: "7", label: "July" }, { value: "8", label: "August" }, { value: "9", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
];

const PROPERTY_OPTIONS = ACTIVE_PROPERTY_CODES.map((code) => ({ value: code, label: code }));

function selectClasses() {
  return "rounded-full border-0 bg-teal-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400";
}

function formatLastUpdate(d: Date): string {
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const month = d.toLocaleString("en-US", { month: "long" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day}${suffix} ${month} - ${time}`;
}

const FY_MULTI_OPTIONS = FY_OPTIONS.map((fy) => ({ value: fy, label: fy }));

export default function FilterBar() {
  const { properties, fys, quarter, months, setProperties, setFys, setQuarter, setMonths } = useFilters();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
      <span className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        Last Update - {formatLastUpdate(new Date())}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectDropdown label="Property" options={PROPERTY_OPTIONS} selected={properties} onChange={setProperties} />

        <MultiSelectDropdown
          label="Month"
          options={MONTH_OPTIONS}
          selected={months.map(String)}
          onChange={(vals) => setMonths(vals.map(Number))}
        />

        <select value={quarter ?? ""} onChange={(e) => setQuarter(e.target.value ? (Number(e.target.value) as 1 | 2 | 3 | 4) : undefined)} className={selectClasses()}>
          <option value="">Quarter: All</option>
          {QUARTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <MultiSelectDropdown label="FY" options={FY_MULTI_OPTIONS} selected={fys} onChange={setFys} />
      </div>
    </div>
  );
}
