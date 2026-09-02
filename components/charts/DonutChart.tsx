"use client";

// Donut chart for proportions (redesign §1/§10) — Lost Reasons, category
// mixes, and other "share of whole" reads where a bar chart obscures the
// part-to-whole relationship a pie communicates directly.
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_TEXT } from "@/lib/design/tokens";

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

export default function DonutChart({
  data,
  valueFormatter,
  height = 240,
  innerRadiusRatio = 0.62,
}: {
  data: DonutDatum[];
  valueFormatter: (v: number) => string;
  height?: number;
  innerRadiusRatio?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      <ResponsiveContainer width="100%" height={height} className="max-w-[220px] shrink-0">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={`${innerRadiusRatio * 100}%`}
            outerRadius="90%"
            paddingAngle={data.length > 1 ? 2 : 0}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const n = Number(value);
              return [`${valueFormatter(n)} (${total > 0 ? ((n / total) * 100).toFixed(0) : 0}%)`, name];
            }}
            contentStyle={{
              background: "var(--chart-surface)",
              border: "1px solid var(--chart-gridline)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* grid-cols-[auto_auto]: columns size to their own content instead of
          a flex row stretching label/value to the card's full width — a
          short label ("Lost") no longer leaves a large empty gap before its
          value the way a `justify-between` row would. */}
      <div className="grid w-full min-w-0 auto-rows-min grid-cols-[auto_auto] items-center gap-x-4 gap-y-1.5 text-xs sm:w-auto">
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            // display:contents so this wrapper doesn't itself occupy a grid
            // cell — its two <span> children become the grid's actual items,
            // keeping every row's label/value columns aligned.
            <div key={d.name} className="contents">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="truncate" style={{ color: CHART_TEXT.secondary }}>{d.name}</span>
              </span>
              <span className="justify-self-end font-medium tabular-nums" style={{ color: CHART_TEXT.primary }}>
                {valueFormatter(d.value)} · {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
