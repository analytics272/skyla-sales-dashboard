// PRD §6.8 — Reviews & Ratings. Uses each table's own Date/DATE column (both
// confirmed to already agree with the sheet's own FY_year label under the
// standard Apr-Mar rule — unlike b2b_bills, no override needed here).
//
// Property scoping deliberately does NOT default to ACTIVE_PROPERTY_CODES: §2.6
// requires FO (the café outlet, not a hotel property) included in review KPIs,
// and rating_sheet/ota both carry historical LP rows too. Leaving `properties`
// undefined means "no property filter" (everything, FO included) rather than
// "all active hotel properties" — only an explicit property selection narrows it.
//
// 2026-09-02: rewritten for the Today/This FY/Last Year period-tabs model.
import { runQuery, table } from "../client";
import { DateRange } from "@/lib/reference/financialYear";
import { PeriodFilter, resolvePeriodFromFilter } from "@/lib/reference/period";
import { safeDivide } from "@/lib/format/currency";
import { ComparisonMetric } from "./overview";

export interface ReviewsFilter extends PeriodFilter {
  properties?: string[];
}

function comparisonMetric(current: number | null, previous: number | null): ComparisonMetric {
  return { current, previous, pctChange: current !== null && previous !== null ? safeDivide(current - previous, previous) : null };
}

function scopeClause(range: DateRange, dateExprAsDate: string, properties: string[] | undefined, propertyCol = "Property"): { clause: string; params: Record<string, unknown> } {
  const conditions: string[] = [`${dateExprAsDate} BETWEEN @start AND @end`];
  const params: Record<string, unknown> = { start: range.start, end: range.end };
  if (properties && properties.length > 0) {
    params.properties = properties;
    conditions.push(`${propertyCol} IN UNNEST(@properties)`);
  }
  return { clause: conditions.join(" AND "), params };
}

export interface ReviewStats {
  avgRating: number | null;
  totalReviews: number;
  comparison: {
    totalReviews: ComparisonMetric;
    avgRating: ComparisonMetric;
  };
}

async function ratingStats(tableName: string, ratingExpr: string, dateExprAsDate: string, filter: ReviewsFilter): Promise<ReviewStats> {
  const period = resolvePeriodFromFilter(filter);
  const { clause, params } = scopeClause(period.current, dateExprAsDate, filter.properties);

  // Comparisons are opt-in — skip the previous-period query entirely unless compareYoY is on.
  const [rows, prevRows] = await Promise.all([
    runQuery<{ avg_rating: number | null; total: number }>(`SELECT AVG(${ratingExpr}) AS avg_rating, COUNT(*) AS total FROM ${table(tableName)} WHERE ${clause}`, params),
    filter.compareYoY
      ? (() => {
          const { clause: prevClause, params: prevParams } = scopeClause(period.previous, dateExprAsDate, filter.properties);
          return runQuery<{ avg_rating: number | null; total: number }>(`SELECT AVG(${ratingExpr}) AS avg_rating, COUNT(*) AS total FROM ${table(tableName)} WHERE ${prevClause}`, prevParams);
        })()
      : Promise.resolve(null),
  ]);

  const avgRating = rows[0]?.avg_rating ?? null;
  const totalReviews = rows[0]?.total ?? 0;
  return {
    avgRating,
    totalReviews,
    comparison: {
      totalReviews: comparisonMetric(totalReviews, prevRows ? prevRows[0]?.total ?? 0 : null),
      avgRating: comparisonMetric(avgRating, prevRows ? prevRows[0]?.avg_rating ?? null : null),
    },
  };
}

export async function getGoogleReviewStats(filter: ReviewsFilter): Promise<ReviewStats> {
  return ratingStats("rating_sheet", "Rating", "CAST(Date AS DATE)", filter);
}

export async function getOtaReviewStats(filter: ReviewsFilter): Promise<ReviewStats> {
  return ratingStats("ota", "SAFE_CAST(Rating AS FLOAT64)", "CAST(DATE AS DATE)", filter);
}

export interface RatingTrendPoint {
  monthStartDate: string;
  monthLabel: string;
  count: number;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabelOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// Scoped to the active period's current range only — §6.8 says "monthly
// x-axis", not a multi-year comparison. (Reviews history predates the
// booking system by a decade — an unscoped trend would produce a 15-series
// chart spanning 2013-2027.)
async function ratingTrend(tableName: string, dateExprAsDate: string, filter: ReviewsFilter): Promise<RatingTrendPoint[]> {
  const period = resolvePeriodFromFilter(filter);
  const { clause, params } = scopeClause(period.current, dateExprAsDate, filter.properties);
  const rows = await runQuery<{ month_start: string; count: number }>(`
    SELECT CAST(DATE_TRUNC(${dateExprAsDate}, MONTH) AS STRING) AS month_start, COUNT(*) AS count
    FROM ${table(tableName)}
    WHERE ${clause}
    GROUP BY month_start
    ORDER BY month_start
  `, params);
  return rows.map((r) => ({ monthStartDate: r.month_start, monthLabel: monthLabelOf(r.month_start), count: r.count }));
}

export async function getGoogleRatingTrend(filter: ReviewsFilter): Promise<RatingTrendPoint[]> {
  return ratingTrend("rating_sheet", "CAST(Date AS DATE)", filter);
}

export async function getOtaRatingTrend(filter: ReviewsFilter): Promise<RatingTrendPoint[]> {
  return ratingTrend("ota", "CAST(DATE AS DATE)", filter);
}
