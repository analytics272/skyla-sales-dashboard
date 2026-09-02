"use client";

// 2026-09-02 redesign, fifth pass — Overview merges what used to be three
// separate pages (Revenue Details, Trends, Brand). Rationale for what moved
// where:
//   - All four "metric over time" line charts (Revenue, Occupancy, RevPAR,
//     ADR) are one TabbedCard now instead of four/six separate cards spread
//     across two pages — same underlying monthlyTrends fetch, just a
//     different pick() per tab (item #11: internal tabs over more cards).
//   - The category revenue-mix donut existed THREE times across the old
//     Revenue/Trends/Brand pages (overview.bySource, and two separate
//     getBusinessCategoryAdr() calls from Trends and Brand) even though
//     they're all the same B2B/B2C/OTA split for the same period/property
//     scope. overview.bySource alone (revenue + nights per category) is
//     enough to derive both the revenue donut AND the ADR-by-category bar
//     (adr = revenue / nights), so getBusinessCategoryAdr is dropped
//     entirely for this page.
//   - ADR By Property (Revenue) and Occupancy By Brand (Brand) are the two
//     genuinely distinct "rank by property/brand" bars — grouped into one
//     tabbed card rather than left as two standalone ones.
import { OverviewKpis, PropertyAdr, OccupancyPace } from "@/lib/bigquery/queries/overview";
import { TrendSeries } from "@/lib/bigquery/queries/trends";
import { BrandOccupancy } from "@/lib/bigquery/queries/brandCategory";
import Card from "@/components/ui/Card";
import StatTile from "@/components/ui/StatTile";
import TabbedCard, { useTabbedCard } from "@/components/ui/TabbedCard";
import SingleMetricBarChart, { BarDatum } from "@/components/charts/SingleMetricBarChart";
import MultiSeriesLineChart from "@/components/charts/MultiSeriesLineChart";
import DonutChart from "@/components/charts/DonutChart";
import ProgressBar from "@/components/ui/ProgressBar";
import { formatIndianCurrency, formatPercent, safeDivide } from "@/lib/format/currency";
import { CATEGORY_COLOR, CATEGORY_ORDER, BRAND_COLOR, BRAND_ORDER } from "@/lib/design/tokens";

// Three consecutive calendar months, side by side, each carrying its own exact
// month name and a one-line explainer — so "what period is this?" and "is this
// final or still moving?" are never ambiguous. Real-time, independent of the
// active period tab (same convention as the reference dashboard's own pace read).
function PaceComparison({ pace }: { pace: OccupancyPace }) {
  const blocks = [
    { tag: "Last Month", period: pace.lastMonthLabel, value: pace.lastMonth, note: "Finished, final" },
    { tag: "This Month", period: pace.presentMonthLabel, value: pace.presentMonth, note: "Booked so far — will rise" },
    { tag: "Next Month", period: pace.nextMonthLabel, value: pace.nextMonth, note: "Early pace — will rise" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {blocks.map((b) => (
        <div key={b.tag} className="rounded-md bg-zinc-50 p-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{b.tag}</p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{b.period}</p>
          <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {b.value !== null ? formatPercent(b.value, 0) : "—"}
          </p>
          {/* Item #9/#10: a fixed-color bar, not the green/amber/red target-vs-
              achieved read — a low % on a still-forming future month is normal
              pace, not a shortfall, so it shouldn't paint red. */}
          {b.value !== null && (
            <div className="mt-1.5 px-1">
              <ProgressBar pct={b.value} color="var(--series-1)" height={5} />
            </div>
          )}
          <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">{b.note}</p>
        </div>
      ))}
    </div>
  );
}

function mergeSeries(
  current: TrendSeries["current"],
  previous: TrendSeries["previous"],
  pick: (p: TrendSeries["current"][number]) => number | null,
  currentKey: string,
  previousKey: string
) {
  const len = Math.max(current.length, previous.length);
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < len; i++) {
    const c = current[i];
    const p = previous[i];
    rows.push({ label: c?.monthLabel ?? p?.monthLabel ?? `#${i + 1}`, [currentKey]: c ? pick(c) : null, [previousKey]: p ? pick(p) : null });
  }
  return rows;
}

