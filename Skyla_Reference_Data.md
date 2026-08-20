# Skyla Collective — Dashboard Reference Data

This document plus `Skyla_Sales_Dashboard_PRD.md` together contain everything
needed to build the dashboard — no other files need to be attached. This doc
holds the raw reference material the PRD points to (lookup tables, scripts,
column definitions) rather than restating it, so both can be pasted into
Claude Code as-is.

**Data warehouse:** BigQuery, project `skyla-analytics`, dataset `Skyla_Sales_Automation`.

---

## 1. Property Reference (current, as of this build)

| Property | Brand grouping | Room count | Status |
|---|---|---|---|
| KDP | Skyla | 63 | Active |
| HTC | Skyla | 34 | Active |
| JHS | Skyla | 33 | Active |
| BH4 | Aptly | 18 | Active |
| GB | Hyber | 21 | Active (added mid-2026 — only count Available Room Nights from its go-live date forward) |
| LP | Aptly | 16 | **Permanently removed.** Do not include in current/future property filters or "active properties" lists. Historical `sales_booking`/`sales_booking_cancelled` rows for LP remain in BigQuery and should still count in KPIs for the periods it was active. |

---

## 2. OTA Commission Rates

Used for Net Revenue / After-Commission ADR (PRD §6.7). Applies to the OTA
category as classified by the Booking Source mapping in §3 below.

| OTA | Commission % |
|---|---|
| Goibibo | 20% |
| go-mmt | 20% |
| Travelguru | 20% |
| Cleartrip (and "Clear trip" spelling variant) | 16% |
| Agoda | 17.5% |
| Agoda B2B | 17.5% |
| Expedia | 15% |
| makemytrip | 20% |
| HyperGuest | 16% |
| EaseMyTrip | 20% |
| Airbnb | 0% |
| (blank source) | 0% |
| Booking.com — KDP | 18% |
| Booking.com — HTC | 18% |
| Booking.com — JHS | 16% |
| Booking.com — GB | 15% |
| Booking.com — BH4 | **intentionally blank (0%) — confirmed, not yet supplied** |
| Generic "OTA" label | **intentionally blank (0%) — confirmed, not yet supplied** |
| Travex | **intentionally blank (0%) — confirmed, not yet supplied** |

LP is not in this table — property permanently removed (§1).

Build this as an easily-editable config/reference table, not hardcoded inside
query logic, so the three blank rows can be filled in later without touching
any KPI queries.

---

## 3. Booking Source → Category Mapping (`Mapping.gs`)

Full Google Apps Script source. Port the `BOOKING_SOURCE_MAP` table and
`classifyBookingSource_()` logic exactly (case-insensitive exact match first,
then the OTA/B2B pattern fallback, else B2C) into BigQuery — either a SQL
`CASE` expression, a UDF, or a loaded reference table. Applies to
`sales_booking.Source`, `sales_booking_cancelled.Source`, and
`lead_tracker.Source`.

