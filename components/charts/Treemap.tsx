"use client";

// Treemap (redesign 2026-09-02, fourth pass) — for ranked lists with many
// items and a wide spread of magnitudes (100+ B2B companies by revenue,
// dozens of lead sources) where a long scrollable bar list makes the
// biggest few items hard to spot at a glance; box area reads relative size
// immediately, and small items still get a labeled box instead of
// disappearing off the bottom of a bar chart.
import { Treemap as RTreemap, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_TEXT } from "@/lib/design/tokens";

export interface TreemapDatum {
  name: string;
  value: number;
  color: string;
}

function TreemapCell(props: { x?: number; y?: number; width?: number; height?: number; name?: string; value?: number; color?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, name, color } = props;
  const showLabel = width > 46 && height > 22;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} stroke="var(--chart-surface)" strokeWidth={2} rx={3} />
      {showLabel && (
        <text x={x + 6} y={y + 16} fontSize={11} fill="#fff" style={{ pointerEvents: "none" }}>
          {name && name.length > (width / 7) ? `${name.slice(0, Math.max(3, Math.floor(width / 7)))}…` : name}
        </text>
      )}
    </g>
  );
}

export default function Treemap({
  data,
  valueFormatter,
  height = 320,
}: {
  data: TreemapDatum[];
  valueFormatter: (v: number) => string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RTreemap
        // Recharts' own TreemapDataType requires an index signature our
        // shared BarDatum-shaped inputs don't carry — the shape is otherwise
        // exactly what Treemap needs (name/value/color).
        data={data as unknown as Record<string, unknown>[]}
        dataKey="value"
        aspectRatio={4 / 3}
        stroke="var(--chart-surface)"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content={TreemapCell as any}
        isAnimationActive={false}
      >
        <Tooltip
          formatter={(value, name) => [valueFormatter(Number(value)), name]}
          contentStyle={{
            background: "var(--chart-surface)",
            border: "1px solid var(--chart-gridline)",
            borderRadius: 6,
            fontSize: 12,
            color: CHART_TEXT.primary,
          }}
        />
      </RTreemap>
    </ResponsiveContainer>
  );
}
