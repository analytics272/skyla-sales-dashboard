"use client";

import { useState } from "react";
import Card from "./Card";
import clsx from "clsx";

// Internal-tabbed card (redesign 2026-09-02, third pass) — one card, a pill
// row switching which entity's content is shown inside it, instead of N
// side-by-side cards. Matches the reference dashboard's own "Channel Mix"
// pattern (Overview/Walk In/IRD/Delivery/Take Away tabs within one card).
export default function TabbedCard<T extends string>({
  title,
  subtitle,
  tabs,
  active,
  onChange,
  children,
}: {
  title: string;
  subtitle?: string;
  tabs: T[];
  active: T;
  onChange: (tab: T) => void;
  children: React.ReactNode;
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div role="tablist" className="mb-3 flex flex-wrap items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900" style={{ width: "fit-content" }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            onClick={() => onChange(tab)}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              active === tab
                ? "bg-teal-700 text-white shadow-sm"
                : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            )}
          >
            {tab}
          </button>
        ))}
      </div>
      {children}
    </Card>
  );
}

/** Internal state helper — most callers just need "pick the first tab by default and swap on click". */
export function useTabbedCard<T extends string>(tabs: T[]): [T, (t: T) => void] {
  const [active, setActive] = useState<T>(tabs[0]);
  return [active, setActive];
}