```javascript
/**
 * Mapping.gs
 * -----------------------------------------------------------------------
 * Booking Source -> Category (B2B / B2C / OTA / Website) classification,
 * plus the fallback rule for sources not yet in this table, and shared
 * date/financial-year helpers.
 *
 * This is the code equivalent of booking_source_category_mapping.csv.
 * Keep the two in sync if you edit one.
 * -----------------------------------------------------------------------
 */

// Exact-match lookup, mirrors booking_source_category_mapping.csv IN FULL
// (all 108 confirmed sources) - previously only a subset was hardcoded here
// and the rest relied on the pattern-matching fallback below. That worked
// functionally (BPO10092 still classified correctly as B2B via the /^BPO/i
// pattern, confirmed against real GB data on 2026-08-14), but meant every
// already-known BPO/LUT/AGR code got flagged as "Unmapped" every run,
// cluttering the signal that flag is meant to provide for genuinely NEW
// sources. Now every confirmed source is an exact match, so is_unmapped_flag
// only fires for sources not yet in booking_source_category_mapping.csv.
const BOOKING_SOURCE_MAP = {
  'Relocation (B2B)': 'B2B',
  'Tele Sales': 'B2C',
  'Corporate Sales': 'B2B',
  'Goibibo': 'OTA',
  'go-mmt': 'OTA',
  'Travelguru': 'OTA',
  'Booking.com': 'OTA',
  'Cleartrip': 'OTA',
  'Agoda': 'OTA',
  'Internet Booking Engine': 'B2C',
  'Expedia': 'OTA',
  'Relocation (B2C)': 'B2C',
  'BPO7381': 'B2B',
  'PO No: 3300035297': 'B2B',
  'makemytrip': 'OTA',
  'Walk-in': 'B2C',
  'Existing': 'B2C',
  'Airbnb': 'OTA',
  'BPO2077': 'B2B',
  'BPO2056': 'B2B',
  'AGR-10000836803': 'B2B',
  'AGR-10000836806': 'B2B',
  'AGR-10000836809': 'B2B',
  'AGR-10000836811': 'B2B',
  'BPO2076': 'B2B',
  'BPO2075': 'B2B',
  'BPO2073': 'B2B',
  'BPO2072': 'B2B',
  'BPO2071': 'B2B',
  'BPO2069': 'B2B',
  'BPO2068': 'B2B',
  'BPO2066': 'B2B',
  'N/A': 'B2B',
  'BPO2064': 'B2B',
  'BPO2061': 'B2B',
  'BPO2059': 'B2B',
  'BPO43325-V2': 'B2B',
  'BPO2057': 'B2B',
  'BPO43325-V53': 'B2B',
  'BPO43325-V51': 'B2B',
  'BPO43325-V50': 'B2B',
  'BPO43325-V48': 'B2B',
  'BPO43325-V47': 'B2B',
  'HyperGuest': 'OTA',
  'BPO43325-V45': 'B2B',
  'BPO43325-V44': 'B2B',
  'BPO43325-V42': 'B2B',
  'BPO43325-V40': 'B2B',
  'BPO43325-V39': 'B2B',
  'BPO43325-V38': 'B2B',
  'BPO43325-V37': 'B2B',
  'BPO43325-V35': 'B2B',
  'BPO43325-V34': 'B2B',
  'BPO43325-V32': 'B2B',
  'BPO43325-V30': 'B2B',
  'BPO43325-V29': 'B2B',
  'BPO43325-V28': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2022': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2047': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2046': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2045': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2044': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2042': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2040': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2037': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2035': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2032': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2029': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2026': 'B2B',
  'LUT-AD360321010417M Date of filing 22/03/2021': 'B2B',
  'LUT-AD3604220046669 Date of Filling 12/04/2024': 'B2B',
  'BPO43325-V26': 'B2B',
  'LUT-AD360321010417M Date of filing 22/03/2037': 'B2B',
  'LUT-AD360321010417M Date of filing 22/03/2035': 'B2B',
  'BPO43325-V24': 'B2B',
  'LUT-AD360321010417M Date of filing 22/03/2032': 'B2B',
  'BPO43325-V22': 'B2B',
  'BPO43325-V20': 'B2B',
  'LUT-AD360321010417M Date of filing 22/03/2030': 'B2B',
  'LUT-AD360321010417M Date of filing 22/03/2027': 'B2B',
  'BPO43325-V18': 'B2B',
  'LUT-AD360321010417M Date of filing 22/03/2025': 'B2B',
  'BPO43325-V16': 'B2B',
  'BPO43325-V13': 'B2B',
  'LUT-AD360321010417M Date of filing 22/03/2023': 'B2B',
  'BPO43325-V11': 'B2B',
  'BPO43325-V9': 'B2B',
  'BPO43325-V7': 'B2B',
  'BPO43325-V4': 'B2B',
  'BPO7382': 'B2B',
  'BPO7383': 'B2B',
  'BPO7384': 'B2B',
  'BPO7385': 'B2B',
  'BPO7386': 'B2B',
  'BPO7387': 'B2B',
  'BPO7388': 'B2B',
  'BPO7389': 'B2B',
  'BPO7390': 'B2B',
  'OTA': 'OTA',
  'BPO10092': 'B2B',
  'Website': 'Website',
  'KG Reddy': 'B2B',
  'Agoda B2B': 'OTA',
  'Clear trip': 'OTA',
  'EaseMyTrip': 'OTA',
  'NPO-00586': 'B2B',
  'BPO4993': 'B2B',
  'Travex': 'OTA'
};

/**
 * Case-insensitive lookup table built once from BOOKING_SOURCE_MAP, so real
 * API data with different casing (confirmed: "Go-MMT" vs the mapping
 * table's "go-mmt") still hits an exact match instead of falling through
 * to the pattern fallback and getting needlessly flagged "Unmapped".
 */
const BOOKING_SOURCE_MAP_LOWER_ = (function () {
  const map = {};
  Object.keys(BOOKING_SOURCE_MAP).forEach(function (key) {
    map[key.toLowerCase()] = BOOKING_SOURCE_MAP[key];
  });
  return map;
})();

/**
 * Classifies a raw booking source string into B2B / B2C / OTA / Website.
 * 1. Exact match against BOOKING_SOURCE_MAP wins first (case-insensitive -
 *    confirmed necessary against real data: eZee returns "Go-MMT", the
 *    mapping table has "go-mmt", a case-sensitive match would miss it).
 * 2. Otherwise apply the confirmed fallback rule (PRD Section 7.4):
 *      - recognized OTA platform name substring -> OTA
 *      - company/corporate-oriented pattern (BPO/LUT/AGR/PO/NPO codes,
 *        or the word "Corporate") -> B2B
 *      - everything else (walk-ins, tele sales, Exotel-via-website,
 *        generic call-ins) -> B2C
 * 3. Also returns isUnmapped = true when neither the exact map nor a known
 *    OTA/B2B pattern matched and B2C was only reached by default - this is
 *    surfaced in BigQuery as an "Unmapped" flag rather than silently
 *    trusted, so someone can triage it into the mapping table.
 */
function classifyBookingSource_(rawSource) {
  if (!rawSource) {
    return { category: 'B2C', isUnmapped: true };
  }
  const source = String(rawSource).trim();
  const sourceLower = source.toLowerCase();

  if (Object.prototype.hasOwnProperty.call(BOOKING_SOURCE_MAP_LOWER_, sourceLower)) {
    return { category: BOOKING_SOURCE_MAP_LOWER_[sourceLower], isUnmapped: false };
  }

  const OTA_PATTERNS = [
    /booking\.com/i, /agoda/i, /expedia/i, /airbnb/i, /makemytrip/i,
    /go-?mmt/i, /goibibo/i, /cleartrip/i, /travelguru/i, /hyperguest/i,
    /easemytrip/i, /travex/i, /\bota\b/i
  ];
  const B2B_PATTERNS = [
    /^BPO/i, /^LUT-/i, /^AGR-/i, /^PO No/i, /^NPO-/i, /corporate/i, /relocation \(b2b\)/i
  ];

  if (OTA_PATTERNS.some(function (p) { return p.test(source); })) {
    return { category: 'OTA', isUnmapped: true };
  }
  if (B2B_PATTERNS.some(function (p) { return p.test(source); })) {
    return { category: 'B2B', isUnmapped: true };
  }
  // Default fallback: walk-ins, tele sales, Exotel-via-website, etc.
  return { category: 'B2C', isUnmapped: true };
}

/** Returns "FY 25-26"-style label for a given JS Date, April-March year. */
function getFinancialYear_(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1-12
  let startYear, endYear;
  if (m >= CONFIG.FINANCIAL_YEAR_START_MONTH) {
    startYear = y;
    endYear = y + 1;
  } else {
    startYear = y - 1;
    endYear = y;
  }
  return 'FY ' + String(startYear).slice(-2) + '-' + String(endYear).slice(-2);
}

/** Returns full month name, matching the existing formula convention. */
function getMonthName_(date) {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return MONTHS[date.getMonth()];
}

function formatDateISO_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
}

function formatTimestampISO_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Kolkata', "yyyy-MM-dd'T'HH:mm:ss'Z'");
}
```

