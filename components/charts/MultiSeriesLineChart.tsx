"use client";

// One line per series (e.g. one per FY), shared x-axis (e.g. fiscal month).
// Multi-series -> legend always present (color-matching is the only way to
// tell lines apart when it's not the mark nearest the reader's eye).
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_GRIDLINE, CHART_TEXT } from "@/lib/design/tokens";

export default function MultiSeriesLineChart({
  data,
  xKey,
  series,
  valueFormatter,
  height = 280,
  yTicks,
  yDomain,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; color: string }[];
  valueFormatter: (v: number) => string;
  height?: number;
  /** Explicit tick values, e.g. finer steps at the low end and coarser above a threshold. Overrides Recharts' auto ticks. */
  yTicks?: number[];
  /** Explicit y-axis domain, e.g. [0, 100] for a percentage scale. */
  yDomain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
          ticks={yTicks}
          domain={yDomain}
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
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_TEXT.secondary }} iconType="plainline" />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color, stroke: "var(--chart-surface)", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: s.color, stroke: "var(--chart-surface)", strokeWidth: 2 }}
            // No connectNulls: a null means "hasn't happened yet" (see
            // pivotByFiscalMonth), and the line should visibly stop there
            // rather than bridge a false diagonal across to the next FY's data.
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
