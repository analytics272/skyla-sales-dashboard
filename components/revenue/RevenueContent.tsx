"use client";

import { OverviewKpis, PropertyAdr, OccupancyPace, LastMonthCategorySnapshot } from "@/lib/bigquery/queries/overview";
import { MonthlyTrendPoint } from "@/lib/bigquery/queries/trends";
import Card from "@/components/ui/Card";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import { formatIndianCurrency, formatPercent, formatYoyLine } from "@/lib/format/currency";
import { CATEGORY_COLOR, CATEGORY_ORDER } from "@/lib/design/tokens";
import { FISCAL_MONTH_ORDER, MONTH_ABBR } from "@/lib/charts/pivotByFiscalMonth";

function CategorySplitRow({ caption, items }: { caption?: string; items: { label: string; value: string }[] }) {
  return (
    <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
      {caption && <p className="mb-1.5 text-center text-[10px] text-zinc-400 dark:text-zinc-500">{caption}</p>}
      <div className="grid grid-cols-3 gap-2 text-center">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{it.label}</p>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroFigure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="py-3 text-center">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>}
    </div>
  );
}

// Three consecutive calendar months, side by side, each carrying its own exact
// month name and a one-line explainer — so "what period is this?" and "is this
// final or still moving?" are never ambiguous.
function PaceComparison({ pace }: { pace: OccupancyPace }) {
  const blocks = [
    { tag: "Last month", period: pace.lastMonthLabel, value: pace.lastMonth, note: "Finished, final" },
    { tag: "This month", period: pace.presentMonthLabel, value: pace.presentMonth, note: "Booked so far — will rise" },
    { tag: "Next month", period: pace.nextMonthLabel, value: pace.nextMonth, note: "Early pace — will rise" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
      {blocks.map((b) => (
        <div key={b.tag} className="rounded-md bg-zinc-50 p-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{b.tag}</p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{b.period}</p>
          <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {b.value !== null ? formatPercent(b.value, 0) : "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{b.note}</p>
        </div>
      ))}
    </div>
  );
}

export default function RevenueContent({
  overview,
  adrByProperty,
  occupancyPace,
  monthlyForFy,
  fy,
  lastMonthCategoryBreakdown,
}: {
  overview: OverviewKpis;
  adrByProperty: PropertyAdr[];
  occupancyPace: OccupancyPace;
  monthlyForFy: MonthlyTrendPoint[];
  fy: string;
  lastMonthCategoryBreakdown: LastMonthCategorySnapshot;
}) {
  const categoriesPresent = CATEGORY_ORDER.filter((c) => overview.bySource.some((s) => s.category === c));

  // Revenue split header shows LAST MONTH specifically (a recent-pulse read),
  // deliberately a different period than the FY/filter-scoped hero number
  // below it — the caption always names the exact month so the two numbers
  // are never mistaken for the same period.
  const lastMonthCategoriesPresent = CATEGORY_ORDER.filter((c) => lastMonthCategoryBreakdown.items.some((s) => s.category === c));
  const revenueSplit = lastMonthCategoriesPresent.map((c) => {
    const s = lastMonthCategoryBreakdown.items.find((x) => x.category === c)!;
    const pct = lastMonthCategoryBreakdown.totalRevenue > 0 ? (s.revenue / lastMonthCategoryBreakdown.totalRevenue) * 100 : 0;
    return { label: c, value: `${formatIndianCurrency(s.revenue)} | ${pct.toFixed(0)}%` };
  });

  const adrSplit = categoriesPresent.map((c) => {
    const s = overview.bySource.find((x) => x.category === c)!;
    const adr = s.nights > 0 ? s.revenue / s.nights : null;
    return { label: c, value: adr !== null ? `₹${Math.round(adr).toLocaleString("en-IN")}` : "—" };
  });

  const occupancySplit = categoriesPresent.map((c) => {
    const s = overview.bySource.find((x) => x.category === c)!;
    const pct = overview.availableRoomNights > 0 ? (s.nights / overview.availableRoomNights) * 100 : 0;
    return { label: c, value: `${pct.toFixed(0)}%` };
  });

  const revenueByMonth: BarDatum[] = FISCAL_MONTH_ORDER.map((m) => ({
    name: MONTH_ABBR[m],
    value: monthlyForFy.find((p) => p.month === m)?.revenue ?? 0,
    color: "var(--series-1)",
  }));

  const adrByPropertyData: BarDatum[] = adrByProperty.map((r) => ({
    name: r.property,
    value: r.adr ?? 0,
    color: "var(--series-4)",
  }));

  const occupancyByMonth: BarDatum[] = FISCAL_MONTH_ORDER.map((m) => ({
    name: MONTH_ABBR[m],
    value: (monthlyForFy.find((p) => p.month === m)?.occupancyPct ?? 0) * 100,
    color: "var(--series-7)",
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Revenue Details</h2>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CategorySplitRow caption={`Last month · ${lastMonthCategoryBreakdown.label}`} items={revenueSplit} />
          <HeroFigure
            label="Room Revenue"
            value={formatIndianCurrency(overview.roomRevenue)}
            sub={`${fy} · ${formatYoyLine(overview.yoy.currentRevenue, overview.yoy.priorRevenue, overview.yoy.pctChange, overview.yoy.priorFY, formatIndianCurrency)}`}
          />
          <SingleMetricBarChart data={revenueByMonth} valueFormatter={(v) => formatIndianCurrency(v)} height={180} />
        </Card>

        <Card>
          <CategorySplitRow items={adrSplit} />
          <HeroFigure
            label="ADR"
            value={overview.adr !== null ? `₹${Math.round(overview.adr).toLocaleString("en-IN")}` : "—"}
            sub={formatYoyLine(overview.yoy.adr.current, overview.yoy.adr.prior, overview.yoy.adr.pctChange, overview.yoy.priorFY, (v) => `₹${Math.round(v).toLocaleString("en-IN")}`)}
          />
          <SingleMetricBarChart data={adrByPropertyData} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} height={180} />
        </Card>

        <Card>
          <PaceComparison pace={occupancyPace} />
          <CategorySplitRow items={occupancySplit} />
          <HeroFigure
            label="Occupancy %"
            value={overview.occupancyPct !== null ? formatPercent(overview.occupancyPct, 0) : "—"}
            sub={formatYoyLine(overview.yoy.occupancyPct.current, overview.yoy.occupancyPct.prior, overview.yoy.occupancyPct.pctChange, overview.yoy.priorFY, (v) => formatPercent(v, 0))}
          />
          <SingleMetricBarChart data={occupancyByMonth} valueFormatter={(v) => `${v.toFixed(0)}%`} height={180} />
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">RevPAR</p>
          <p className="mt-1.5 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{overview.revPar !== null ? `₹${Math.round(overview.revPar).toLocaleString("en-IN")}` : "—"}</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{formatYoyLine(overview.yoy.revPar.current, overview.yoy.revPar.prior, overview.yoy.revPar.pctChange, overview.yoy.priorFY, (v) => `₹${Math.round(v).toLocaleString("en-IN")}`)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sold / Available room nights</p>
          <p className="mt-1.5 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {overview.soldRoomNights.toLocaleString("en-IN")} / {overview.availableRoomNights.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Unsold room nights</p>
          <p className="mt-1.5 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {Math.max(0, overview.availableRoomNights - overview.soldRoomNights).toLocaleString("en-IN")}
          </p>
        </div>
      </div>
    </div>
  );
}