---

## 4. Room → Room Type Mapping

260 unique `(Room, Property)` → `Room Type` pairs, deduplicated from the
source room list (2 exact-duplicate rows removed; no conflicting mappings
found for any Room+Property combination). Room Types used: Executive Room,
Studio Room, 1 BHK, 2 BHK, Banquet, Hyber Room, Hyber Room Lite, Hyber Room Go.

Join on `(sales_booking.Room, sales_booking.Property)` → `Room Type`.

LP's room list is included below for historical joins only (§1 — LP is
permanently removed from current/future filters, but its past bookings still
need this mapping for historical KPIs).

#### KDP

| Room | Room Type |
|---|---|
| 101 old-Premier King Supreme | Executive Room |
| 101-Premier Twin Supreme | Executive Room |
| 102-Premier King Supreme | Executive Room |
| 103-Premier King Supreme | Executive Room |
| 104-Premier King Supreme | Executive Room |
| 105-Premier King Supreme | Executive Room |
| 106-Premier King Supreme | Executive Room |
| 107-Studio Supreme | Studio Room |
| 108-Studio Supreme | Studio Room |
| 109-Studio Supreme | Studio Room |
| 110-Studio Supreme | Studio Room |
| 111-Studio Supreme | Studio Room |
| 112-Studio Supreme | Studio Room |
| 114-Studio Supreme | Studio Room |
| 115-Studio Supreme | Studio Room |
| 201 old-Premier King Supreme | Executive Room |
| 201-Premier Twin Supreme | Executive Room |
| 202-Premier King Supreme | Executive Room |
| 203-Premier King Supreme | Executive Room |
| 204-Premier King Supreme | Executive Room |
| 205-Premier King Supreme | Executive Room |
| 206-Premier King Supreme | Executive Room |
| 207-Studio Supreme | Studio Room |
| 208-Studio Supreme | Studio Room |
| 209-Studio Supreme | Studio Room |
| 210-Studio Supreme | Studio Room |
| 211-Studio Supreme | Studio Room |
| 212-Studio Supreme | Studio Room |
| 214-Studio Supreme | Studio Room |
| 215-Studio Supreme | Studio Room |
| 301 old-Premier King Supreme | Executive Room |
| 301-Premier Twin Supreme | Executive Room |
| 302-Premier King Supreme | Executive Room |
| 303-Premier King Supreme | Executive Room |
| 304-Premier King Supreme | Executive Room |
| 305-Premier King Supreme | Executive Room |
| 306-Premier King Supreme | Executive Room |
| 307-Studio Supreme | Studio Room |
| 308-Studio Supreme | Studio Room |
| 309-Studio Supreme | Studio Room |
| 310-Studio Supreme | Studio Room |
| 311-Studio Supreme | Studio Room |
| 312-Studio Supreme | Studio Room |
| 314-Studio Supreme | Studio Room |
| 315-Studio Supreme | Studio Room |
| 401 old-Premier King Supreme | Executive Room |
| 401-Premier Twin Supreme | Executive Room |
| 402-Premier King Supreme | Executive Room |
| 403-Premier King Supreme | Executive Room |
| 404-Premier King Supreme | Executive Room |
| 405-Premier King Supreme | Executive Room |
| 406-Premier King Supreme | Executive Room |
| 407-Studio Supreme | Studio Room |
| 408-Studio Supreme | Studio Room |
| 409-Studio Supreme | Studio Room |
| 410-Studio Supreme | Studio Room |
| 411-Studio Supreme | Studio Room |
| 412-Studio Supreme | Studio Room |
| 414-Studio Supreme | Studio Room |
| 415-Studio Supreme | Studio Room |
| 501-One Bedroom Suite | 1 BHK |
| 502-One Bedroom Suite | 1 BHK |
| 503-One Bedroom Suite | 1 BHK |
| 504-One Bedroom Suite | 1 BHK |
| 505-One Bedroom Suite | 1 BHK |
| 506-One Bedroom Suite | 1 BHK |
| 507-One Bedroom Suite | 1 BHK |
| Banquet Hall-Banquet Hall | Banquet |
| Premier King Supreme | Executive Room |
| Premier Twin Supreme | Executive Room |

