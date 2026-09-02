"use client";

import { CategoryAchievement, RevenueAchievement, MonthlyRevenueTarget, MonthlyAdrTarget, MonthlyOccupancyTarget } from "@/lib/bigquery/queries/targets";
import type { PropertyTargetComparisonResult } from "@/lib/bigquery/queries/propertyTargets";
import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import EntityCard from "@/components/ui/EntityCard";
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

  const propertyRevenueData = propertyTargetComparison.rows.map((r) => ({
    property: r.property,
    Target: r.targetRevenue,
    Achieved: r.achievedRevenue,
  }));

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

      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Revenue Targets By Property</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Fixed reference plan — {fy}</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total Target" value={formatIndianCurrency(propertyTargetComparison.total.targetRevenue)} />
          <StatTile label="Total Achieved" value={formatIndianCurrency(propertyTargetComparison.total.achievedRevenue)} />
          <StatTile
            label="Overall Achievement"
            value={propertyTargetComparison.total.achievedPct !== null ? formatPercent(propertyTargetComparison.total.achievedPct, 0) : "—"}
            progress={propertyTargetComparison.total.achievedPct !== null ? { pct: propertyTargetComparison.total.achievedPct } : undefined}
          />
          <StatTile label="Overall Occ %" value={propertyTargetComparison.total.achievedOccPct !== null ? formatPercent(propertyTargetComparison.total.achievedOccPct, 0) : "—"} />
        </div>
        <Card title="Target Vs Achieved Revenue By Property">
          <GroupedBarChart
            data={propertyRevenueData}
            xKey="property"
            series={[
              { key: "Target", color: TARGET_VS_ACHIEVED_COLOR.target },
              { key: "Achieved", color: TARGET_VS_ACHIEVED_COLOR.achieved },
            ]}
            valueFormatter={(v) => formatIndianCurrency(v)}
          />
        </Card>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {propertyTargetComparison.rows.map((r) => (
            <EntityCard
              key={r.property}
              name={r.property}
              headlineLabel="Achieved Revenue"
              headline={formatIndianCurrency(r.achievedRevenue)}
              progress={r.achievedPct !== null ? { pct: r.achievedPct, label: `${formatPercent(r.achievedPct, 0)} of ${formatIndianCurrency(r.targetRevenue)} target` } : undefined}
              stats={[
                { label: "Target Occ %", value: r.targetOccPct !== null ? formatPercent(r.targetOccPct, 0) : "—" },
                { label: "Achieved Occ %", value: r.achievedOccPct !== null ? formatPercent(r.achievedOccPct, 0) : "—" },
                { label: "Target ARR", value: r.targetArr !== null ? `₹${Math.round(r.targetArr).toLocaleString("en-IN")}` : "—" },
                { label: "Achieved ARR", value: r.achievedArr !== null ? `₹${Math.round(r.achievedArr).toLocaleString("en-IN")}` : "—" },
              ]}
            />
          ))}
        </div>
      </div>

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
