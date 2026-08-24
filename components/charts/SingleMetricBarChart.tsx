"use client";

// One bar per category (e.g. Revenue by Source). The x-axis tick already
// names each bar, so it is the direct-label identity channel — a legend
// would just restate it. Bars are still colored by the fixed categorical
// palette as a secondary reinforcement.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { CHART_GRIDLINE, CHART_TEXT } from "@/lib/design/tokens";

export interface BarDatum {
  name: string;
  value: number;
  color: string;
}

export default function SingleMetricBarChart({
  data,
  valueFormatter,
  height = 240,
}: {
  data: BarDatum[];
  valueFormatter: (v: number) => string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid stroke={CHART_GRIDLINE} vertical={false} strokeWidth={1} />
        <XAxis
          dataKey="name"
          tick={{ fill: CHART_TEXT.secondary, fontSize: 11 }}
          axisLine={{ stroke: CHART_GRIDLINE }}
          tickLine={false}
          interval={0}
          angle={-90}
          textAnchor="end"
          height={90}
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
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
