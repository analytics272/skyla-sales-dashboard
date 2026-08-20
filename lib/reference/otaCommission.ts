// PRD §3.2 / Reference Data §2 — OTA commission rates for Net Revenue / After-
// Commission ADR (§6.7). Editable config, not baked into query logic, so gaps
// can be filled later without touching KPI queries.
//
// User-confirmed updates (2026-08-19), superseding the PRD's original blanks:
//   - Booking.com / BH4: 15% (was blank/0%)
//   - Travex: 20%, flat across all properties (was blank/0%)
//   - LP: not in this table — property permanently removed (§3.3), no commission logic needed
// Still intentionally blank/0% (unresolved, per PRD §7 caveat 1): generic "OTA" label.

export interface OtaCommissionRule {
  /** OTA name as classified by §3.1 category mapping (matches sales_booking.Source, trimmed). */
  otaName: string;
  /** If set, rate applies only to this property; otherwise applies to all properties. */
  property?: string;
  ratePercent: number; // e.g. 20 = 20%
}

export const OTA_COMMISSION_RULES: OtaCommissionRule[] = [
  { otaName: "Goibibo", ratePercent: 20 },
  { otaName: "go-mmt", ratePercent: 20 },
  { otaName: "Travelguru", ratePercent: 20 },
  { otaName: "Cleartrip", ratePercent: 16 },
  { otaName: "Clear trip", ratePercent: 16 }, // spelling variant, §3.2
  { otaName: "Agoda", ratePercent: 17.5 },
  { otaName: "Agoda B2B", ratePercent: 17.5 },
  { otaName: "Expedia", ratePercent: 15 },
  { otaName: "makemytrip", ratePercent: 20 },
  { otaName: "HyperGuest", ratePercent: 16 },
  { otaName: "EaseMyTrip", ratePercent: 20 },
  { otaName: "Airbnb", ratePercent: 0 },
  { otaName: "Travex", ratePercent: 20 }, // user-confirmed 2026-08-19, flat all properties

  { otaName: "Booking.com", property: "KDP", ratePercent: 18 },
  { otaName: "Booking.com", property: "HTC", ratePercent: 18 },
  { otaName: "Booking.com", property: "JHS", ratePercent: 16 },
  { otaName: "Booking.com", property: "GB", ratePercent: 15 },
  { otaName: "Booking.com", property: "BH4", ratePercent: 15 }, // user-confirmed 2026-08-19

  // Generic "OTA" label — intentionally blank/0%, unresolved (PRD §7 caveat 1).
  { otaName: "OTA", ratePercent: 0 },
];

/** Looks up commission % for a given (source, property). Defaults to 0% (blank source, unmapped OTA, etc). */
export function commissionRateFor(sourceName: string, property: string): number {
  const name = sourceName.trim();
  const propertySpecific = OTA_COMMISSION_RULES.find(
    (r) => r.otaName.toLowerCase() === name.toLowerCase() && r.property === property
  );
  if (propertySpecific) return propertySpecific.ratePercent;
  const general = OTA_COMMISSION_RULES.find(
    (r) => r.otaName.toLowerCase() === name.toLowerCase() && !r.property
  );
  return general?.ratePercent ?? 0;
}

function sqlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * BigQuery CASE expression for commission % given trimmed Source and Property columns.
 * Property-specific rules (Booking.com) are checked before the general rules.
 */
export function commissionRateSqlExpr(sourceCol: string, propertyCol: string): string {
  const propertyRules = OTA_COMMISSION_RULES.filter((r) => r.property)
    .map(
      (r) =>
        `WHEN LOWER(TRIM(${sourceCol})) = '${sqlEscape(r.otaName.toLowerCase())}' AND ${propertyCol} = '${r.property}' THEN ${r.ratePercent}`
    )
    .join("\n    ");
  const generalRules = OTA_COMMISSION_RULES.filter((r) => !r.property)
    .map(
      (r) => `WHEN LOWER(TRIM(${sourceCol})) = '${sqlEscape(r.otaName.toLowerCase())}' THEN ${r.ratePercent}`
    )
    .join("\n    ");

  return `CASE
    ${propertyRules}
    ${generalRules}
    ELSE 0
  END`;
}
