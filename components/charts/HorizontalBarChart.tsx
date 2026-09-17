"use client";

// Horizontal bars (redesign §1): for any category axis where labels are too
// long or numerous to read flat under a vertical bar (company names, lead
// sources, room formats) — the label reads left-to-right at full width
// instead of being truncated or rotated.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, LabelList } from "recharts";
import { CHART_GRIDLINE, CHART_TEXT } from "@/lib/design/tokens";
import type { BarDatum } from "./SingleMetricBarChart";

// 2026-09-17: without this, Recharts wraps a Y-axis category label onto as
// many lines as it takes to fit `labelWidth` — for something short like a
// room type that's one line and fine, but a long legal company name (often
// with a "(Subsidiary of ...)" or "(SEZ)" suffix) wraps to 3-4 lines and
// overflows into the row above/below it, since each row only has a fixed
// slice of the chart's height. Truncating with an ellipsis keeps every row
// to one line; the full name is still available in the Tooltip on hover.
function TruncatedTick({ x, y, payload, maxChars }: { x?: number; y?: number; payload?: { value?: string }; maxChars: number }) {
  const v = payload?.value ?? "";
  const truncated = v.length > maxChars ? `${v.slice(0, maxChars - 1)}…` : v;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill={CHART_TEXT.secondary}>
      {truncated}
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
  const resolvedHeight = height ?? Math.max(140, data.length * 32);
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
          {/* 2026-09-09: optional secondary figure (e.g. ADR next to a
              revenue bar) — only rendered when at least one row sets it,
              so every existing caller (which never sets rightLabel) is
              unaffected. */}
          {data.some((d) => d.rightLabel) && (
            <LabelList dataKey="rightLabel" position="right" style={{ fontSize: 11, fill: CHART_TEXT.secondary }} />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
