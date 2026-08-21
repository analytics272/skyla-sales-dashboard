// PRD §6.8 — Reviews & Ratings. Uses each table's own Date/DATE column (both
// confirmed to already agree with the sheet's own FY_year label under the
// standard Apr-Mar rule — unlike b2b_bills, no override needed here).
//
// Property scoping deliberately does NOT default to ACTIVE_PROPERTY_CODES: §2.6
// requires FO (the café outlet, not a hotel property) included in review KPIs,
// and rating_sheet/ota both carry historical LP rows too. Leaving `properties`
// undefined means "no property filter" (everything, FO included) rather than
// "all active hotel properties" — only an explicit property selection narrows it.
import { runQuery, table } from "../client";
import { fyLabelSqlExpr, DateFilter, resolveSelectedFYs, resolveSelectedMonths } from "@/lib/reference/financialYear";

export interface ReviewsFilter extends DateFilter {
  properties?: string[];
}

// FY-equality + EXTRACT(MONTH...) IN UNNEST(...), not a BETWEEN range — a
// non-contiguous month selection (e.g. Apr + Dec) isn't a single span.
function scopeClause(
  filter: ReviewsFilter,
  dateExprAsDate: string,
  propertyCol = "Property"
): { clause: string; params: Record<string, unknown> } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  const fys = resolveSelectedFYs(filter);
  params.fys = fys;
  conditions.push(`${fyLabelSqlExpr(dateExprAsDate)} IN UNNEST(@fys)`);
  const months = resolveSelectedMonths(filter);
  if (months.length > 0) {
    params.months = months;
    conditions.push(`EXTRACT(MONTH FROM ${dateExprAsDate}) IN UNNEST(@months)`);
  }
  if (filter.properties && filter.properties.length > 0) {
    params.properties = filter.properties;
    conditions.push(`${propertyCol} IN UNNEST(@properties)`);
  }

  return { clause: conditions.length > 0 ? conditions.join(" AND ") : "TRUE", params };
}

export interface ReviewStats {
  avgRating: number | null;
  totalReviews: number;
}

export async function getGoogleReviewStats(filter: ReviewsFilter): Promise<ReviewStats> {
  const { clause, params } = scopeClause(filter, "CAST(Date AS DATE)");
  const rows = await runQuery<{ avg_rating: number | null; total: number }>(`
    SELECT AVG(Rating) AS avg_rating, COUNT(*) AS total
    FROM ${table("rating_sheet")}
    WHERE ${clause}
  `, params);
  return { avgRating: rows[0]?.avg_rating ?? null, totalReviews: rows[0]?.total ?? 0 };
}

export interface RatingTrendPoint {
  fy: string;
  monthNumber: number; // calendar month, 1-12
  monthName: string;
  count: number;
}

// Scoped by the full filter (including FY), same as every other section on
// this tab — §6.8 says "monthly x-axis" only, not "one series per FY" the way
// §6.3's trends explicitly are, so this is one FY's 12 months, not a multi-year
// comparison. (Reviews history predates the booking system by a decade —
// leaving FY unscoped here produced a 15-series chart spanning 2013-2027.)
export async function getGoogleRatingTrend(filter: ReviewsFilter): Promise<RatingTrendPoint[]> {
  const { clause, params } = scopeClause(filter, "CAST(Date AS DATE)");
  const rows = await runQuery<{ fy: string; month_number: number; month_name: string; count: number }>(`
    SELECT
      ${fyLabelSqlExpr("CAST(Date AS DATE)")} AS fy,
      EXTRACT(MONTH FROM CAST(Date AS DATE)) AS month_number,
      FORMAT_DATE('%B', CAST(Date AS DATE)) AS month_name,
      COUNT(*) AS count
    FROM ${table("rating_sheet")}
    WHERE ${clause}
    GROUP BY fy, month_number, month_name
    ORDER BY fy, month_number
  `, params);
  return rows.map((r) => ({ fy: r.fy, monthNumber: r.month_number, monthName: r.month_name, count: r.count }));
}

export async function getOtaReviewStats(filter: ReviewsFilter): Promise<ReviewStats> {
  const { clause, params } = scopeClause(filter, "CAST(DATE AS DATE)");
  const rows = await runQuery<{ avg_rating: number | null; total: number }>(`
    SELECT AVG(SAFE_CAST(Rating AS FLOAT64)) AS avg_rating, COUNT(*) AS total
    FROM ${table("ota")}
    WHERE ${clause}
  `, params);
  return { avgRating: rows[0]?.avg_rating ?? null, totalReviews: rows[0]?.total ?? 0 };
}

export async function getOtaRatingTrend(filter: ReviewsFilter): Promise<RatingTrendPoint[]> {
  const { clause, params } = scopeClause(filter, "CAST(DATE AS DATE)");
  const rows = await runQuery<{ fy: string; month_number: number; month_name: string; count: number }>(`
    SELECT
      ${fyLabelSqlExpr("CAST(DATE AS DATE)")} AS fy,
      EXTRACT(MONTH FROM CAST(DATE AS DATE)) AS month_number,
      FORMAT_DATE('%B', CAST(DATE AS DATE)) AS month_name,
      COUNT(*) AS count
    FROM ${table("ota")}
    WHERE ${clause}
    GROUP BY fy, month_number, month_name
    ORDER BY fy, month_number
  `, params);
  return rows.map((r) => ({ fy: r.fy, monthNumber: r.month_number, monthName: r.month_name, count: r.count }));
}