#### HTC

| Room | Room Type |
|---|---|
| 11-Premier King Supreme | Executive Room |
| 12-Premier Twin Supreme | Executive Room |
| 14-Studio Supreme | Studio Room |
| 15-Premier Twin Supreme | Executive Room |
| 16-Premier King Supreme | Executive Room |
| 17-One Bedroom Suite | 1 BHK |
| 21-Premier King Supreme | Executive Room |
| 22-Premier Twin Supreme | Executive Room |
| 23-Studio Supreme | Studio Room |
| 24-Premier Twin Supreme | Executive Room |
| 25-Premier King Supreme | Executive Room |
| 26-One Bedroom Suite | 1 BHK |
| 31-Premier King Supreme | Executive Room |
| 32-Premier Twin Supreme | Executive Room |
| 33-Studio Supreme | Studio Room |
| 34-Premier Twin Supreme | Executive Room |
| 35-Premier King Supreme | Executive Room |
| 36-One Bedroom Suite | 1 BHK |
| 41-Premier King Supreme | Executive Room |
| 42-Premier Twin Supreme | Executive Room |
| 43-Studio Supreme | Studio Room |
| 44-Premier Twin Supreme | Executive Room |
| 45-Premier King Supreme | Executive Room |
| 46-One Bedroom Suite | 1 BHK |
| 51-Premier King Supreme | Executive Room |
| 52-Premier Twin Supreme | Executive Room |
| 53-Studio Supreme | Studio Room |
| 54-Premier Twin Supreme | Executive Room |
| 55-Premier King Supreme | Executive Room |
| 56-One Bedroom Suite | 1 BHK |
| 61-Premier King Supreme | Executive Room |
| 62-Premier Twin Supreme | Executive Room |
| 63-One Bedroom Suite Supreme | 1 BHK |
| 64-Premier King Supreme | Executive Room |

