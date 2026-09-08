# PRD — New "Reports" Tab: Folio Based Report FY 26-27 + FY 26-27 B2B Details

**Status:** Governing principle resolved. Core metrics mapped and formula-verified
for Report 1; full structure confirmed for Report 2. A handful of Report 1 rows
(B2C revenue/ADR/share, OTA block, booking-behavior section) still need direct
sheet confirmation — flagged explicitly below, not blocking the rest of the build.

---

## 0. Governing principle (resolved 2026-09-08)

**The Revenue Workbook sheets are a template — for structure, layout, column
labels, grouping, and formula definitions only. They are never the source of
report values.** Every number in both new reports comes from the same
BigQuery tables and query logic the existing dashboard already uses
(`sales_booking`, `b2b_bills`, and the existing `getOverviewKpis`/
`getCategoryMix`/`getAvailableRoomNights` etc. patterns documented in the KPI
reference doc). No new pipeline, no new spreadsheet import, no reading cached
values out of a sheet cell.

**Why this matters concretely, not just as a principle**: direct inspection
of the live "Folio Based Report FY 26-27" sheet found that its Oct 2026
through Mar 2027 columns return Apr 2026's values verbatim — confirmed on two
independent metric rows (Room Revenue and F&B Revenue Share), both varying
correctly month-to-month through September, then locking to April's exact
figure for the remaining six months. This is a formula/reference bug in the
live sheet, not real data. Under this governing principle, it's a non-issue
for the dashboard: Report 1 computes Oct26–Mar27 the same way it computes
every other month — from `sales_booking`, using the sheet-derived formula
(e.g. `Total Revenue = Room Revenue + F&B Revenue`) — so it will show real
figures for those months regardless of what the sheet itself currently
displays. **Reproduce the sheet's formula. Never reproduce its output value.**

This applies identically to both reports.

---

## 1. Report 1 — Folio Based Report FY 26-27

### 1.1 Confirmed structure

Rows = metrics grouped into categories (`Revenue`, `Room Sales`, `B2B`, `B2C`,
`OTA`, plus a booking-behavior section below). Columns = `Overall – till
date` (KDP/HTC/JHS/BH4/GB/TOTAL), then one repeating block per fiscal month
(KDP/HTC/JHS/BH4/GB/`Month Total`), Apr 26 through Mar 27.

### 1.2 Per-metric mapping (Sheet metric → dashboard source → formula → status)