type TrendTab = "Revenue" | "Occupancy" | "RevPAR" | "ADR";
const TREND_TABS: TrendTab[] = ["Revenue", "Occupancy", "RevPAR", "ADR"];

type MixTab = "Revenue" | "ADR";
const MIX_TABS: MixTab[] = ["Revenue", "ADR"];

type RankTab = "By Property" | "By Brand";
const RANK_TABS: RankTab[] = ["By Property", "By Brand"];

export default function OverviewContent({
  overview,
  adrByProperty,
  occupancyPace,
  monthlyTrends,
  brandOccupancy,
  compareYoY,
}: {
  overview: OverviewKpis;
  adrByProperty: PropertyAdr[];
  occupancyPace: OccupancyPace;
  monthlyTrends: TrendSeries;
  brandOccupancy: BrandOccupancy[];
  compareYoY: boolean;
}) {
  const { comparison } = overview;
  const [trendTab, setTrendTab] = useTabbedCard(TREND_TABS);
  const [mixTab, setMixTab] = useTabbedCard(MIX_TABS);
  const [rankTab, setRankTab] = useTabbedCard(RANK_TABS);

  // Comparisons are opt-in: with the toggle off, only the current-period
  // line is drawn (no empty "Preceding period" legend entry for a series
  // that was never queried); toggling on adds the same-period-last-year line.
  const trendSeries = compareYoY
    ? [
        { key: comparison.currentLabel, color: "var(--series-1)" },
        { key: comparison.previousLabel, color: "var(--chart-baseline)" },
      ]
    : [{ key: comparison.currentLabel, color: "var(--series-1)" }];
  const TREND_PICK: Record<TrendTab, { pick: (p: TrendSeries["current"][number]) => number | null; valueFormatter: (v: number) => string; yDomain?: [number, number]; yTicks?: number[] }> = {
    Revenue: { pick: (p) => p.revenue, valueFormatter: (v) => formatIndianCurrency(v) },
    Occupancy: {
      pick: (p) => (p.occupancyPct !== null ? p.occupancyPct * 100 : null),
      valueFormatter: (v) => `${v.toFixed(0)}%`,
      yDomain: [0, 100],
      yTicks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    },
    RevPAR: { pick: (p) => p.revPar, valueFormatter: (v) => `₹${Math.round(v).toLocaleString("en-IN")}` },
    ADR: { pick: (p) => p.adr, valueFormatter: (v) => `₹${Math.round(v).toLocaleString("en-IN")}` },
  };
  const activeTrend = TREND_PICK[trendTab];
  const trendData = mergeSeries(monthlyTrends.current, monthlyTrends.previous, activeTrend.pick, comparison.currentLabel, comparison.previousLabel);

  const categoriesPresent = CATEGORY_ORDER.filter((c) => overview.bySource.some((s) => s.category === c));
  const revenueDonut = categoriesPresent.map((c) => {
    const s = overview.bySource.find((x) => x.category === c)!;
    return { name: c, value: s.revenue, color: CATEGORY_COLOR[c] };
  });
  const categoryAdrBars: BarDatum[] = categoriesPresent.map((c) => {
    const s = overview.bySource.find((x) => x.category === c)!;
    return { name: c, value: safeDivide(s.revenue, s.nights) ?? 0, color: CATEGORY_COLOR[c] };
  });

  const adrByPropertyData: BarDatum[] = adrByProperty.map((r) => ({ name: r.property, value: r.adr ?? 0, color: "var(--series-4)" }));
  const brandData: BarDatum[] = BRAND_ORDER.filter((b) => brandOccupancy.some((r) => r.brand === b)).map((b) => ({
    name: b,
    value: (brandOccupancy.find((r) => r.brand === b)?.occupancyPct ?? 0) * 100,
    color: BRAND_COLOR[b],
  }));

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Room Revenue"
          value={formatIndianCurrency(overview.roomRevenue)}
          delta={comparison.revenue.pctChange !== null ? { pct: comparison.revenue.pctChange * 100, label: `vs ${comparison.previousLabel}` } : undefined}
        />
        <StatTile
          label="ADR"
          value={overview.adr !== null ? `₹${Math.round(overview.adr).toLocaleString("en-IN")}` : "—"}
          delta={comparison.adr.pctChange !== null ? { pct: comparison.adr.pctChange * 100, label: `vs ${comparison.previousLabel}` } : undefined}
        />
        <StatTile
          label="Occupancy %"
          value={overview.occupancyPct !== null ? formatPercent(overview.occupancyPct, 0) : "—"}
          delta={comparison.occupancyPct.pctChange !== null ? { pct: comparison.occupancyPct.pctChange * 100, label: `vs ${comparison.previousLabel}` } : undefined}
          progress={overview.occupancyPct !== null ? { pct: overview.occupancyPct } : undefined}
        />
        <StatTile
          label="RevPAR"
          value={overview.revPar !== null ? `₹${Math.round(overview.revPar).toLocaleString("en-IN")}` : "—"}
          delta={comparison.revPar.pctChange !== null ? { pct: comparison.revPar.pctChange * 100, label: `vs ${comparison.previousLabel}` } : undefined}
        />
      </div>

      <TabbedCard
        title="Trends"
        subtitle={compareYoY ? `${comparison.currentLabel} vs ${comparison.previousLabel}` : comparison.currentLabel}
        tabs={TREND_TABS}
        active={trendTab}
        onChange={setTrendTab}
      >
        <MultiSeriesLineChart
          data={trendData}
          xKey="label"
          series={trendSeries}
          valueFormatter={activeTrend.valueFormatter}
          yDomain={activeTrend.yDomain}
          yTicks={activeTrend.yTicks}
          height={260}
        />
      </TabbedCard>

      {/* Item #9/#11: paired side by side instead of full-width stacked —
          each was a single small chart in a card with a lot of unused
          horizontal space on its own row. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <TabbedCard title="Business Category Mix" tabs={MIX_TABS} active={mixTab} onChange={setMixTab}>
          {mixTab === "Revenue" ? (
            <DonutChart data={revenueDonut} valueFormatter={(v) => formatIndianCurrency(v)} />
          ) : (
            <SingleMetricBarChart data={categoryAdrBars} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
          )}
        </TabbedCard>

        <TabbedCard title="ADR & Occupancy Ranking" tabs={RANK_TABS} active={rankTab} onChange={setRankTab}>
          {rankTab === "By Property" ? (
            <SingleMetricBarChart data={adrByPropertyData} valueFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} height={240} />
          ) : (
            <SingleMetricBarChart data={brandData} valueFormatter={(v) => `${v.toFixed(0)}%`} height={240} />
          )}
        </TabbedCard>
      </div>

      <Card title="Booking Pace" subtitle="Occupancy booked so far for each month — real-time, independent of the filters above">
        <PaceComparison pace={occupancyPace} />
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label="Sold Room Nights"
          value={overview.soldRoomNights.toLocaleString("en-IN")}
          delta={comparison.soldRoomNights.pctChange !== null ? { pct: comparison.soldRoomNights.pctChange * 100, label: `vs ${comparison.previousLabel}` } : undefined}
        />
        <StatTile label="Available Room Nights" value={overview.availableRoomNights.toLocaleString("en-IN")} />
        <StatTile
          label="Unsold Room Nights"
          value={Math.max(0, overview.availableRoomNights - overview.soldRoomNights).toLocaleString("en-IN")}
        />
      </div>
    </div>
  );
}