#### JHS

| Room | Room Type |
|---|---|
| 100 - 2 BHK Studio-Two Bedroom Suite | 2 BHK |
| 101-Premier Room | Executive Room |
| 102-One Bedroom Suite | 1 BHK |
| 103-Studio Supreme | Studio Room |
| 104-Studio Supreme | Studio Room |
| 105-Studio Exclusive | Studio Room |
| 106-Studio Exclusive | Studio Room |
| 107-Studio Exclusive | Studio Room |
| 108-Studio Exclusive | Studio Room |
| 109-One Bedroom Suite | 1 BHK |
| 110-Premier Room | Executive Room |
| 111-Premier Room | Executive Room |
| 200 - 2 BHK Studio-Two Bedroom Suite | 2 BHK |
| 201-Premier Room | Executive Room |
| 202-One Bedroom Suite | 1 BHK |
| 203-Studio Supreme | Studio Room |
| 204-Studio Supreme | Studio Room |
| 205-Studio Exclusive | Studio Room |
| 206-Studio Exclusive | Studio Room |
| 207-Studio Exclusive | Studio Room |
| 208-Studio Exclusive | Studio Room |
| 209-One Bedroom Suite | 1 BHK |
| 210-Premier Room | Executive Room |
| 211-Premier Room | Executive Room |
| 300 - 2BHK Studio-Two Bedroom Suite | 2 BHK |
| 301-Premier Room | Executive Room |
| 302-One Bedroom Suite | 1 BHK |
| 303-Studio Supreme | Studio Room |
| 304-Studio Supreme | Studio Room |
| 305-Studio Exclusive | Studio Room |
| 306-Studio Exclusive | Studio Room |
| 307-Studio Exclusive | Studio Room |
| 308-Studio Exclusive | Studio Room |
| 309-One Bedroom Suite | 1 BHK |
| 310-Premier Room | Executive Room |
| 311-Premier Room | Executive Room |
| Premier Room | Executive Room |
| Studio Exclusive | Studio Room |
| Two Bedroom Suite | 2 BHK |

#### BH4

| Room | Room Type |
|---|---|
| 100-3BHK Apartment | Studio Room |
| 101-Executive Room | Studio Room |
| 102-Executive Room | Studio Room |
| 103-Executive Room | Studio Room |
| 200-3BHK Apartment | Studio Room |
| 201-Executive Room | Studio Room |
| 202-Executive Room | Studio Room |
| 203-Executive Room | Studio Room |
| 300-3BHK Apartment | Studio Room |
| 301-Executive Room | Studio Room |
| 302-Executive Room | Studio Room |
| 303-Executive Room | Studio Room |
| 400-3BHK Apartment | Studio Room |
| 401-Executive Room | Studio Room |
| 402-Executive Room | Studio Room |
| 403-Executive Room | Studio Room |
| 500-3BHK Apartment | Studio Room |
| 501-Executive Room | Studio Room |
| 502-Executive Room | Studio Room |
| 503-Executive Room | Studio Room |
| 600-3BHK Apartment | Studio Room |
| 601-Executive Room | Studio Room |
| 602-Executive Room | Studio Room |
| 603-Executive Room | Studio Room |

#### GB

