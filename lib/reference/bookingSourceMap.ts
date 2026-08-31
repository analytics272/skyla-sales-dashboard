// PRD §3.1 / Reference Data §3 — ported verbatim from Mapping.gs's BOOKING_SOURCE_MAP
// and classifyBookingSource_() (108-source exact match, case-insensitive, then
// OTA/B2B pattern fallback, else B2C). Applies to sales_booking.Source,
// sales_booking_cancelled.Source, and lead_tracker.Source.

export type BookingCategory = "B2B" | "B2C" | "OTA";

export const BOOKING_SOURCE_MAP: Record<string, BookingCategory> = {
  "Relocation (B2B)": "B2B",
  "Tele Sales": "B2C",
  "Corporate Sales": "B2B",
  Goibibo: "OTA",
  "go-mmt": "OTA",
  Travelguru: "OTA",
  "Booking.com": "OTA",
  Cleartrip: "OTA",
  Agoda: "OTA",
  "Internet Booking Engine": "B2C",
  Expedia: "OTA",
  "Relocation (B2C)": "B2C",
  BPO7381: "B2B",
  "PO No: 3300035297": "B2B",
  makemytrip: "OTA",
  "Walk-in": "B2C",
  Existing: "B2C",
  Airbnb: "OTA",
  BPO2077: "B2B",
  BPO2056: "B2B",
  "AGR-10000836803": "B2B",
  "AGR-10000836806": "B2B",
  "AGR-10000836809": "B2B",
  "AGR-10000836811": "B2B",
  BPO2076: "B2B",
  BPO2075: "B2B",
  BPO2073: "B2B",
  BPO2072: "B2B",
  BPO2071: "B2B",
  BPO2069: "B2B",
  BPO2068: "B2B",
  BPO2066: "B2B",
  "N/A": "B2B",
  BPO2064: "B2B",
  BPO2061: "B2B",
  BPO2059: "B2B",
  "BPO43325-V2": "B2B",
  BPO2057: "B2B",
  "BPO43325-V53": "B2B",
  "BPO43325-V51": "B2B",
  "BPO43325-V50": "B2B",
  "BPO43325-V48": "B2B",
  "BPO43325-V47": "B2B",
  HyperGuest: "OTA",
  "BPO43325-V45": "B2B",
  "BPO43325-V44": "B2B",
  "BPO43325-V42": "B2B",
  "BPO43325-V40": "B2B",
  "BPO43325-V39": "B2B",
  "BPO43325-V38": "B2B",
  "BPO43325-V37": "B2B",
  "BPO43325-V35": "B2B",
  "BPO43325-V34": "B2B",
  "BPO43325-V32": "B2B",
  "BPO43325-V30": "B2B",
  "BPO43325-V29": "B2B",
  "BPO43325-V28": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2022": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2047": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2046": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2045": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2044": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2042": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2040": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2037": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2035": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2032": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2029": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2026": "B2B",
  "LUT-AD360321010417M Date of filing 22/03/2021": "B2B",
  "LUT-AD3604220046669 Date of Filling 12/04/2024": "B2B",
  "BPO43325-V26": "B2B",
  "LUT-AD360321010417M Date of filing 22/03/2037": "B2B",
  "LUT-AD360321010417M Date of filing 22/03/2035": "B2B",
  "BPO43325-V24": "B2B",
  "LUT-AD360321010417M Date of filing 22/03/2032": "B2B",
  "BPO43325-V22": "B2B",
  "BPO43325-V20": "B2B",
  "LUT-AD360321010417M Date of filing 22/03/2030": "B2B",
  "LUT-AD360321010417M Date of filing 22/03/2027": "B2B",
  "BPO43325-V18": "B2B",
  "LUT-AD360321010417M Date of filing 22/03/2025": "B2B",
  "BPO43325-V16": "B2B",
  "BPO43325-V13": "B2B",
  "LUT-AD360321010417M Date of filing 22/03/2023": "B2B",
  "BPO43325-V11": "B2B",
  "BPO43325-V9": "B2B",
  "BPO43325-V7": "B2B",
  "BPO43325-V4": "B2B",
  BPO7382: "B2B",
  BPO7383: "B2B",
  BPO7384: "B2B",
  BPO7385: "B2B",
  BPO7386: "B2B",
  BPO7387: "B2B",
  BPO7388: "B2B",
  BPO7389: "B2B",
  BPO7390: "B2B",
  OTA: "OTA",
  BPO10092: "B2B",
  Website: "B2C",
  "KG Reddy": "B2B",
  "Agoda B2B": "OTA",
  "Clear trip": "OTA",
  EaseMyTrip: "OTA",
  "NPO-00586": "B2B",
  BPO4993: "B2B",
  Travex: "OTA",
};

const BOOKING_SOURCE_MAP_LOWER: Record<string, BookingCategory> = Object.fromEntries(
  Object.entries(BOOKING_SOURCE_MAP).map(([k, v]) => [k.toLowerCase(), v])
);

const OTA_PATTERNS: RegExp[] = [
  /booking\.com/i,
  /agoda/i,
  /expedia/i,
  /airbnb/i,
  /makemytrip/i,
  /go-?mmt/i,
  /goibibo/i,
  /cleartrip/i,
  /travelguru/i,
  /hyperguest/i,
  /easemytrip/i,
  /travex/i,
  /\bota\b/i,
];

const B2B_PATTERNS: RegExp[] = [
  /^BPO/i,
  /^LUT-/i,
  /^AGR-/i,
  /^PO No/i,
  /^NPO-/i,
  /corporate/i,
  /relocation \(b2b\)/i,
];

export interface ClassifiedSource {
  category: BookingCategory;
  isUnmapped: boolean;
}

