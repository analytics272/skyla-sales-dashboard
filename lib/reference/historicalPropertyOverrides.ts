// 2026-09-21 — targeted static overrides for the Folio Based Report,
// applied only where root-cause investigation against two finance-provided
// "Revenue Dashboard" reference workbooks (FY24-25, FY25-26) did NOT
// converge on an explainable, generalizable query fix — see
// Skyla_Dashboard_KPI_Logic_Reference.md's 2026-09-21 entries for the full
// investigation. Everything else reconciled through real fixes instead
// (KDP roomCount, JHS's Two Bedroom Suite weighting, GB's Other Revenue) —
// this table exists ONLY for the handful of property-months where that
// wasn't possible, per explicit user direction to fall back to the
// workbooks' own figures rather than leave a known-wrong number showing.
//
// Scoped deliberately narrow:
// - Only `getFolioBasedReport` (Reports tab) reads this — the only page
//   with a genuine Property x Month grid matching the workbooks' own
//   structure. Overview/Bookings/Performance/Targets show different cuts
//   (rankings, distributions, FY totals) that don't have a matching cell
//   to override cell-for-cell.
// - Only the two fields actually shown to be wrong are overridden per
//   entry (never both unconditionally) — Revenue stays computed wherever
//   it already reconciled, only Sold Nights is overridden for the
//   Nov'25-Feb'26 / Jan'25 anomaly, since Revenue was already accurate
//   there.
//
// Three distinct anomaly groups, all left unexplained after real
// investigation (not guessed at further, to avoid overfitting a change
// that would only affect these few months at the expense of the ~50
// months that already reconcile cleanly via the real fixes above):
//
// 1. April 2024 (`2024-04`), all 5 properties — every property's
//    `sales_booking` rows start 2-3 days late that month and run at
//    roughly half of May 2024's volume — a genuine upstream PMS-sync
//    data-completeness gap at the very start of this table's history, not
//    something a query can compute around. Both Sold Nights and Revenue
//    are overridden.
// 2. GB (Hyber) Sep-Nov 2025 — Sold Nights and Revenue both run
//    80-100% below the workbook, almost certainly a PMS-tagging gap
//    during GB's "Hyber" rebrand (the workbook itself labels this
//    property "Hyber (from 15th Sep)" that exact month). Both fields
//    overridden for Sep-Nov; Dec'25/Feb'26 are smaller Sold-Nights-only
//    tails once the transition settles.
// 3. Smaller, unexplained Sold-Nights-only or Revenue-only gaps scattered
//    across both FYs (never both together, so not the same mechanism as
//    #1/#2) — FY25-26 Nov'25-Jan'26 nights (BH4/HTC/JHS/KDP) and Feb'26
//    nights (HTC/KDP), two scattered single-month KDP nights gaps
//    (May'25, Jul'25), FY24-25 Jan'25 JHS nights, a handful of May-Jul'24
//    nights+revenue gaps (KDP/HTC/BH4) and Mar'25 BH4, and a clean 5-month
//    JHS revenue-only shortfall (May-Sep 2024, Sold Nights already
//    matched throughout).
export interface PropertyMonthOverride {
  soldRoomNights?: number;
  /** The workbooks' own single "Revenue" figure for the month — Room Revenue only for every property except GB (Room + Other/ancillary), NEVER including F&B (fnb_sale predates both workbooks). Applied by backing `roomRevenue` into whatever Other Revenue this month already computed; fnbRevenue is left untouched and simply adds on top, same as any non-overridden month. */
  totalRevenue?: number;
}