| Room | Room Type |
|---|---|
| 101 | Hyber Room |
| 101-Hyber Room | Hyber Room |
| 102 | Hyber Room Lite |
| 102-Hyber Room | Hyber Room Go |
| 102.-Hyber Go | Hyber Room Go |
| 102.-Hyber Rooms Go | Hyber Room Go |
| 103 | Hyber Room Lite |
| 103-Hyber Room | Hyber Room Go |
| 103.-Hyber Go | Hyber Room Go |
| 103.-Hyber Rooms Go | Hyber Room Go |
| 104 | Hyber Room Lite |
| 104-Hyber Room | Hyber Room Go |
| 104.-Hyber Go | Hyber Room Go |
| 104.-Hyber Rooms Go | Hyber Room Go |
| 105 | Hyber Room Lite |
| 105-Hyber Room | Hyber Room Go |
| 105.-Hyber Go | Hyber Room Go |
| 105.-Hyber Rooms Go | Hyber Room Go |
| 106 | Hyber Room Lite |
| 106-Hyber Go | Hyber Room Go |
| 106-Hyber Rooms Go | Hyber Room Go |
| 107 | Hyber Room |
| 107-Hyber Room | Hyber Room |
| 201 | Hyber Room |
| 201-Hyber Room | Hyber Room |
| 202 | Hyber Room Lite |
| 202-Hyber Room | Hyber Room Go |
| 202.-Hyber Go | Hyber Room Go |
| 202.-Hyber Rooms Go | Hyber Room Go |
| 203 | Hyber Room Lite |
| 203-Hyber Room | Hyber Room Go |
| 203.-Hyber Go | Hyber Room Go |
| 203.-Hyber Rooms Go | Hyber Room Go |
| 204 | Hyber Room Lite |
| 204-Hyber Room | Hyber Room Go |
| 204.-Hyber Go | Hyber Room Go |
| 204.-Hyber Rooms Go | Hyber Room Go |
| 205 | Hyber Room Lite |
| 205-Hyber Room | Hyber Room Go |
| 205.-Hyber Go | Hyber Room Go |
| 205.-Hyber Rooms Go | Hyber Room Go |
| 206 | Hyber Room Lite |
| 206-Hyber Go | Hyber Room Go |
| 206-Hyber Rooms Go | Hyber Room Go |
| 207 | Hyber Room |
| 207-Hyber Room | Hyber Room |
| 301 | Hyber Room |
| 301-Hyber Room | Hyber Room |
| 302 | Hyber Room Lite |
| 302-Hyber Room | Hyber Room Go |
| 302.-Hyber Go | Hyber Room Go |
| 302.-Hyber Rooms Go | Hyber Room Go |
| 303 | Hyber Room Lite |
| 303-Hyber Room | Hyber Room Go |
| 303.-Hyber Go | Hyber Room Go |
| 303.-Hyber Rooms Go | Hyber Room Go |
| 304 | Hyber Room Lite |
| 304-Hyber Room | Hyber Room Go |
| 304.-Hyber Go | Hyber Room Go |
| 304.-Hyber Rooms Go | Hyber Room Go |
| 305 | Hyber Room Lite |
| 305-Hyber Room | Hyber Room Go |
| 305.-Hyber Go | Hyber Room Go |
| 305.-Hyber Rooms Go | Hyber Room Go |
| 306 | Hyber Room Lite |
| 306-Hyber Go | Hyber Room Go |
| 306-Hyber Rooms Go | Hyber Room Go |
| 307 | Hyber Room |
| 307-Hyber Room | Hyber Room |
| Hyber Go | Hyber Room Go |

#### LP

| Room | Room Type |
|---|---|
| 100 3BHK Apartment-3BHK Apartment | Studio Room |
| 101-Executive Room | Studio Room |
| 102-Executive Room | Studio Room |
| 103-Executive Room | Studio Room |
| 104 - SR-Studio Room | Studio Room |
| 200 3BHK Apartment-3BHK Apartment | Studio Room |
| 201-Executive Room | Studio Room |
| 202-Executive Room | Studio Room |
| 203-Executive Room | Studio Room |
| 204 - SR-Studio Room | Studio Room |
| 301-Executive Room | Studio Room |
| 302-Executive Room | Studio Room |
| 303-Executive Room | Studio Room |
| 304 - SR-Studio Room | Studio Room |
| 3BHK Apartment | Studio Room |
| 400 3BHK Apartment-3BHK Apartment | Studio Room |
| 401-Executive Room | Studio Room |
| 402-Executive Room | Studio Room |
| 403-Executive Room | Studio Room |
| 404 - SR-Studio Room | Studio Room |
| 4BHK Apartment | Studio Room |
| Executive Room | Studio Room |
| Studio Room | Studio Room |

---

## 5. `sales_booking` / `sales_booking_cancelled` Column Reference

# sales_booking / sales_booking_cancelled — Column Reference

