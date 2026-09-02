"use client";

// Horizontal bars (redesign §1): for any category axis where labels are too
// long or numerous to read flat under a vertical bar (company names, lead
// sources, room formats) — the label reads left-to-right at full width
// instead of being truncated or rotated.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { CHART_GRIDLINE, CHART_TEXT } from "@/lib/design/tokens";
import type { BarDatum } from "./SingleMetricBarChart";

export default function HorizontalBarChart({
  data,
  valueFormatter,
  height,
  labelWidth = 110,
}: {
  data: BarDatum[];
  valueFormatter: (v: number) => string;
  height?: number;
  labelWidth?: number;
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
          tick={{ fill: CHART_TEXT.secondary, fontSize: 11 }}
          axisLine={{ stroke: CHART_GRIDLINE }}
          tickLine={false}
          width={labelWidth}
        />
        <Tooltip
          formatter={(value) => valueFormatter(Number(value))}
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