// Key: `${property}|${YYYY-MM}`.
export const HISTORICAL_PROPERTY_OVERRIDES: Record<string, PropertyMonthOverride> = {
  // --- April 2024 pipeline gap — all 5 properties, nights + revenue ---
  "BH4|2024-04": { soldRoomNights: 447, totalRevenue: 1481200 },
  "GB|2024-04": { soldRoomNights: 258, totalRevenue: 728435 },
  "HTC|2024-04": { soldRoomNights: 826, totalRevenue: 3325213 },
  "JHS|2024-04": { soldRoomNights: 660, totalRevenue: 3134790 },
  "KDP|2024-04": { soldRoomNights: 903, totalRevenue: 4382868 },

  // --- FY24-25 Jan'25 Sold-Nights-only anomaly (JHS) ---
  "JHS|2025-01": { soldRoomNights: 745 },

  // --- FY24-25 scattered nights+revenue anomalies (May-Jul'24, Mar'25) ---
  "KDP|2024-05": { soldRoomNights: 927, totalRevenue: 4516981 },
  "HTC|2024-05": { soldRoomNights: 903, totalRevenue: 3660328 },
  "BH4|2024-05": { soldRoomNights: 451, totalRevenue: 1497522 },
  "HTC|2024-06": { soldRoomNights: 901, totalRevenue: 3808280 },
  "HTC|2024-07": { soldRoomNights: 935, totalRevenue: 4024861 },
  "BH4|2024-07": { soldRoomNights: 527, totalRevenue: 2010400 },
  "BH4|2025-03": { soldRoomNights: 380, totalRevenue: 1339251 },

  // --- FY24-25 JHS revenue-only shortfall, May-Sep'24 (Sold Nights already matched) ---
  "JHS|2024-05": { totalRevenue: 2854276 },
  "JHS|2024-06": { totalRevenue: 3872563 },
  "JHS|2024-07": { totalRevenue: 4315676 },
  "JHS|2024-08": { totalRevenue: 3791754 },
  "JHS|2024-09": { totalRevenue: 3536121 },

  // --- FY25-26 scattered Sold-Nights-only anomalies (KDP) ---
  "KDP|2025-05": { soldRoomNights: 1417 },
  "KDP|2025-07": { soldRoomNights: 1655 },

  // --- FY25-26 Nov'25-Feb'26 Sold-Nights-only anomaly ---
  "BH4|2025-11": { soldRoomNights: 431 },
  "BH4|2025-12": { soldRoomNights: 449 },
  "BH4|2026-01": { soldRoomNights: 478 },
  "HTC|2025-11": { soldRoomNights: 898 },
  "HTC|2025-12": { soldRoomNights: 716 },
  "HTC|2026-01": { soldRoomNights: 838 },
  "HTC|2026-02": { soldRoomNights: 724 },
  "JHS|2025-11": { soldRoomNights: 853 },
  "JHS|2025-12": { soldRoomNights: 696 },
  "JHS|2026-01": { soldRoomNights: 764 },
  "KDP|2025-11": { soldRoomNights: 1479 },
  "KDP|2025-12": { soldRoomNights: 1439 },
  "KDP|2026-01": { soldRoomNights: 1538 },
  "KDP|2026-02": { soldRoomNights: 1495 },

  // --- FY25-26 GB (Hyber) Sep-Nov'25 — severe data gap, nights + revenue
  //     near-zero in sales_booking despite real sheet activity; almost
  //     certainly a PMS-tagging gap during GB's "Hyber" brand transition
  //     (the sheet itself labels this property "Hyber (from 15th Sep)"
  //     that same month) — not diagnosed further, same treatment as the
  //     April 2024 pipeline gap. Dec'25/Feb'26 are smaller Sold-Nights-only
  //     gaps once the transition settles (Revenue already close by then).
  "GB|2025-09": { soldRoomNights: 132, totalRevenue: 544615 },
  "GB|2025-10": { soldRoomNights: 255, totalRevenue: 1031192 },
  "GB|2025-11": { soldRoomNights: 386, totalRevenue: 1534870 },
  "GB|2025-12": { soldRoomNights: 256 },
  "GB|2026-02": { soldRoomNights: 462 },
};

export function getPropertyMonthOverride(property: string, monthKey: string): PropertyMonthOverride | undefined {
  // monthKey arrives as the full ISO date "YYYY-MM-01" (reports.ts's
  // `bounds.start`) — this table keys by "YYYY-MM" only.
  return HISTORICAL_PROPERTY_OVERRIDES[`${property}|${monthKey.slice(0, 7)}`];
}
