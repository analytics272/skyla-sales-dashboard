"use client";

import { useState, useRef, useEffect } from "react";
import clsx from "clsx";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[]; // empty = "All"
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const buttonText = selected.length === 0 ? "All" : selected.length === 1 ? options.find((o) => o.value === selected[0])?.label ?? selected[0] : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-teal-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-teal-800"
      >
        <span className="uppercase tracking-wide text-teal-100">{label}:</span>
        <span>{buttonText}</span>
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              onChange([]);
              setOpen(false);
            }}
            className={clsx(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800",
              selected.length === 0 && "font-semibold text-teal-700 dark:text-teal-400"
            )}
          >
            All
          </button>
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-3.5 w-3.5 accent-teal-700"
              />
              <span className="text-zinc-700 dark:text-zinc-200">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