Source: eZee BookingList API (Connectivity Portal docs, "Retrieve a Booking Based
on Parameters", pages 176–180) cross-checked against `expandStayDates()` in Code.gs.

## Row grain — read this before writing any formula

**One row = one occupied night of one reservation**, not one row per booking.
`StayDate` is generated by the script for every night between `ArrivalDate` and
`DepartureDate` (departure date itself excluded). A 4-night stay produces 4 rows
with identical `ReservationNo`/`FolioNo` but different `StayDate` and (usually)
different daily revenue figures.

Implications for formulas:
- `COUNT(*)` = room-nights, not bookings. For a distinct booking count use
  `COUNT(DISTINCT ReservationNo)` (add `Property` to the distinct key if
  `ReservationNo` isn't guaranteed unique across your five properties).
- `SUM(DailyRevenue)` grouped by `StayDate`/`Property` gives you day-level room
  revenue — this is the number to use for daily/monthly revenue dashboards.
- `SUM(DailyRevenue)` grouped by `ReservationNo` reconstructs the original
  booking total.

**Which table a row lands in** is decided once, per reservation, by whether
`BookingStatus`/`Status` contains "cancel" (case-insensitive) — not per night.
So a reservation is either fully in `sales_booking` or fully in
`sales_booking_cancelled`; you won't see a booking split across both tables.

---

## Identifiers

| Column | Source | Notes |
|---|---|---|
| `Property` | **Computed**, not from API | Looked up from `PROPERTY_CODES[hotel.hotelName]` based on which hotel's credentials fetched the row (KDP, HTC, JHS, BH4, GB). Reliable — not guest-entered data. |
| `FolioNo` | API: `FolioNo` | Guest folio/bill number. |
| `ReservationNo` | API: `ReservationNo` | Unique reservation ID *within a hotel account*. Treat as unique per `Property`, not necessarily globally unique across all 5 properties. |
| `VoucherNo` | API: `VoucherNo` | Voucher number, when applicable. |

## Guest info

| Column | Source | Notes |
|---|---|---|
| `GuestName` | API: `GuestName` | |
| `Mobile` | API: `Mobile` | |
| `Phone` | API: `Phone` | Separate field from `Mobile` in the API — often one or the other is populated, not both. |
| `Address` | API: `Address` | Frequently blank in practice. |
| `Email` | API: `Email` | |
| `Country` | API: `Country` | Guest's country. |
| `Adult` | API: `Adult` (numeric) | |
| `Child` | API: `Child` (numeric) | |
| `NoOfGuest` | API: `NoOfGuest` (numeric) | Total guest count for the reservation. |

## Dates & times

| Column | Source | Notes |
|---|---|---|
| `ArrivalDate` | API: `ArrivalDate` | Check-in date for the whole stay — same value repeated across all `StayDate` rows of a reservation. |
| `DepartureDate` | API: `DepartureDate` | Check-out date — same caveat as above. |
| `StayDate` | **Computed** | One row generated per night from `ArrivalDate` up to but excluding `DepartureDate`. This is your date-grain field for any "revenue by day" chart. |
| `ReservationDate` | API: "Date when Reservation is created" | Booking creation date. This is what `loadLastMonthBookings()`/your recurring refresh filters on — **not** `StayDate` or `ArrivalDate`. |
| `CancelDate` | API: "Date when Reservation is cancelled" | Only populated for rows in `sales_booking_cancelled`; blank string for active rows. |
| `ArrivalTime` | API: `ArrivalTime` | Check-in time, e.g. `"12:00:00"`. |
| `DepartureTime` | API: `DepartureTime` | Check-out time, e.g. `"11:00:00"`. |
| `NoOfNights` | API: `NoOfNights` (numeric) | **Raw API value — can be 0** for day-use (same-day arrival/departure) bookings. This is *not* the same as how many `StayDate` rows the script generated for that reservation (the script always generates at least 1 row, via `effectiveNights = max(1, NoOfNights)`). If you need "nights sold," derive it from counting `StayDate` rows per `ReservationNo` rather than trusting this column directly. |

## Booking status & source

| Column | Source | Notes |
|---|---|---|
| `Status` | API: "Status of booking" | e.g. `Active`. |
| `BookingStatus` | API: "Current Status of booking" | e.g. `Confirmed Reservation`. This (plus `Status`) is what the script checks for the word "cancel" to route a reservation to `sales_booking` vs `sales_booking_cancelled`. |
| `TransactionStatus` | API: "Status of transaction" | e.g. `Complete Booking`. |
| `Source` | API: `Source` | e.g. `web`, an OTA name, a travel agent, walk-in. This is the field your B2B/B2C/OTA/Website category mapping logic keys off. |
| `ReservationGuarantee` | API: "Guarantee of reservation" | e.g. `Confirm Booking`. |

## Room info

| Column | Source | Notes |
|---|---|---|
| `Room` | API: `Room` | Room type name, e.g. `Deluxe`. |
| `RoomShortCode` | API: `RoomShortCode` | Short code for the room type, e.g. `GV` for Garden View. |
| `RoomNo` | API: `RoomNo` | **Physical room number assigned**, e.g. `101` — documented in the API as optional, so can be blank if a room hasn't been allocated yet. |
| `BedType` | API: `BedType` | e.g. Double/Twin. |

## Revenue & tax — the part that matters most for formulas

The API gives each reservation ONE total for the whole stay (`TotalExclusivTax`,
`Total Tax`, `TotalInclusiveTax`, `OtherRevenueExclusiveTax`,
`OtherRevenueInclusiveTax`). The script's job is to turn that into a per-night
figure for each `StayDate` row. It does this two different ways depending on
the field:

| Column | How it's computed | Notes |
|---|---|---|
| `DailyRevenue` | **Exact** per-date value from API's `BaseRateExclusiveTax[StayDate]` when present; **fallback** = `TotalExclusivTax ÷ effectiveNights` (last night absorbs rounding) when not present for that date | Room revenue only — excludes `OtherRevenue`. |
| `DailyTotalInclusiveTax` | Same logic, using `BaseRateInclusiveTax[StayDate]` / `TotalInclusiveTax ÷ nights` | |
| `DailyTotalTax` | **Exact**: `DailyTotalInclusiveTax − DailyRevenue` for that date; **fallback**: `Total Tax ÷ effectiveNights` | |
| `DailyOtherRevenueExclusiveTax` | **Always** `OtherRevenueExclusiveTax ÷ effectiveNights` (even split, last night absorbs rounding) | The API has no per-date breakdown for Other Revenue (F&B, extras, etc.), so unlike room revenue this is never date-exact — it's a flat average across the stay regardless of which night the charge actually happened. |
| `DailyOtherRevenueInclusiveTax` | Same even-split logic on `OtherRevenueInclusiveTax` | |

**Practical takeaway for your formulas:** room-revenue columns
(`DailyRevenue`/`DailyTotalTax`/`DailyTotalInclusiveTax`) are date-accurate for
the common case where eZee returns a `BaseRateExclusiveTax`/`BaseRateInclusiveTax`
breakdown, but silently fall back to an even split for the (presumably rarer)
reservations where that breakdown is missing. The two `DailyOtherRevenue*`
columns are *always* an even split — never treat a specific night's Other
Revenue figure as "what actually happened that night," only the stay-total sum
is reliable.

---

## 6. Pipeline & Ops Context

- Apps Script project (`Code.gs` + `Config.gs`) pulls from the eZee BookingList
  API into BigQuery. `Config.gs` holds the 5 active hotel API keys and the
  `HOTELS` array (LP removed from this array — no new LP data will ever sync
  in; GB was added with hotel code `212`).
- Recurring refresh (`RefreshRecent.gs`): `refreshRecentBookings()` re-syncs
  `ReservationDate` from the 1st of the previous calendar month through today,
  on 3 daily triggers (8am / 1pm / 4pm), updating both `sales_booking` and
  `sales_booking_cancelled` together. **Accepted limitation, not being fixed:**
  scoped by `ReservationDate` (creation date), not arrival/stay date — a
  booking created 3+ months ago for a future stay, cancelled today, won't be
  caught by this refresh.
- `sales_booking_cancelled` was previously accidentally deleted and has since
  been recreated and fully backfilled — no longer an open issue.
- `OtherRevenue`/`ExtraCharges` investigation: confirmed (7-week sample) that
  `OtherRevenue = SUM(ExtraCharges)` exactly, and that the only charge types
  observed were F&B service charges and GST. CP/MAP plan costs are **not**
  `ExtraCharges` — they're baked into `DailyRevenue` (room revenue) via the
  `RatePlan` field. A full-history run to confirm no other charge types ever
  occur was considered and explicitly skipped as a product decision — treat
  "Extras Revenue" as whatever is in the `DailyOtherRevenue*` columns as-is,
  not as a guaranteed-complete figure.
