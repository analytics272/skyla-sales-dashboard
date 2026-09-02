"use client";

// Expandable panel (redesign §1/§7) — used to avoid clutter on long lists
// (e.g. Leads by Source, no longer capped to "Top 8") without hiding data
// entirely: shows a scrollable max-height by default, expands to full height
// on request.
import { useState } from "react";

export default function Expandable({
  children,
  collapsedHeight = 320,
  label = "Show all",
}: {
  children: React.ReactNode;
  collapsedHeight?: number;
  label?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div className={expanded ? "" : "overflow-y-auto"} style={expanded ? undefined : { maxHeight: collapsedHeight }}>
        {children}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
      >
        {expanded ? "Show less" : label}
      </button>
    </div>
  );
}
