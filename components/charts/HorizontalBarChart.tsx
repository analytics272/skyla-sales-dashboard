"use client";

// Horizontal bars (redesign §1): for any category axis where labels are too
// long or numerous to read flat under a vertical bar (company names, lead
// sources, room formats) — the label reads left-to-right at full width
// instead of being truncated or rotated.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { CHART_GRIDLINE, CHART_TEXT } from "@/lib/design/tokens";
import type { BarDatum } from "./SingleMetricBarChart";

// 2026-09-17: without this, Recharts wraps a Y-axis category label onto as
// many lines as it takes to fit `labelWidth` — for something short like a
// room type that's one line and fine, but a long legal company name (often
// with a "(Subsidiary of ...)" or "(SEZ)" suffix) wraps to 3-4 lines and
// overflows into the row above/below it, since each row only has a fixed
// slice of the chart's height.
//
// First attempt (same day) truncated the whole "N. Company Name" string
// to a flat character count — but text-anchor="end" measures actual glyph
// width, not character count, so a wide-lettered name (all-caps "SYNERGY
// APARTMENT...") could still overflow the available width and get clipped
// from its LEFT edge — which is exactly where the "N." rank prefix lives.
// That's the bug the user screenshotted: the number silently disappearing
// on some rows while others kept theirs.
//
// Fixed by never truncating the number at all: it's split onto its own
// line via a separate <tspan>, so it can never be affected by how the
// company name is shortened. The company name gets its own line below,
// truncated by character count same as before — the full name is still
// available in the Tooltip on hover regardless.
function TruncatedTick({ x, y, payload, maxChars }: { x?: number; y?: number; payload?: { value?: string }; maxChars: number }) {
  const raw = payload?.value ?? "";
  const match = raw.match(/^(\d+\.)\s*(.*)$/);
  const rest = match ? match[2] : raw;
  const truncatedRest = rest.length > maxChars ? `${rest.slice(0, maxChars - 1)}…` : rest;

  if (!match) {
    // No "N. " rank prefix present (a caller passed maxLabelChars without
    // numbering) — fall back to a single truncated line.
    return (
      <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill={CHART_TEXT.secondary}>
        {truncatedRest}
      </text>
    );
  }
  return (
    <text x={x} y={y} textAnchor="end" fill={CHART_TEXT.secondary}>
      <tspan x={x} dy={-3} fontSize={11} fontWeight={600}>{match[1]}</tspan>
      <tspan x={x} dy={14} fontSize={11}>{truncatedRest}</tspan>
    </text>
  );
}

export default function HorizontalBarChart({
  data,
  valueFormatter,
  height,
  labelWidth = 110,
  maxLabelChars,
}: {
  data: BarDatum[];
  valueFormatter: (v: number) => string;
  height?: number;
  labelWidth?: number;
  /** Truncates long Y-axis labels to this many characters (+ "…") instead of letting Recharts wrap them across lines that overflow into neighboring rows. Full name still shows in the Tooltip. */
  maxLabelChars?: number;
}) {
  // A numbered two-line tick (rank number + company name, see TruncatedTick
  // above) needs more vertical room per row than a plain single-line tick.
  const resolvedHeight = height ?? Math.max(140, data.length * (maxLabelChars ? 56 : 32));
  return (
    <ResponsiveContainer width="100%" height={resolvedHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap="24%">
        <CartesianGrid stroke={CHART_GRIDLINE} horizontal={false} strokeWidth={1} />
        <XAxis
          type="number"
          tick={{ fill: CHART_TEXT.muted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={valueFormatter}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={maxLabelChars ? <TruncatedTick maxChars={maxLabelChars} /> : { fill: CHART_TEXT.secondary, fontSize: 11 }}
          axisLine={{ stroke: CHART_GRIDLINE }}
          tickLine={false}
          width={labelWidth}
        />
        <Tooltip
          // separator="" + empty name: show just "<category>\n<value>", not
          // the raw "value : X" dataKey label (2026-09-10 tooltip audit).
          separator=""
          formatter={(value) => [valueFormatter(Number(value)), ""]}
          contentStyle={{
            background: "var(--chart-surface)",
            border: "1px solid var(--chart-gridline)",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: CHART_TEXT.primary }}
          cursor={{ fill: "var(--chart-gridline)", opacity: 0.4 }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
