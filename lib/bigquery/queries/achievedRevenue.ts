// PMS-sourced "Achieved" revenue for the Performance (Targets) tab.
//
// 2026-10-05: leadership_targets' own Revenue_Achieved / B2B_Achieved /
// B2C_Achieved / OTA_Achieved columns are hand-maintained in a sheet and go
// stale mid-month (live: Oct 26 read 59.45 L while PMS had 1.46 Cr; Sep 26
// read 1.86 Cr vs PMS 2.02 Cr). Per explicit direction, Achieved now comes
// from PMS data everywhere on this tab; leadership_targets remains the source
// of every TARGET only.
//
// Same sourcing as the rest of the dashboard: sales_booking (DailyRevenue by
// StayDate, SALES_BOOKING_STAY_FILTER) + LP's monthly table, with the
// FY24-25/FY25-26 workbook values taking precedence per property-month
// wherever one exists (historicalDashboardOverride.ts — the dashboard-wide
// "use the sheet where it has a value" rule).
import { runQuery, table } from "../client";
import { SALES_BOOKING_STAY_FILTER } from "./filters";
import { ACTIVE_PROPERTY_CODES } from "@/lib/reference/propertyReference";
import { bookingCategorySqlExpr } from "@/lib/reference/bookingSourceMap";
import { getHistoricalOverrideForRange } from "@/lib/reference/historicalDashboardOverride";
import { DateRange } from "@/lib/reference/financialYear";

export interface MonthAchieved {
  monthKey: string; // "YYYY-MM"
  revenue: number;
  b2b: number;
  b2c: number;
  ota: number;
}

interface Bucket { revenue: number; b2b: number; b2c: number; ota: number }
const empty = (): Bucket => ({ revenue: 0, b2b: 0, b2c: 0, ota: 0 });

function monthsTouching(range: DateRange): { monthKey: string; range: DateRange }[] {
  const out: { monthKey: string; range: DateRange }[] = [];
  const end = new Date(`${range.end}T00:00:00`);
  const d = new Date(`${range.start.slice(0, 7)}-01T00:00:00`);
  while (d <= end) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(y, m, 0);
    const lastIso = `${y}-${String(m).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
    out.push({
      monthKey: first.slice(0, 7),
      range: { start: first > range.start ? first : range.start, end: lastIso < range.end ? lastIso : range.end },
    });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** Company-wide (all active properties incl. LP) achieved revenue per calendar month touched by `range`; the first/last month are clipped to `range`. */
export async function getMonthlyAchieved(range: DateRange): Promise<MonthAchieved[]> {
  const properties = ACTIVE_PROPERTY_CODES;
  const [pmsRows, lpRows] = await Promise.all([
    runQuery<{ property: string; ym: string; category: string; revenue: number | null }>(`
      SELECT Property AS property, FORMAT_DATE('%Y-%m', CAST(StayDate AS DATE)) AS ym,
        ${bookingCategorySqlExpr("Source")} AS category, SUM(DailyRevenue) AS revenue
      FROM ${table("sales_booking")}
      WHERE Property IN UNNEST(@properties) AND CAST(StayDate AS DATE) BETWEEN @start AND @end AND ${SALES_BOOKING_STAY_FILTER}
      GROUP BY property, ym, category
    `, { properties, start: range.start, end: range.end }),
    runQuery<{ ym: string; room: number | null; b2b: number | null; b2c: number | null; ota: number | null }>(`
      SELECT FORMAT_DATE('%Y-%m', MonthStartDate) AS ym, SUM(RoomRevenue) AS room,
        SUM(B2BRevenue) AS b2b, SUM(B2CRevenue) AS b2c, SUM(OTARevenue) AS ota
      FROM ${table("sales_booking_lp_monthly")}
      WHERE MonthStartDate BETWEEN @start AND @end
      GROUP BY ym
    `, { start: range.start, end: range.end }),
  ]);

  // live[ym][property] -> Bucket
  const live = new Map<string, Map<string, Bucket>>();
  const slot = (ym: string, p: string) => {
    const byProp = live.get(ym) ?? live.set(ym, new Map()).get(ym)!;
    return byProp.get(p) ?? byProp.set(p, empty()).get(p)!;
  };
  for (const r of pmsRows) {
    const b = slot(r.ym, r.property);
    const v = r.revenue ?? 0;
    b.revenue += v;
    if (r.category === "B2B") b.b2b += v;
    else if (r.category === "B2C") b.b2c += v;
    else if (r.category === "OTA") b.ota += v;
  }
  for (const r of lpRows) {
    const b = slot(r.ym, "LP");
    b.revenue += r.room ?? 0;
    b.b2b += r.b2b ?? 0;
    b.b2c += r.b2c ?? 0;
    b.ota += r.ota ?? 0;
  }

  return monthsTouching(range).map(({ monthKey, range: monthRange }) => {
    const total = empty();
    const byProp = live.get(monthKey) ?? new Map<string, Bucket>();
    for (const p of new Set([...byProp.keys(), ...properties])) {
      const liveB = byProp.get(p) ?? empty();
      // Whole-calendar-month ranges only; a clipped partial month returns {} -> live.
      const ov = getHistoricalOverrideForRange([p], monthRange)[p];
      if (!ov) {
        total.revenue += liveB.revenue; total.b2b += liveB.b2b; total.b2c += liveB.b2c; total.ota += liveB.ota;
      } else if (ov.b2bRevenue !== undefined && ov.b2cRevenue !== undefined) {
        total.revenue += ov.revenue; total.b2b += ov.b2bRevenue; total.b2c += ov.b2cRevenue;
        total.ota += Math.max(0, ov.revenue - ov.b2bRevenue - ov.b2cRevenue);
      } else {
        // FY25-26 workbook has no category split — total from the workbook, categories stay live.
        total.revenue += ov.revenue; total.b2b += liveB.b2b; total.b2c += liveB.b2c; total.ota += liveB.ota;
      }
    }
    return { monthKey, ...total };
  });
}

export function sumAchieved(months: MonthAchieved[]): Bucket {
  return months.reduce((a, m) => ({ revenue: a.revenue + m.revenue, b2b: a.b2b + m.b2b, b2c: a.b2c + m.b2c, ota: a.ota + m.ota }), empty());
}
