"use client";

// Plain controlled text input for client-side company-name search — used
// wherever a company list/table is long enough that scanning it by eye
// (even paginated) isn't enough: Bookings' Company Rankings, Leads' By
// Owner Detail Company Analysis, and Reports' B2B Details (2026-09-17).
// Filtering itself lives in each caller (different data shapes), this is
// just the shared input + icon so all three look and behave identically.
export default function SearchInput({
  value,
  onChange,
  placeholder = "Search company…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          ✕
        </button>
      )}
    </div>
  );
}
