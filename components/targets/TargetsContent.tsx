"use client";

import { CategoryAchievement, RevenueAchievement, MonthlyRevenueTarget, MonthlyAdrTarget, MonthlyOccupancyTarget } from "@/lib/bigquery/queries/targets";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
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

export default function TargetsContent({
  fy,
  categoryAchievement,
  revenueAchievement,
  monthlyRevenueTargets,
  adrTargetVsAchieved,
  occupancyTargetVsAchieved,
}: {
  fy: string;
  categoryAchievement: CategoryAchievement[];
  revenueAchievement: RevenueAchievement;
  monthlyRevenueTargets: MonthlyRevenueTarget[];
  adrTargetVsAchieved: MonthlyAdrTarget[];
  occupancyTargetVsAchieved: MonthlyOccupancyTarget[];
}) {
  const categoryData = categoryAchievement.map((c) => ({
    category: c.category,
    target: c.target,
    achieved: c.achieved,
  }));

  // "Achieved" is a real fact only for months that have started — future
  // months null it out so the line stops there instead of flat-lining at 0
  // (as if "achieved nothing" were already a settled outcome). Target/plan
  // series aren't touched — they're meant to project across the whole FY.
  const future = (monthNumber: number) => isFutureFiscalMonth(fy, calendarMonthFromFiscal(monthNumber));

  const adrData = adrTargetVsAchieved.map((r) => ({
    month: r.month,
    target: r.targetAdr,
    achieved: future(r.monthNumber) ? null : r.achievedAdr,
  }));

  const occupancyData = occupancyTargetVsAchieved.map((r) => ({
    month: r.month,
    target: r.targetOccupancyPct * 100,
    achieved: future(r.monthNumber) ? null : r.achievedOccupancyPct * 100,
  }));

  const rolloverData = monthlyRevenueTargets.map((r) => ({
    month: r.month,
    deptTarget: r.deptTarget,
    targetWithRollOver: r.targetWithRollOver,
    achieved: future(r.monthNumber) ? null : r.achievedRevenue,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Targets vs Achieved</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Revenue achievement"
            value={revenueAchievement.achievedPct !== null ? formatPercent(revenueAchievement.achievedPct) : "—"}
            sub={`${formatIndianCurrency(revenueAchievement.achieved)} of ${formatIndianCurrency(revenueAchievement.target)}`}
          />
          <StatTile label="Target" value={formatIndianCurrency(revenueAchievement.target)} />
          <StatTile label="Target with roll-over" value={formatIndianCurrency(revenueAchievement.targetWithRollOver)} />
          <StatTile label="Achieved" value={formatIndianCurrency(revenueAchievement.achieved)} />
        </div>
      </div>

      <Card title="B2B / B2C / OTA achievement (target vs achieved)">
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

      <Card title="Revenue targets with roll over (monthly)">
        <MultiSeriesLineChart data={rolloverData} xKey="month" series={ROLLOVER_SERIES} valueFormatter={(v) => formatIndianCurrency(v)} />
      </Card>

      <Card title="ADR: target vs achieved (monthly)">
        <MultiSeriesLineChart data={adrData} xKey="month" series={TA_SERIES} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
      </Card>

      <Card title="Occupancy: target vs achieved (monthly)">
        <MultiSeriesLineChart data={occupancyData} xKey="month" series={TA_SERIES} valueFormatter={(v) => `${v.toFixed(0)}%`} />
      </Card>
    </div>
  );
}
