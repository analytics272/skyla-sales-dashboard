"use client";

// Multiple series sharing one x-axis (e.g. B2B/B2C/OTA revenue by FY).
// Genuinely multi-series, so a legend is required — color-matching across
// groups is the only way to tell the series apart.
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_GRIDLINE, CHART_TEXT } from "@/lib/design/tokens";

export default function GroupedBarChart({
  data,
  xKey,
  series,
  valueFormatter,
  height = 280,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; color: string }[];
  valueFormatter: (v: number) => string;
  height?: number;
}) {
  // A prior pass capped this chart's own width by category count to avoid a
  // large gap between a couple of bars — reverted per explicit feedback:
  // that read as its own empty space (a shrink-wrapped chart with blank
  // margins on both sides). Recharts' `barCategoryGap`/`barGap` already
  // control in-chart spacing; let the chart fill the full card width.
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="24%" barGap={2}>
        <CartesianGrid stroke={CHART_GRIDLINE} vertical={false} strokeWidth={1} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: CHART_TEXT.secondary, fontSize: 12 }}
          axisLine={{ stroke: CHART_GRIDLINE }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: CHART_TEXT.muted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={valueFormatter}
          width={56}
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
        <Legend
          wrapperStyle={{ fontSize: 12, color: CHART_TEXT.secondary }}
          iconType="circle"
          iconSize={8}
        />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