export function classifyBookingSource(rawSource: string | null | undefined): ClassifiedSource {
  if (!rawSource) return { category: "B2C", isUnmapped: true };
  const source = String(rawSource).trim();
  const sourceLower = source.toLowerCase();

  if (sourceLower in BOOKING_SOURCE_MAP_LOWER) {
    return { category: BOOKING_SOURCE_MAP_LOWER[sourceLower], isUnmapped: false };
  }
  if (OTA_PATTERNS.some((p) => p.test(source))) return { category: "OTA", isUnmapped: true };
  if (B2B_PATTERNS.some((p) => p.test(source))) return { category: "B2B", isUnmapped: true };
  return { category: "B2C", isUnmapped: true };
}

function sqlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// Fallback pattern regexes translated to BigQuery REGEXP_CONTAINS (case-insensitive via (?i)).
const OTA_PATTERNS_SQL = [
  String.raw`(?i)booking\.com`,
  String.raw`(?i)agoda`,
  String.raw`(?i)expedia`,
  String.raw`(?i)airbnb`,
  String.raw`(?i)makemytrip`,
  String.raw`(?i)go-?mmt`,
  String.raw`(?i)goibibo`,
  String.raw`(?i)cleartrip`,
  String.raw`(?i)travelguru`,
  String.raw`(?i)hyperguest`,
  String.raw`(?i)easemytrip`,
  String.raw`(?i)travex`,
  String.raw`(?i)\bota\b`,
];
const B2B_PATTERNS_SQL = [
  String.raw`(?i)^BPO`,
  String.raw`(?i)^LUT-`,
  String.raw`(?i)^AGR-`,
  String.raw`(?i)^PO No`,
  String.raw`(?i)^NPO-`,
  String.raw`(?i)corporate`,
  String.raw`(?i)relocation \(b2b\)`,
];

/** Builds a BigQuery CASE expression classifying `sourceCol` into B2B/B2C/OTA/Website (§3.1). */
export function bookingCategorySqlExpr(sourceCol: string): string {
  const exactWhens = Object.entries(BOOKING_SOURCE_MAP)
    .map(([key, cat]) => `WHEN '${sqlEscape(key.toLowerCase())}' THEN '${cat}'`)
    .join("\n    ");

  const otaFallback = OTA_PATTERNS_SQL.map(
    (p) => `REGEXP_CONTAINS(${sourceCol}, r'${p}')`
  ).join(" OR ");
  const b2bFallback = B2B_PATTERNS_SQL.map(
    (p) => `REGEXP_CONTAINS(${sourceCol}, r'${p}')`
  ).join(" OR ");

  return `CASE LOWER(TRIM(COALESCE(${sourceCol}, '')))
    ${exactWhens}
    ELSE (
      CASE
        WHEN ${sourceCol} IS NULL THEN 'B2C'
        WHEN ${otaFallback} THEN 'OTA'
        WHEN ${b2bFallback} THEN 'B2B'
        ELSE 'B2C'
      END
    )
  END`;
}

/**
 * Canonical display name for a source: folds case variants (e.g. real data has
 * both "Go-MMT" and "go-mmt") to the map's own casing so OTA breakdown tables
 * don't show the same OTA as two rows. Falls back to the trimmed raw text for
 * anything not in the exact map (already-correct commission math is unaffected
 * either way — this is a display-only grouping key).
 */
export function canonicalSourceNameSqlExpr(sourceCol: string): string {
  const whens = Object.keys(BOOKING_SOURCE_MAP)
    .map((key) => `WHEN '${sqlEscape(key.toLowerCase())}' THEN '${sqlEscape(key)}'`)
    .join("\n    ");
  return `CASE LOWER(TRIM(COALESCE(${sourceCol}, '')))
    ${whens}
    ELSE TRIM(${sourceCol})
  END`;
}

/** Boolean SQL expression: true when `sourceCol` fell through to the pattern/default fallback (§3.1 isUnmapped triage flag). */
export function bookingIsUnmappedSqlExpr(sourceCol: string): string {
  const exactKeysLower = Object.keys(BOOKING_SOURCE_MAP).map((k) => `'${sqlEscape(k.toLowerCase())}'`);
  return `LOWER(TRIM(COALESCE(${sourceCol}, ''))) NOT IN (${exactKeysLower.join(", ")})`;
}

/**
 * OTA Breakdown tab display grouping (user direction, 2026-08-27): EaseMyTrip,
 * MakeMyTrip, and go-mmt are shown as one combined "GoMMT" row, rather than
 * three separate rows. This is a display/grouping decision for that one tab
 * only — it doesn't change §3.1's B2B/B2C/OTA category (all three are already
 * OTA) or §otaCommission.ts's per-row commission rate (each already carries
 * the same 20% rate, so the row's blended commission % comes out unchanged
 * whether shown as one row or three — commissionRateSqlExpr still keys off
 * the raw, ungrouped Source value on each row before this grouping applies).
 */
const OTA_DISPLAY_GROUPS: Record<string, string> = {
  easemytrip: "GoMMT",
  makemytrip: "GoMMT",
  "go-mmt": "GoMMT",
};

/** Wraps `canonicalSourceNameSqlExpr` with the OTA Breakdown-specific grouping above. Use this (not the bare canonical name) for OTA Breakdown's per-OTA GROUP BY. */
export function otaBreakdownDisplayNameSqlExpr(sourceCol: string): string {
  const groupWhens = Object.entries(OTA_DISPLAY_GROUPS)
    .map(([key, group]) => `WHEN '${sqlEscape(key)}' THEN '${sqlEscape(group)}'`)
    .join("\n    ");
  return `CASE LOWER(TRIM(COALESCE(${sourceCol}, '')))
    ${groupWhens}
    ELSE (${canonicalSourceNameSqlExpr(sourceCol)})
  END`;
}
