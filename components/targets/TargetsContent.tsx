"use client";

import { CategoryAchievement, RevenueAchievement, MonthlyRevenueTarget, MonthlyAdrTarget, MonthlyOccupancyTarget } from "@/lib/bigquery/queries/targets";
import type { PropertyTargetComparison, PropertyTargetComparisonResult } from "@/lib/bigquery/queries/propertyTargets";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import Table, { TableColumn } from "@/components/ui/Table";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import MultiSeriesLineChart from "@/components/charts/MultiSeriesLineChart";
import { formatIndianCurrency, formatPercent } from "@/lib/format/currency";
import { TARGET_VS_ACHIEVED_COLOR, REVENUE_ROLLOVER_COLOR } from "@/lib/design/tokens";
import { calendarMonthFromFiscal, isFutureFiscalMonth } from "@/lib/reference/financialYear";

const TA_SERIES = [
  { key: "target", color: TARGET_VS_ACHIEVED_COLOR.target },
  { key: "achieved", color: TARGET_VS_ACHIEVED_COLOR.achieved },
];

const ROLLOVER_SERIES = [
  { key: "deptTarget", color: REVENUE_ROLLOVER_COLOR.deptTarget },
  { key: "targetWithRollOver", color: REVENUE_ROLLOVER_COLOR.targetWithRollOver },
  { key: "achieved", color: REVENUE_ROLLOVER_COLOR.achieved },
];

// Null out "achieved" only when the month hasn't started AND there's
// genuinely nothing recorded yet — so the line stops there instead of
// flat-lining at 0 as if "achieved nothing" were a settled outcome. A
// calendar-future month with real advance/forward-booked revenue already
// against it (common in hospitality) still shows that real value. Target/plan
// series aren't touched either way — they're meant to project the full FY.
function shouldHideAchieved(fy: string, monthNumber: number, achieved: number) {
  return achieved === 0 && isFutureFiscalMonth(fy, calendarMonthFromFiscal(monthNumber));
}

export default function TargetsContent({
  fy,
  categoryAchievement,
  revenueAchievement,
  monthlyRevenueTargets,
  adrTargetVsAchieved,
  occupancyTargetVsAchieved,
  propertyTargetComparison,
}: {
  fy: string;
  categoryAchievement: CategoryAchievement[];
  revenueAchievement: RevenueAchievement;
  monthlyRevenueTargets: MonthlyRevenueTarget[];
  adrTargetVsAchieved: MonthlyAdrTarget[];
  occupancyTargetVsAchieved: MonthlyOccupancyTarget[];
  propertyTargetComparison: PropertyTargetComparisonResult;
}) {
  const categoryData = categoryAchievement.map((c) => ({
    category: c.category,
    target: c.target,
    achieved: c.achieved,
  }));

  const propertyColumns: TableColumn<PropertyTargetComparison>[] = [
    { key: "property", header: "Property", render: (r) => r.property },
    { key: "targetRevenue", header: "Target Revenue", align: "right", render: (r) => formatIndianCurrency(r.targetRevenue) },
    { key: "achievedRevenue", header: "Achieved Revenue", align: "right", render: (r) => formatIndianCurrency(r.achievedRevenue) },
    { key: "achievedPct", header: "Achievement %", align: "right", render: (r) => (r.achievedPct !== null ? formatPercent(r.achievedPct, 0) : "—") },
    { key: "targetOcc", header: "Target Occ %", align: "right", render: (r) => (r.targetOccPct !== null ? formatPercent(r.targetOccPct, 0) : "—") },
    { key: "achievedOcc", header: "Achieved Occ %", align: "right", render: (r) => (r.achievedOccPct !== null ? formatPercent(r.achievedOccPct, 0) : "—") },
    { key: "targetArr", header: "Target ARR", align: "right", render: (r) => (r.targetArr !== null ? `₹${Math.round(r.targetArr).toLocaleString("en-IN")}` : "—") },
    { key: "achievedArr", header: "Achieved ARR", align: "right", render: (r) => (r.achievedArr !== null ? `₹${Math.round(r.achievedArr).toLocaleString("en-IN")}` : "—") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Targets Vs Achieved</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2">
          <StatTile
            label="Revenue Achievement"
            value={revenueAchievement.achievedPct !== null ? formatPercent(revenueAchievement.achievedPct) : "—"}
            sub={`${formatIndianCurrency(revenueAchievement.achieved)} of ${formatIndianCurrency(revenueAchievement.target)}`}
            progress={revenueAchievement.achievedPct !== null ? { pct: revenueAchievement.achievedPct } : undefined}
          />
          <StatTile label="Target" value={formatIndianCurrency(revenueAchievement.target)} />
        </div>
      </div>

      <Card title="Revenue Targets By Property" subtitle={`Fixed reference plan — ${fy}`}>
        <Table columns={propertyColumns} rows={propertyTargetComparison.rows} rowKey={(r) => r.property} footerRow={propertyTargetComparison.total} />
      </Card>

      <Card title="B2B / B2C / OTA Achievement">
        <GroupedBarChart data={categoryData} xKey="category" series={TA_SERIES} valueFormatter={(v) => formatIndianCurrency(v)} />
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          {categoryAchievement.map((c) => (
            <div key={c.category}>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{c.category}</p>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {c.achievedPct !== null ? formatPercent(c.achievedPct) : "—"}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Revenue Targets With Roll Over">
        <MultiSeriesLineChart
          data={monthlyRevenueTargets.map((r) => ({
            month: r.month,
            deptTarget: r.deptTarget,
            targetWithRollOver: r.targetWithRollOver,
            achieved: shouldHideAchieved(fy, r.monthNumber, r.achievedRevenue) ? null : r.achievedRevenue,
          }))}
          xKey="month"
          series={ROLLOVER_SERIES}
          valueFormatter={(v) => formatIndianCurrency(v)}
          height={260}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ADR: Target Vs Achieved">
          <MultiSeriesLineChart
            data={adrTargetVsAchieved.map((r) => ({ month: r.month, target: r.targetAdr, achieved: shouldHideAchieved(fy, r.monthNumber, r.achievedAdr) ? null : r.achievedAdr }))}
            xKey="month"
            series={TA_SERIES}
            valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`}
            height={240}
          />
        </Card>

        <Card title="Occupancy: Target Vs Achieved">
          <MultiSeriesLineChart
            data={occupancyTargetVsAchieved.map((r) => ({
              month: r.month,
              target: r.targetOccupancyPct * 100,
              achieved: shouldHideAchieved(fy, r.monthNumber, r.achievedOccupancyPct) ? null : r.achievedOccupancyPct * 100,
            }))}
            xKey="month"
            series={TA_SERIES}
            valueFormatter={(v) => `${v.toFixed(0)}%`}
            height={240}
          />
        </Card>
      </div>
    </div>
  );
}