| Sheet Metric | Existing dashboard source | Formula (verified against real sheet arithmetic) | Status |
|---|---|---|---|
| Room Revenue | `sales_booking`, existing `getOverviewKpis` pattern | `SUM(DailyRevenue)` | **Confirmed** — exact match, all 12 months |
| F&B Revenue | `sales_booking`, existing `getOverviewKpis` pattern | `SUM(DailyOtherRevenueExclusiveTax)` | **Confirmed** — matches KPI ref doc's Extras Revenue field |
| Total Revenue | derived | `RoomRevenue + FnbRevenue` | **Confirmed** — exact match (e.g. KDP Overall: 4,87,64,688 + 3,47,69,064 = 8,35,33,752) |
| F&B Revenue Share | derived | `SAFE_DIVIDE(FnbRevenue, TotalRevenue)` | **Confirmed** — exact match (e.g. KDP Overall: 42%) |
| Available Room Nights | existing `getAvailableRoomNights()` (§1.5 of KPI reference doc) | room count × days, clamped to empirical active window | **Confirmed** — exact match, all 12 months |
| Sold Room Nights | `sales_booking`, existing pattern | `COUNT(*) WHERE BookingStatus NOT IN ('Void','No Show')` | **Confirmed pattern** — exact match for Overall/Apr26; not yet independently re-checked month-by-month beyond that (no reason to expect drift, same query shape as everything above it) |
| Occupancy % | derived | `SAFE_DIVIDE(SoldRoomNights, AvailableRoomNights)` | **Confirmed** — exact match |
| Guests Served | existing `getBookingStats` pattern | `SUM` of `MAX(NoOfGuest)` per distinct booking | **Confirmed pattern**, matches KPI ref doc §3; not independently re-verified against this sheet's own value beyond Overall/Apr26 |
| RevPAR | derived | `SAFE_DIVIDE(RoomRevenue, AvailableRoomNights)` | **Confirmed** — exact match |
| ADR | derived | `SAFE_DIVIDE(RoomRevenue, SoldRoomNights)` | **Confirmed** — exact match |
| Rev per Guest | derived | `SAFE_DIVIDE(RoomRevenue, GuestsServed)` | **Confirmed** — exact match |
| B2B Nights / Revenue / ADR | existing `getCategoryMix()` pattern, `bookingSourceMap.ts` for category classification | Same as Booking Details' Category Mix, filtered to B2B | **Confirmed pattern**; Revenue confirmed via the Share arithmetic below |
| **B2B Revenue Share** | derived — **non-obvious, do not "correct" it** | `SAFE_DIVIDE(B2bRevenue, RoomRevenue)` — **not ÷ Total Revenue**, and legitimately exceeds 100% | **Confirmed** — exact match (e.g. KDP Overall: 12,92,30,567 ÷ 4,87,64,688 = 265%) |
| B2C Nights | existing `getCategoryMix()` pattern | Same, filtered to B2C | **Confirmed present**, values not yet cross-checked |
| B2C Revenue / ADR / Revenue Share | existing `getCategoryMix()` pattern (assumed) | Same shape as B2B, by extension | **Not yet confirmed** — reasonable to assume given B2B's confirmed pattern, but not independently verified per this project's own standard |
| OTA Nights / Revenue / ADR / Revenue Share | existing `getCategoryMix()` pattern (assumed) | Same shape as B2B/B2C, by extension | **Not yet confirmed** — structure not yet directly inspected |
| Total Bookings, Repeat Count, Unique Count, Repeat %, ALOS, Expats (Bookings/Revenue/Revenue%/Nights/ALOS/Repeat Count/Repeat Share) | Row labels visible in a partial extraction; existing dashboard already has equivalent KPIs for most of these (Total Bookings, ALOS, Repeat Bookings %, Expat stats — §3 of KPI reference doc) | Likely reuses `getBookingStats`/repeat-guest-key logic/Expat `Country != 'India'` filter already built | **Not yet confirmed** — strong reuse candidates, exact formulas and this sheet's specific grouping not yet verified |

### 1.3 What's still needed before full sign-off

Only the rows marked "Not yet confirmed" above — B2C's Revenue/ADR/Share, the
OTA block, and the booking-behavior section. These don't block starting the
build (the confirmed rows above are the majority of the report and can be
built immediately), but should be verified before considering Report 1 fully
matched to spec. Additional screenshots of the sheet (scrolled to those rows,
any month column) would close this out.

### 1.4 Implementation shape

- New page under the Reports tab. Property filter (multi-select, existing
  convention). FY fixed to 26-27 per the report's own name.
- Table layout matching the sheet: metric rows, Property columns grouped by
  month block, "Overall – till date" as the first block.
- Every ratio (`Occupancy%`, `ADR`, `RevPAR`, `Rev per Guest`, `Revenue
  Share`) uses `SAFE_DIVIDE` — a zero-denominator cell renders blank/"—",
  never crashes or shows `Infinity`/`NaN`.
- Totals recomputed from true underlying sums, never averaged from per-cell
  ratios (same principle as §6.1's existing Total-row fix).
- No new BigQuery table, no new sync job.

---

## 2. Report 2 — FY 26-27 B2B Details

### 2.1 Confirmed structure — two zones, both from `b2b_bills`

**Zone A — Company × Month pivot** (one row per company, `Bills_due_from` as
identity, matching the dashboard's existing 2026-08-24 company-identity
convention):

```
Company | Total Revenue | Total Nights | Total ADR |
  Apr26 Revenue | Apr26 Nights | Apr26 ADR | ... (one triplet per fiscal month, Apr-Mar)
```

**Zone B — Row-level invoice detail** (one row per bill):

```
Property | Guest Name | Check In | Bill Date | Inv No | Business Source |
Nights | Bills due from | Room Revenue | POC | Month
```

### 2.2 Per-metric mapping

| Sheet Metric | Existing dashboard source | Formula | Status |
|---|---|---|---|
| Company identity | `b2b_bills.Bills_due_from` | Same field already used by "Contract Status & Ranking" / B2B Contribution % (§3 of KPI reference doc) | **Confirmed** — column names, sample values, and employee-name (`POC`) cross-check all match |
| Revenue (per company, per month) | `b2b_bills` | `SUM(Room_Revenue) WHERE Financial_Year='FY 26-27' AND Month=<block>` | **Confirmed structure**; apply the same governing principle — compute live from `b2b_bills`, never read a cached pivot cell |
| Nights | `b2b_bills` | `SUM(Nights)`, same scope | **Confirmed structure** |
| ADR | derived | `SAFE_DIVIDE(Revenue, Nights)`, same scope | **Confirmed structure** |
| Zone B row detail | `b2b_bills` | Direct `SELECT`, `WHERE Financial_Year='FY 26-27'`, Property filter applied | **Confirmed structure**; exact BigQuery column names (likely CamelCase/snake_case variants of the sheet's display labels) still need a quick `INFORMATION_SCHEMA.COLUMNS` check before finalizing the query |

### 2.3 Implementation shape

- Zone A: sortable table, default sort Revenue desc (matches the sheet's own
  order). Property filter pre-filters `b2b_bills` rows before pivoting.
- Zone B: plain table, same Property filter, sorted by Property then Check In.
- FY fixed to 26-27. `SAFE_DIVIDE` for ADR. Totals from true sums, not
  averaged ratios.
- No new BigQuery table, no new sync job — this was already the most
  strongly no-new-pipeline-needed part of the whole build (§2.1's evidence:
  every Zone B column name and the `POC` employee names cross-check directly
  against fields the dashboard already reads from `b2b_bills` today).

---

## 3. Shared requirements (both reports)

- New top-level nav item: **Reports**, containing exactly these two reports
  (per the "minimal tab count" principle already established for this
  dashboard).
- Both respect the existing Property filter convention. FY fixed to 26-27 in
  both, per each report's own name.
- `SAFE_DIVIDE` everywhere a ratio is computed, dashboard-wide convention.
- Totals/footers computed from true underlying sums, never averaged ratios.
- Report 1 applies the existing `BookingStatus NOT IN ('Void', 'No Show')`
  filter wherever it touches `sales_booking` — don't reintroduce the bug this
  fix already closed dashboard-wide (2026-09-08).
- **Governing principle (§0) applies to every cell in both reports, not just
  the ones known to currently diverge from the sheet.** If any other row is
  later found to disagree with a live sheet value, the default assumption is
  that the BigQuery-computed figure is correct and the sheet is stale/wrong
  — not the reverse — consistent with how the Oct26–Mar27 issue was resolved.

---

## 4. Explicit non-goals

- No changes to any existing dashboard tab, KPI, or query file — purely
  additive.
- No new BigQuery table, Apps Script sync job, or pipeline of any kind.
- No changes to `b2b_bills`' or `sales_booking`'s underlying data or schema.
- No changes to the live Google Sheets themselves (the Oct26–Mar27 formula
  issue is a sheet-side bug, out of scope for this dashboard PRD to fix —
  worth reporting to whoever owns the workbook separately, but the dashboard
  build doesn't depend on that sheet ever being fixed).

---

## 5. Build checklist

1. Build Report 1's confirmed rows (§1.2's "Confirmed" entries) — the
   majority of the report, ready now.
2. Confirm the remaining §1.2 "Not yet confirmed" rows (B2C revenue/ADR/
   share, OTA block, booking-behavior section) against the live sheet before
   finalizing those specific rows.
3. Confirm `b2b_bills`' real BigQuery column names via
   `INFORMATION_SCHEMA.COLUMNS` before finalizing Report 2's Zone B query.
4. Build Report 2.
5. **Validate both reports' Apr26–Sep26 figures against the sheet directly**
   (the months where the sheet's own data is internally consistent) — spot
   check at minimum one company's Zone A totals and one month's Report 1
   column total.
6. **Deliberately do not validate Oct26–Mar27 against the sheet** — per §0,
   the dashboard's computed values for those months are expected to differ
   from the sheet's current (buggy) display. Validate those months instead
   against a fresh BigQuery query using the same formula, confirming
   internal consistency rather than sheet-matching.
7. Run build and lint.
8. Confirm no other tab's output changed as a side effect.
9. Commit.
