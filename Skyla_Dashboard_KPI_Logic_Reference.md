# Skyla Collective Sales Dashboard — KPI & Chart Logic Reference

Every metric and chart in the dashboard, tab by tab, with the exact calculation
behind it: source table(s), columns, formula, and any caveat that affects how
to read the number. Source code lives in `lib/bigquery/queries/*.ts` (one file
per tab's data) and `lib/reference/*.ts` (shared lookup logic) — this document
is the plain-English mirror of that code.

**Global filters** (Property, Month, Quarter, Financial Year) apply to every
KPI below unless a note says otherwise. Property, Month, and FY are
multi-select; Quarter is single-select.

---

## 0. Revision history

Corrections made after initial build, based on user testing against the live
dashboard. Each entry names the old behavior, the fix, and why — see the
relevant tab section below for the current formula.

**2026-08-24:**
- **Target rollover was inflating the annual total ~1.5×.** The sheet's own
  `Target_With_Roll_Over` column is corrupted for every FY's first month
  (April came out as a few lakh instead of ~₹2Cr). Rollover is now computed
  in-app from `dept_Total_Target`/`Revenue_Achieved` directly (§6). A second,
  related bug: because every not-yet-started month has `Revenue_Achieved = 0`,
  treating that as a real 100% miss caused each future month's "shortfall" to
  cascade fully into the next, compounding a flat ₹28.00 Cr target up to
  ₹43.71 Cr summed. Fixed so a future month's target-with-rollover is just its
  flat target — no compounding penalty for a month that hasn't happened yet.
- **B2B company identity switched from `Company`/`Bill_To` to `Bills_due_from`**
  (per business direction — `Bills_due_from` is the operational name used
  day-to-day, e.g. "Tata Consumer" vs the legal entity name in `Company`/
  `Bill_To`). Company count for the same scope drops from 436 to ~280 as a
  result (multiple legal-entity names collapse under one operational name).
- **B2B revenue switched from `col_21` (tax-inclusive) to `Room_Revenue`
  (tax-exclusive)** — dashboard figures are meant to be exclusive-of-tax
  throughout; `col_21 = Room_Revenue + col_20 (tax)`.
- **"Contract revenue achieved"** (Booking Details) now sums only
  `Contract_Status = 'Contract'` rows — previously conflated with total
  company revenue across every status.
- **Contribution %** (per-company, Booking Details ranking table) now = that
  company's B2B revenue ÷ **total company-wide revenue across every channel**
  (B2B+B2C+OTA combined, from `sales_booking`) — not a company's share of the
  B2B channel alone. Went through two earlier, narrower definitions first
  (share of Contract-status revenue only, then share of all-B2B revenue only)
  before landing here per explicit user direction.
- **Extra Revenue switched from `DailyOtherRevenueInclusiveTax` to
  `DailyOtherRevenueExclusiveTax`** (Room Revenue was already tax-exclusive,
  no change needed there). The Extra Revenue card itself was later removed
  from the dashboard entirely.
- **`Website` removed as a 4th booking category** — folded into B2C
  everywhere `bookingCategorySqlExpr` is used (Revenue by Source, Trends,
  Brand). `BookingCategory` is now just `B2B | B2C | OTA`.
- **B2C Leads broadened** from `Source = 'Exotel'` only to
  `Source IN ('Exotel', 'Business WA', 'Website')` — WhatsApp and website
  inquiries are B2C acquisition channels too.
- **Property-filter gaps closed**: `getB2bContractRanking`,
  `getB2bTopAdrContracts`, `getCorporateAccountRetention` (all in
  `b2bContracts.ts`) and `getLeadsMoM` (`leads.ts`) previously ignored the
  Property filter entirely despite their source tables having a `Property`
  column — now scoped like everything else.
- **Targets tab's 3 monthly charts (Revenue rollover, ADR, Occupancy vs
  achieved)** were hardcoded to a single FY regardless of the FY filter
  selection — now render one section per selected FY.
- **Line charts stop instead of flat-lining at 0** for a month that hasn't
  happened yet, rather than either bridging a false diagonal across the gap
  or plotting a misleading "achieved nothing" 0 through the rest of the FY. A
  future month with real advance/forward-booked data (bookings made ahead of
  the stay date) still shows that real value — only genuinely-empty future
  months get cut.
- **Duplicate table removed**: "Nights / Revenue / ADR by Company" and
  "Contract Status & Ranking" showed the same underlying `b2b_bills` numbers
  with different columns — merged into one table (Contract Status & Ranking
  gained an ADR column).

**2026-08-25:**
- **B2B Contribution %, final definition**: each company's B2B revenue ÷
  total company-wide revenue across every channel (B2B+B2C+OTA, from
  `sales_booking`) — not just its share of the B2B channel. Third and final
  attempt at this definition; see §3's B2B section for the history.
- **"All" in the FY filter was semantically a no-op.** Selecting it cleared
  the FY selection, which `resolveSelectedFYs()` treats as "default to the
  current FY" — so "All" behaved exactly like selecting just the current FY.
  Fixed: the FY dropdown's "All" now writes all 3 known FY labels explicitly
  instead of clearing the selection (`MultiSelectDropdown`'s new `allValue`
  prop). Property/Month are unaffected — for them, empty already means
  unrestricted, which is what "All" should do.
- **Two charts ignored the FY filter regardless of this fix**: Revenue
  Details' two small monthly charts (inside the Room Revenue and Occupancy
  hero cards) and Leads MoM were hardcoded to a single FY. Found by grepping
  every `latestSelectedFy(...)` call site. Fixed to the same "one
  line/section per selected FY" pattern already used on Trends and Targets.
- **"All" filter regression, self-inflicted and caught same day**: the
  buffered-apply performance fix (previous entry, "Filter performance")
  accidentally made "All" wait for an extra Apply click too. Fixed — "All" is
  a single decisive action and commits immediately.
- **Revenue targets by property added** — a new, fixed-reference-data
  section (not from BigQuery) comparing per-property FY 26-27 targets against
  live achieved figures. See §6.1.

**2026-08-25 (later same day):**
- **Property-targets total row fixed** — the footer row hardcoded Occ%/ARR to
  "—" (only revenue was summed), showing as a broken blank row. Now computed
  from the true underlying sold/available-nights and revenue sums, not by
  averaging each property's own ratio. See §6.1.
- **Targets tab "Company-wide, not property-scoped" caption removed** per
  request. The underlying constraint is unchanged — see §6.
- **Dashboard layout widened** — removed the `max-w-7xl` cap on the main
  content area (`app/(dashboard)/layout.tsx`), which left a large empty
  margin on wide screens. Content now fills the available width next to the
  sidebar.
- **Lead Tracker "By Owner" filtered to real employees only** — `Owner` had
  lead-source values (`Business WA`, `Website`, `Walk in`) leaking in
  alongside the 5 real employee names. Excluded; see §7.
- **Chart x-axis labels now fully vertical** (`angle={-90}`, was `-20`) on
  every `SingleMetricBarChart` — room-format/lead-source category names read
  more clearly stacked vertically than at a shallow diagonal. **Reverted same
  day**: per follow-up feedback, vertical labels are back to horizontal
  everywhere except Lead Tracker's three "By Format" charts (Leads/Revenue/
  ADR By Format), which keep vertical via a new `verticalLabels` prop on
  `SingleMetricBarChart` (default `false`). The feedback referenced "employee
  names" needing the vertical treatment, but no chart currently plots
  `Owner` as bars (it's a table) — applied to the pictured "By Format"
  charts instead as the closest concrete match; flagged back to the user.

**2026-08-26:**
- **LP (Lotus Pond) re-integrated.** LP was previously treated as permanently
  removed (zero rows in `sales_booking`, excluded from `ACTIVE_PROPERTY_CODES`
  and every property filter). Per `Skyla_Sales_Dashboard_PRD_LP_Addendum.md`,
  the business backfilled and validated two new monthly-grain BigQuery tables
  covering LP's full historical trading (`sales_booking_lp_monthly`,
  `sales_booking_lp_monthly_roomtype`) — LP still has no PMS feed and never
  will (retired hotel), so this is a one-time backfill, not a live pipeline.
  LP is now back in `ACTIVE_PROPERTY_CODES` and every property filter. Full
  mechanism and per-tab participation rules: new **§11**.
- **`getPropertyActiveWindows()` now sources LP's active window from
  `sales_booking_lp_monthly`** (`MIN`/`LAST_DAY(MAX(MonthStartDate))`) instead
  of `sales_booking` (which has none for LP) — this single fix made every
  existing Available Room Nights / Occupancy% call site correctly LP-aware
  with no further changes needed at those call sites.
- **`fiscalMonthNumber()` (calendar→fiscal month) promoted from a private
  helper inside `targets.ts` to a shared export in `financialYear.ts`**,
  alongside the pre-existing `calendarMonthFromFiscal()` — needed by the new
  LP query module, which converts LP's fiscal `MonthNumber` the same way
  `leadership_targets` does.

**2026-08-26 (later, second pass — LP extended to Booking Details):**
- **Booking Details reassessed and extended.** Total Bookings, Guests Served,
  ALOS, Revenue per Guest, Unsold Room Nights, the B2B/B2C/OTA Night/Revenue
  Mix, and all three room-format KPIs now merge in LP when selected — the
  monthly table has real `BookingsCount`/`GuestServed` columns, and
  `sales_booking_lp_monthly_roomtype` (previously unused) supplies the
  room-type dimension. Repeat Bookings, Cancellations %, Cancellation Lead
  Time, and Expat stats stay excluded — checked directly, neither LP table
  has a guest-identity, cancellation, or `Country` column at any grain. Full
  detail: §3, §11.
- **Real bug fixed**: `getRoomNightsGap()`'s Unsold Room Nights was silently
  overstating LP as 100% unsold whenever selected — `Available` already
  included LP (via the window fix above), but `Sold` only ever came from
  `sales_booking`, which has zero LP rows. Now adds LP's real
  `SoldRoomNights`. See §11 for the verified before/after numbers.
- **Room-type merge uses a revenue-weighted nights allocation, not the
  roomtype table's own `Nights` column** — that column doesn't reconcile with
  the already-validated `sales_booking_lp_monthly.SoldRoomNights` (off by
  19%–76% across all 24 months, no fixed ratio), while `TotalRevenue` and
  `BookingsCount` reconcile exactly. Since LP has exactly one room type
  ("Studio Room") throughout its history, this allocation is exact for LP's
  real data, not an approximation. Full reasoning: §11.
- **OTA Breakdown and Targets reassessed and confirmed to have no safe
  extension** — re-verified against BigQuery's actual column list (OTA
  Breakdown: no per-OTA-site column anywhere in the LP data) and against
  every formula in `targets.ts` (Targets: every KPI is target-relative, and
  LP was never given a target). Both tabs unchanged. See §6, §8, §11.

---

## 1. Shared reference logic

These building blocks are reused across multiple tabs.

### 1.1 Financial Year & Fiscal Quarter
- FY runs **April–March**, labeled `FY YY-YY` (e.g. `FY 25-26` = Apr 2025–Mar 2026).
- Fiscal quarters: **Q1** Apr–Jun, **Q2** Jul–Sep, **Q3** Oct–Dec, **Q4** Jan–Mar.
- File: `lib/reference/financialYear.ts`.

### 1.2 Multi-month filter (non-contiguous)
- Selecting several months (e.g. Apr + Dec) does **not** use a date range —
  it filters `FY label = @fy AND EXTRACT(MONTH FROM date) IN (@months)`. A
  `BETWEEN` range would wrongly pull in every month between the two selections;
  this doesn't.
- Verified directly against BigQuery: Apr+Dec (FY25-26) returns exactly
  ₹3.75 Cr / 6,627 nights — a naive range would have returned ₹15.4 Cr.

### 1.3 Booking Source → Category (B2B / B2C / OTA)
- Ported verbatim from the existing `Mapping.gs` script: a 108-entry exact-match
  table (case-insensitive), then a fallback pattern match (OTA platform names,
  `BPO`/`LUT`/`AGR`/`PO`/`NPO` prefixes → B2B, "corporate" → B2B), else B2C.
- Applies to `sales_booking.Source`, `sales_booking_cancelled.Source`, `lead_tracker.Source`.
- **Update 2026-08-24**: `Website` removed as its own 4th category — the one
  source that mapped to it now maps to `B2C` instead, per user direction
  (avoid a near-empty 4th category cluttering every chart that groups by
  business category).
- File: `lib/reference/bookingSourceMap.ts`.
- An `isUnmapped` flag exists internally for any source that only matched via
  the fallback pattern (not an exact entry) — used to keep the mapping table
  maintainable, not surfaced as its own dashboard KPI in v1.

### 1.4 OTA Commission Table
- Editable rate table, not hardcoded per-query. Rates: Goibibo 20%, go-mmt 20%,
  Travelguru 20%, Cleartrip 16%, Agoda 17.5%, Agoda B2B 17.5%, Expedia 15%,
  makemytrip 20%, HyperGuest 16%, EaseMyTrip 20%, Airbnb 0%, **Travex 20% flat
  across all properties**. Booking.com is property-specific: KDP 18%, HTC 18%,
  JHS 16%, GB 15%, **BH4 15%**. Generic **"OTA"** label source is still 0%
  (unresolved placeholder — no rate ever supplied for this specific label).
- File: `lib/reference/otaCommission.ts`.

### 1.5 Property Reference
| Property | Brand | Rooms | Status |
|---|---|---|---|
| KDP | Skyla | 63 | Active |
| HTC | Skyla | 34 | Active |
| JHS | Skyla | 33 | Active |
| BH4 | Aptly | 18 | Active (zero rows in `sales_booking` currently — see §10) |
| GB | Hyber | 21 | Active |
| LP | Aptly | 16 | Active (re-activated 2026-08-26) — zero rows in `sales_booking` (retired, no PMS feed), real data sourced from `sales_booking_lp_monthly` instead — see §11 |

- **Available Room Nights** = room count × days in the scoped period, clamped
  to each property's *empirical* active window (`MIN`/`MAX(StayDate)` across
  `sales_booking` + `sales_booking_cancelled`), summed per selected month when
  multiple non-contiguous months are chosen. **LP's window is the one
  exception**: sourced from `MIN`/`LAST_DAY(MAX(MonthStartDate))` on
  `sales_booking_lp_monthly` instead, since `sales_booking` has nothing for it.
- File: `lib/reference/propertyReference.ts`, window logic in
  `lib/bigquery/queries/propertyWindows.ts`.

### 1.6 Room → Room Type Mapping
- 260 `(Room, Property)` → Room Type pairs from the reference sheet, joined
  against `sales_booking.Room`.
- Real `Room` values are frequently the bare type name without the sheet's
  room-number prefix (e.g. data has `"Studio Supreme"`, the sheet has
  `"107-Studio Supreme"`). Matching normalizes by stripping the leading
  room-number prefix before comparing — raised the match rate from 37% to
  99.997% of rows.
- **GB is a special case**: the room *number* (not just the text) decides
  Room vs Room Lite vs Room Go (e.g. `101-Hyber Room` → Hyber Room, but
  `102-Hyber Room` → Hyber Room Go), so GB reconstructs the sheet's own
  `<RoomNo>-<Room>` key from the separate `RoomNo` column instead of using
  the generic normalization.
- File: `lib/reference/roomTypeMapping.ts`.

---

## 2. Revenue Details tab

Source: `lib/bigquery/queries/overview.ts`, table `sales_booking`. **When LP is
in the Property selection** (2026-08-26), Room Revenue, Sold Room Nights,
Available Room Nights, Revenue by Source, and the YoY comparison all have
LP's `sales_booking_lp_monthly` contribution added in on top of the
`sales_booking` figures — see §11. Occupancy Pace and Last-Month Category
Breakdown (the two real-time "today"-relative cards) deliberately do **not**
merge in LP — they're outside LP's Apr2024–Mar2026 data window by
construction, so LP naturally contributes 0 to them already.

| KPI | Formula |
|---|---|
| Room Revenue | `SUM(DailyRevenue)` (already tax-exclusive — confirmed `DailyRevenue + DailyTotalTax = DailyTotalInclusiveTax`) |
| Extras Revenue | `SUM(DailyOtherRevenueExclusiveTax)` (was `DailyOtherRevenueInclusiveTax` — switched 2026-08-24 for tax-exclusive consistency). **Card removed from the dashboard 2026-08-24** — formula kept here for reference only. |
| ADR | Room Revenue ÷ Sold Room Nights |
| Occupancy % | Sold Room Nights ÷ Available Room Nights |
| RevPAR | Room Revenue ÷ Available Room Nights |
| Sold Room Nights | `COUNT(*)` (row grain = one occupied night) |
| Available Room Nights | see §1.5 |
| Unsold Room Nights | Available − Sold |
| Room Revenue / ADR / Occupancy / RevPAR YoY | Current FY vs the prior FY's, **always the full FY** regardless of any Month/Quarter narrowing — YoY is a year-level comparison by design. Displayed as "▲/▼ X% vs {prior FY} (₹prior value)" — same pattern used everywhere a YoY comparison is shown (§ "Comparison pattern" note below) |
| Revenue by Source | Room Revenue grouped by B2B/B2C/OTA (§1.3) |
| Room Nights by Source | Sold Room Nights grouped the same way |
| ADR by Property | Room Revenue ÷ Sold Room Nights, one bar per property. **LP appears as its own bar** (2026-08-26) when selected — its revenue/nights come from `sales_booking_lp_monthly`, not `sales_booking` (§11) |

**Comparison pattern** (2026-08-24, per the Looker Studio reference the
business uses): any FY-over-FY comparison on the dashboard follows one
format — arrow + relative % change + the prior period's label + the prior
period's absolute value, e.g. `▲ 12% vs FY 25-26 (₹3.2 Cr)`. Implemented once
in `formatYoyLine()` (`lib/format/currency.ts`) and reused everywhere;
`FyComparisonStrip` (`components/charts/FyComparisonStrip.tsx`) is the same
pattern applied as a strip of N FY values above a per-FY chart (Trends'
Occupancy/RevPAR/ADR trend charts, Brand's category-revenue chart, Booking's
room-format chart) rather than a single current-vs-prior pair.

## 3. Booking Details tab

Source: `lib/bigquery/queries/guestDetail.ts` (`sales_booking`,
`sales_booking_cancelled`) and `lib/bigquery/queries/b2bContracts.ts` (`b2b_bills`).
**Reassessed 2026-08-26** (originally blanket-excluded — see §0): LP now
merges into every KPI on this tab that the monthly-grain data genuinely
supports (Total Bookings, Guests Served, ALOS, Revenue per Guest, Unsold Room
Nights, the B2B/B2C/OTA Night/Revenue Mix, and all three room-format charts,
the last via `sales_booking_lp_monthly_roomtype`). It remains excluded from
Repeat Bookings, Cancellations %, Cancellation Lead Time, and Expat stats —
not by category-level policy, but because neither LP table has the specific
column each of those needs (guest identity, cancellation records, or
`Country`). Full detail: §11.

| KPI | Formula |
|---|---|
| Total Bookings | `COUNT(DISTINCT CONCAT(Property, ReservationNo))`, excluding rows with a null `ReservationNo`. **LP's `BookingsCount` added when selected** (2026-08-26) — a real count in the source data, not derived. |
| Guests Served | `SUM` of `MAX(NoOfGuest)` per distinct booking. **LP's `GuestServed` column added when selected** — same "guests served" concept, a real monthly total in the source data. |
| ALOS | Sold Room Nights ÷ Total Bookings (both sides include LP's contribution when selected) |
| Revenue per Guest | Room Revenue ÷ Guests Served (both sides include LP's contribution when selected) |
| Repeat Bookings | Bookings sharing a guest key (`Mobile`, falling back to `Email`, then `GuestName`) with >1 distinct booking; share % = repeat ÷ total. **LP excluded** — neither LP table has any guest-identity column, at monthly or room-type grain; not computable without fabricating guest identities. |
| Cancellations % | Cancelled bookings ÷ (active + cancelled bookings), both counted the same way as Total Bookings. **LP excluded** — the backfill only covers realized (checked-out) stays; no cancellation records exist in either LP table. |
| Avg Cancellation Lead Time | `AVG(ArrivalDate − CancelDate)` in days, over `sales_booking_cancelled`. **LP excluded** — depends on `sales_booking_cancelled`, which has (and will always have) zero LP rows. |
| Unsold Room Nights | Available − Sold, for the selected scope. **LP's real sold nights now subtracted when selected** (2026-08-26 fix) — Available already included LP via §1.5's window fix, but Sold didn't, which was silently overstating LP as 100% unsold. Verified: FY 25-26 delta between with/without LP is exactly 1,995 nights = LP's own Available (5,840) − Sold (3,845). |
| Remaining Room Nights | Available − Sold, narrowed to **[today, scope end]** — 0 if the whole scope is already in the past. **LP naturally contributes 0** — its entire data window (Apr 2024–Mar 2026) is already in the past relative to any realistic "today," so the forward-looking slice never overlaps it; no LP-specific code needed here. |
| Expat Bookings / Revenue / Nights / ALOS | `Country IS NOT NULL AND Country != 'India'`, same booking/night/ALOS logic as above. **LP excluded** — neither LP table has a `Country` column at any grain. |
| ADR by Room Format | Room Revenue ÷ nights, grouped by Room Type (§1.6). **LP merged in when selected** (2026-08-26) via `sales_booking_lp_monthly_roomtype` — see §11 for the nights-allocation caveat. |
| Nights Share by Room Format | Each room type's nights ÷ total nights (no separate room-count-by-type reference exists, so this is a nights-share reading rather than a true occupancy %). LP included in both the per-type and total-nights figures when selected. |
| Revenue by Room Format & FY | Room Revenue by Room Type, grouped by FY. **Chart type changed 2026-08-24**: room type on the x-axis, one bar per FY per cluster (was: FY on x-axis, stacked by room type — stacking hid the per-segment baseline, making cross-FY comparison hard). **LP merged in when selected** (2026-08-26) — exact, not estimated (see §11). |
| **Additional Occupancy Bookings/Revenue** | **Not available.** No supporting column found across the 7 in-scope tables (PRD §3.6). Shown as an explicit placeholder, not fabricated. |
| Corporate Account Retention | For each consecutive FY pair: % of companies with `Contract_Status = 'Contract'` in the earlier FY that also appear (any status) in the later FY |
| Contract Status & Ranking | Companies ranked by `SUM(Room_Revenue)` (tax-exclusive), with `Contract_Status`, `ADR`, and Contribution %. **Merged 2026-08-24** with what used to be a separate "Nights / Revenue / ADR by Company" table — same underlying data, now one table. |
| — Contribution % | Each company's `SUM(Room_Revenue)` ÷ **total company-wide revenue across every channel** (B2B+B2C+OTA, from `sales_booking`, same Property+FY scope) — i.e. what share of Skyla's *entire* business this one B2B company represents, not its share of the B2B channel alone. Went through two earlier, narrower definitions (share of Contract-status revenue only, then share of all-B2B revenue only) before landing here 2026-08-24. |
| — "Contract revenue achieved" (summary tiles above the table) | `SUM(Room_Revenue)` **restricted to `Contract_Status = 'Contract'` rows only** — deliberately narrower than the table's Contribution %, which uses total company revenue as its base. Not to be confused with each other. |
| Top ADR Contracts | Companies ranked by `AVG(ADR)`, filtered to `SUM(Nights) > 0` |

**Company identity, 2026-08-24**: all of the above now group by `Bills_due_from`
(the operational company name, e.g. "Tata Consumer") instead of `Company`/
`Bill_To` (the legal entity name, e.g. "TATA CONSUMER PRODUCTS LIMITED") — per
business direction. `Company` and `Bill_To` are identical to each other in
every sampled row; `Bills_due_from` has ~280 distinct values vs 436 for
`Company` (several legal entities collapse under one operational name).

`b2b_bills` note: FY comes from the sheet's own `Financial_Year` column, not
recomputed from a date — a sample row with `Check_In = 2024-03-31` is labeled
`FY 24-25` in the sheet, which doesn't match the standard Apr–Mar rule (would
compute `FY 23-24`). Trusted as authoritative rather than "corrected," same
principle as `leadership_targets`. Rows labeled `FY 99-00` are a junk
placeholder for ~9,869 blank-`Property` rows and are excluded everywhere.
Property filter now applies to every `b2b_bills`-sourced KPI on this tab
(previously `getB2bContractRanking`/`getB2bTopAdrContracts`/
`getCorporateAccountRetention` silently ignored it — fixed 2026-08-24).

## 4. Trends tab

Source: `lib/bigquery/queries/trends.ts`, table `sales_booking`. Always shows
**all 3 FYs as separate series** (Month filter doesn't apply here) — the
Property filter still does. **When LP is selected** (2026-08-26), both the
monthly points (Occupancy/RevPAR/ADR trend) and the Business Category ADR
chart merge in LP's contribution from `sales_booking_lp_monthly`/
`getLpCategoryByFy` — see §11.

| Chart | Series | X-axis |
|---|---|---|
| Occupancy Trend | One line per FY | Fiscal month (Apr → Mar) |
| RevPAR Trend | One line per FY | Fiscal month |
| Month-wise ADR | One line per FY | Fiscal month |
| Business Category ADR | B2B / B2C / OTA, grouped bars | FY |

**2026-08-24 additions**: a comparison strip (whole-FY total + arrow % vs the
FY before it, `FyComparisonStrip`) now sits above the Occupancy/RevPAR/ADR
trend charts. Occupancy Trend's y-axis uses custom tick spacing — finer below
50% (5% steps), coarser above it (10% steps), `yDomain=[0,100]` — instead of
Recharts' auto ticks. All three line charts stop drawing at the first month
with no real data rather than flat-lining at 0 for the rest of the FY (a
future month with genuine advance-booked data still plots normally); see the
Revision History note.

## 5. Brand tab

Source: `lib/bigquery/queries/brandCategory.ts`, table `sales_booking`.

| Chart | Formula |
|---|---|
| Occupancy by Brand | Sold ÷ Available Room Nights, properties rolled up to Skyla / Aptly / Hyber (§1.5). **When LP is selected** (2026-08-26), its sold nights (`getLpSoldRoomNights`) are added into Aptly's total alongside BH4 — the available-nights side already includes LP automatically via §1.5's window fix. |
| Revenue by Business Category, by FY | Room Revenue by B2B/B2C/OTA (§1.3 — `Website` folded into B2C 2026-08-24), grouped by FY. Comparison strip (whole-FY total + YoY arrow) added above the chart 2026-08-24. **LP's category revenue merged in when selected** (2026-08-26) via `getLpCategoryByFy` — see §11. |

## 6. Targets tab

Source: `lib/bigquery/queries/targets.ts`, table `leadership_targets`.
**Not property-scoped** — this table has no `Property` column, so only
FY/Quarter/Month apply. `Month_Number` on this table is already fiscal
(Apr=1…Mar=12), matching quarters directly (Q1=1-3, Q2=4-6, Q3=7-9, Q4=10-12).

**Reassessed for LP, 2026-08-26 — no safe extension found, tab left
unchanged.** Checked every KPI/chart in `targets.ts` individually: `Revenue
Achievement %`, `Target`, and `B2B/B2C/OTA Achievement %` are all ratios with
`leadership_targets`'s target sum as the denominator; the three monthly
charts plot `Achieved` specifically as the numerator being compared against
that same target. There is no "achieved, independent of any target" tile
anywhere on this tab — every single figure is either a target, or an achieved
value whose entire purpose is to be read against a target. Adding LP's real
revenue to any `Achieved` figure here without a matching addition to the
`Target` side (which never existed for LP, and per the addendum never should)
would silently inflate that figure's achievement % — exactly the distortion
ruled out. §6.1's per-property table was reassessed the same way and stays
unchanged for the identical reason (adding an LP row with a real Achieved but
no Target would corrupt that table's Total row's achievement %).

| KPI / Chart | Formula |
|---|---|
| Revenue Achievement % | `SUM(Revenue_Achieved) ÷ SUM(dept_Total_Target)` |
| Target | `SUM(dept_Total_Target)` |
| Revenue Targets with Roll Over (monthly) | Three lines — `dept_Total_Target` (flat), Target-with-rollover (**recomputed in-app, not the sheet's `Target_With_Roll_Over` column** — see below), `Revenue_Achieved` — by fiscal month. **Renders one section per selected FY** (was hardcoded to a single FY regardless of the FY filter — fixed 2026-08-24). |
| B2B/B2C/OTA Achievement % | `SUM(<Cat>_Achieved) ÷ SUM(<Cat>_Target)` per category |
| ADR Target vs Achieved (monthly) | `AVG(Target_ADR)` vs `AVG(Achieved_ADR)` by fiscal month. One section per selected FY (2026-08-24). |
| Occupancy Target vs Achieved (monthly) | `AVG(Target_Occupancy_Percent)` vs `AVG(Achieved_Occupancy_Percent)` by fiscal month. One section per selected FY (2026-08-24). |

**Target-with-rollover, recomputed 2026-08-24** (`computeRollover()` in
`targets.ts`): the sheet's own `Target_With_Roll_Over` column is corrupted for
every FY's first month (verified: April came out as a few lakh, nowhere near
`dept_Total_Target`). Every other month matches exactly
`dept_Total_Target[N] + (dept_Total_Target[N-1] − Revenue_Achieved[N-1])` — a
single-month-lag carry of the *previous* month's own shortfall, not a
cumulative chain — so that's the formula used now, seeded from the prior FY's
March row when one exists (0 for the very first FY in the data). **Guard**:
once a month hasn't started yet (`isFutureFiscalMonth()`), its
target-with-rollover is just its flat `dept_Total_Target` — no carry in from
the previous month, no carry out to the next — otherwise every unstarted
month's 100% "shortfall" (since `Revenue_Achieved` is definitionally 0 for a
month that hasn't happened) cascades into the next, compounding a flat
₹28.00 Cr annual target to ₹43.71 Cr summed. With the guard, the same FY sums
to ~₹28.45 Cr, the sane relationship.

**"Target with roll-over" and "Achieved" stat tiles removed** from the
headline row (2026-08-24) — the summed annual figure reads as confusing on
its own even after the fix above; "Revenue achievement"'s sub-label already
carries "₹achieved of ₹target". The monthly chart (now fixed) is the place to
see rollover progression.

`leadership_targets` has no `Property` column, so **`Revenue Achievement`,
the B2B/B2C/OTA achievement chart, and the three monthly target-vs-achieved
charts genuinely cannot be scoped by Property** — this is a real data
constraint (the source table has no property dimension at all), not a bug. A
caption saying so was shown on the tab from 2026-08-24 to 2026-08-25 and was
then removed per user request; the constraint itself is unchanged. §6.1's
per-property table is the exception — see below.

### 6.1 Revenue targets by property (new, 2026-08-25)

Source: `lib/reference/propertyTargets.ts` (targets) +
`lib/bigquery/queries/propertyTargets.ts` (achieved, from `sales_booking`).

Unlike everything else on the dashboard, the **target** side of this table is
NOT read from BigQuery — it's a fixed, hardcoded reference table sourced from
the business's own planning workbook (`FY27 Turnover Projection.xlsx`,
provided 2026-08-25), per explicit user direction: these per-property monthly
targets (Available room-nights, Occ%, ARR, Revenue) are set once for FY 26-27
and confirmed not to change, so there was no need to build a BigQuery
pipeline for them. `leadership_targets` only ever had the already-summed
company-wide figure — this is the first time the per-property breakdown
exists anywhere in the app. Cross-checked before adding: summing all 5
properties' target revenue for any given month exactly equals that month's
`dept_Total_Target` in `leadership_targets` (verified live against BigQuery
for every month, all 9 elapsed months matched to the rupee).

| Column | Formula |
|---|---|
| Target Revenue | `SUM(revenue)` from the fixed reference table, for the selected months (whole FY if none selected) |
| Achieved Revenue | `SUM(DailyRevenue)` from `sales_booking`, same property + FY 26-27 + selected months |
| Achievement % | Achieved ÷ Target |
| Target Occ % | `SUM(available × occPct)` ÷ `SUM(available)` from the reference table (nights-weighted average across selected months) |
| Achieved Occ % | Sold Room Nights ÷ Available Room Nights (§1.5), same scope |
| Target ARR | Target Revenue ÷ target sold room-nights |
| Achieved ARR | Achieved Revenue ÷ achieved sold room-nights |

**Ignores the global FY filter** (only ever shows FY 26-27, since that's the
only FY with a per-property breakdown) but **does respect Property and Month**
— same convention as the real-time "pace" cards on Revenue Details, which
also intentionally ignore parts of the global filter that don't apply to
them. BH4 shows 0/null achieved figures for any month — this is the
already-documented pipeline gap (`propertyReference.ts`: BH4 has zero rows in
`sales_booking` as of this writing), not a bug in this feature. **LP is
deliberately not added as a row here** (2026-08-26) — the fixed reference
targets come from `FY27 Turnover Projection.xlsx`, which never covered LP (a
retired property with no forward plan), so there's no target figure to show
LP achievement against. Same principle applies to `leadership_targets`-driven
KPIs elsewhere on this tab (Revenue Achievement, B2B/B2C/OTA Achievement, the
three monthly target-vs-achieved charts) — none of them merge in LP, since
none of them have a target for it either.

**Total row, fixed 2026-08-25**: originally hardcoded Occ%/ARR to `—` in the
footer row (only Target/Achieved Revenue were summed) — looked like a broken
blank area. `getPropertyTargetComparison()` now also returns a `total`
computed from the true underlying sums (sold/available room-nights and
revenue across every included property), not by averaging each property's
own ratio — averaging Occ%/ARR ratios across properties with very different
room counts would misrepresent the combined figure. Verified: selecting a
single property makes `total` exactly equal that property's own row.

## 7. Lead Tracker tab

Source: `lib/bigquery/queries/leads.ts`, table `lead_tracker`.

**Every query starts from a mandatory baseline filter:**
`WHERE Name IS NOT NULL AND TRIM(Name) != ''`. Without it every number here is
inflated ~8× — the raw table has 45,282 rows, but the real underlying sheet
has 5,694; the rest is sync-side empty padding.

Date scoping uses the `date` column (lead capture date), not `Check_in_date_2`
(the guest's future stay date) — lead-generation KPIs are about when the lead
came in, not the eventual stay.

Property display remaps two out-of-scope codes found in this table:
**`KOND` → `KDP`** (Kondapur), **`JH44` → `JHS`** (Jubilee Hills). Rows with a
null `Property` display as the literal `"null"` bucket rather than being
dropped.

| KPI / Chart | Formula |
|---|---|
| Total Leads | `COUNT(*)` (post-baseline-filter) |
| Closed Leads | `COUNTIF(Stage = 'Closed')` |
| Conversion Rate | Closed ÷ Total |
| Revenue | `SUM(SAFE_CAST(REPLACE(Total, ',', '') AS FLOAT64))` |
| B2C Leads | `COUNTIF(Source IN ('Exotel', 'Business WA', 'Website'))` — broadened 2026-08-24 from `Exotel` only to also include WhatsApp (`Business WA`) and `Website` inquiries, all genuine B2C acquisition channels. Card sub-label now also shows "closed → XX% achieved". |
| B2C Leads Closed | Same source set, `AND Stage = 'Closed'` |
| Existing Leads Closed | `COUNTIF(Source = 'Existing' AND Stage = 'Closed')` |
| Reference Leads Closed | `COUNTIF(Source = 'Reference' AND Stage = 'Closed')` |
| Booking Pace | `AVG(Booking_Pace)` — a precomputed sheet column |
| Leads MoM | Total vs Closed, by fiscal month, for the selected FY. **Now respects the Property filter** (previously ignored it despite `lead_tracker` having a `Property` column — fixed 2026-08-24). |
| Leads by Property | Grouped by the remapped display property |
| Leads by Source | Grouped by raw `Source` |
| Format-wise Leads & Revenue | Grouped by `Format` |
| ADR by Format | `SUM(Total) ÷ SUM(No_of_nights)`, **closed leads only** |
| Lost Leads Reasons | Non-`Closed` `Stage` values, with `"Not Intersted"` (a sheet typo) folded into `"Not Interested"` |
| By Owner | Revenue, Total/Closed leads, Closed %, Exotel leads/closed, Reference, Existing leads, and ADR (`SUM(Total) ÷ SUM(No_of_nights)` on closed leads), grouped by `Owner`. **Filtered to real employee names only** (2026-08-25): `Owner` also has lead-*source* values leaking into it (`Business WA`, `Website`, `Walk in`/`walk in`) alongside the 5 real names (Anjali, Rajesh, Dikhita, Sajal, Bhanu) — `Owner` is meant to be employee-level, so those 3 are excluded (`LOWER(TRIM(Owner)) NOT IN ('business wa', 'website', 'walk in')`). Those channel names still correctly appear on **Leads by Source**, a different chart keyed off `Source` — this exclusion only applies to the Owner-grouped table. |

## 8. OTA Breakdown tab

Source: `lib/bigquery/queries/otaBreakdown.ts`, table `sales_booking`,
filtered to the OTA category (§1.3). **LP is deliberately excluded from this
tab, reconfirmed 2026-08-26**: the full column list of both LP tables was
checked directly against BigQuery's `INFORMATION_SCHEMA.COLUMNS` (§11) —
neither has an OTA-name/channel/source column, only an aggregate
`OTARevenue`/`OTANights` pair with no way to say *which* OTA. That aggregate
does surface elsewhere (Revenue Details' Revenue by Source, Brand's category
chart, §11), just never broken out by named site here. Since `sales_booking`
has zero LP rows, this tab already shows nothing for LP with no code change
needed.

| Column | Formula |
|---|---|
| Commission % | Revenue-weighted average of §1.4's per-row rate (a property can carry a different Booking.com rate than another) |
| Month Nights | `COUNT(*)` |
| Total Revenue | `SUM(DailyRevenue)` |
| Net Revenue | `SUM(DailyRevenue × (1 − commission%))` |
| Before/After Commission ADR | Total/Net Revenue ÷ Nights |
| Grand Total row | Same formulas blended across every OTA |

OTA names are canonicalized before grouping (e.g. real data has both
`"Go-MMT"` and `"go-mmt"` — these are folded into one row; the commission math
was already correct either way, this only affects the row label).

## 9. Reviews tab

Source: `lib/bigquery/queries/reviews.ts`, tables `rating_sheet` (Google) and
`ota` (OTA reviews). **Not restricted to active properties** — includes `FO`
(the café outlet, not a room property) and historical `LP` rows; only an
explicit Property selection narrows it.

| KPI / Chart | Formula |
|---|---|
| Overall Avg Rating (Google) | `AVG(Rating)` over `rating_sheet` |
| Total Reviews (Google) | `COUNT(*)` |
| Overall Avg Rating (OTA) | `AVG(SAFE_CAST(Rating AS FLOAT64))` over `ota` (`ota.Rating` is stored as a string) |
| Total Reviews (OTA) | `COUNT(*)` |
| Rating Count Trend (both) | `COUNT(*)` by fiscal month, **for the single selected FY only** |

The trend is deliberately scoped to one FY, not "one line per FY" like the
Trends tab — `rating_sheet`/`ota` hold review history back to **2013/2016**
(over a decade before `sales_booking` starts), so an unscoped trend produced a
15-series chart spanning `FY 13-14` through `FY 26-27`. §6.8 of the PRD only
specifies "monthly x-axis," not a multi-year comparison, so this tab follows
the FY filter like every other section rather than showing full history.

---

## 10. Known data caveats (accepted, not bugs)

- **BH4 has zero rows in `sales_booking`/`sales_booking_cancelled`** right
  now, despite being an Active property — confirmed as a pipeline gap, not a
  dashboard bug. Stay-based KPIs (Revenue Details, Booking Details, Trends,
  Brand, the per-property Revenue Targets table) show 0/blank for BH4; B2B,
  Leads, and Reviews are unaffected since those tables do have BH4 data.
  Known, accepted, will resolve once the eZee sync backfills. **LP had the
  same gap but it's now resolved differently** — see §11; LP will never get a
  live PMS feed (retired hotel), so its numbers come from a one-time backfill
  instead of waiting on a sync.
- **GB's active window** uses the empirical `MIN/MAX(StayDate)` in the data
  (starts 2024-04-02), not the "added mid-2026" date originally documented —
  real data contradicted that date, so the true window is used instead.
- **Extras Revenue** is F&B service charges + GST only (confirmed via a
  7-week sample) — CP/MAP plan costs are baked into Room Revenue via
  `RatePlan`, not `ExtraCharges`. Treated as the permanent scope, not pending
  further investigation.
- **Expats definition** (`Country != 'India'`) and **Repeat Booking**
  definition (contact-based matching) remain PRD-documented assumptions,
  unchanged from the original spec.
- **Generic "OTA" source label and Travex** for OTA net-revenue commission:
  "OTA" is still unresolved (0%, no rate ever supplied); Travex is now
  resolved (20% flat, confirmed).

## 11. LP (Lotus Pond) Integration (2026-08-26)

Full spec: `Skyla_Sales_Dashboard_PRD_LP_Addendum.md`. This section is the
implementation-level summary.

**Why LP is handled differently from every other property**: LP is a
permanently retired hotel with no PMS feed — it will never produce
`sales_booking` rows, now or in the future. Its real historical trading data
(Apr 2024 – Mar 2026) was backfilled and validated by the business directly
into two new BigQuery tables at **monthly grain** (not per-night like
`sales_booking`): `sales_booking_lp_monthly` (property-level monthly
aggregates) and `sales_booking_lp_monthly_roomtype` (room-type-level detail).
This is a one-time backfill; there is no pipeline that keeps it current, by
design.

**2026-08-26, second pass — extended as far as the source data safely
allows.** The initial integration (above) merged LP into Revenue Details,
Trends, and Brand, and left Booking Details, OTA Breakdown, and Targets fully
excluded as an easy, safe default. On request, each of the three exclusions
was individually reassessed against the actual column list of both LP tables
(`INFORMATION_SCHEMA.COLUMNS`, checked directly) rather than left as a
blanket policy:
- **Booking Details**: `sales_booking_lp_monthly` turned out to carry
  `BookingsCount` and `GuestServed` columns, and
  `sales_booking_lp_monthly_roomtype` carries a `RoomType` dimension — both
  usable. Extended (see below). What's still missing — guest identity,
  `Country`, cancellation records — genuinely isn't in either table, so those
  specific KPIs stay excluded.
- **OTA Breakdown**: reconfirmed no per-OTA-site column exists in either
  table (only an aggregate `OTARevenue`/`OTANights` pair) — stays excluded,
  see §8.
- **Targets**: reconfirmed every KPI on that tab is target-relative (a ratio
  or a value plotted against a target) and LP was never given a target — stays
  excluded, see §6.

**Mechanism** — `lib/bigquery/queries/lpMonthly.ts` is the single shared
module every consumer merges LP data from (`getLpOverviewTotals`,
`getLpMonthlyPoints`, `getLpCategoryByFy`, `getLpSoldRoomNights`, `getLpAdr`,
`getLpRoomTypeStats`, `getLpRoomTypeByFy`). Each consuming query file
(`overview.ts`, `trends.ts`, `brandCategory.ts`, `guestDetail.ts`) fetches its
normal `sales_booking` rows and, when LP is in the Property selection,
fetches the matching LP helper **in parallel**, then merges the two result
sets additively (via `Map` keyed on `fy|month`, `fy|category`, or
`roomType|fy`, or simple addition for single-number totals) rather than a SQL
`UNION ALL` — the addendum specifically calls for this because the two source
tables are at different grains (nightly vs monthly) and a raw union would
misrepresent LP's numbers when re-aggregated. `SAFE_DIVIDE` is used
throughout, per the addendum's rule.

**Room-type merge, with a data-quality caveat**: `sales_booking_lp_monthly_
roomtype`'s own `Nights` column does **not** reconcile with `sales_booking_
lp_monthly.SoldRoomNights` — checked directly against BigQuery across all 24
months, off by 19%–76% with no consistent ratio (a guest-nights-vs-room-
nights explanation was checked and ruled out). `TotalRevenue` and
`BookingsCount`, by contrast, reconcile exactly with the monthly table in
every single month. Rather than surface the unreconciled `Nights` figure
(which would misstate ADR and nights-share), `getLpRoomTypeStats()` allocates
each month's already-validated `SoldRoomNights` total across room types by
each type's share of that month's room-type revenue. LP has exactly one room
type ("Studio Room") in every one of its 24 months, so this allocation is
**100% exact for LP's actual data today** (a 100% revenue share resolves to
the full validated nights figure, no estimation involved) — the
revenue-weighted approach exists as a defensible fallback only if a future
backfill ever added a second room type, which the addendum doesn't expect to
happen. `getLpRoomTypeByFy()` (used for the Revenue-by-Room-Format-&-FY
chart, which needs revenue only, no nights) reads `TotalRevenue` directly —
no allocation involved, no caveat.

One foundational fix made everything else easier: `getPropertyActiveWindows()`
(`propertyWindows.ts`) now also queries `sales_booking_lp_monthly` for LP's
`MIN`/`LAST_DAY(MAX(MonthStartDate))` and merges it into the same window map
used for every other property. Because Available Room Nights / Occupancy% are
all built on top of that one function, this single change made LP's
occupancy/RevPAR correct everywhere automatically — no per-consumer changes
needed for the availability side, only for the sold-nights/revenue side.

**Where LP participates** (merged into the `sales_booking`-derived figures
when selected):
- Revenue Details: Room Revenue, Sold/Available Room Nights, Revenue by
  Source, ADR by Property (LP gets its own bar), YoY comparison.
- Trends: all three monthly trend charts (Occupancy/RevPAR/ADR), Business
  Category ADR.
- Brand: Occupancy by Brand (rolls into Aptly alongside BH4), Revenue by
  Business Category by FY.
- Booking Details (extended 2026-08-26): Total Bookings, Guests Served, ALOS,
  Revenue per Guest, Unsold Room Nights (this also **fixed a real bug** — see
  below), the B2B/B2C/OTA Night/Revenue Mix, and all three room-format
  KPIs/charts (ADR by Room Format, Nights Share by Room Format, Revenue by
  Room Format & FY) via `sales_booking_lp_monthly_roomtype`.
- The aggregate B2B/B2C/OTA split, wherever it appears above — never a
  per-OTA-site breakdown.

**Bug fixed in this pass**: `getRoomNightsGap()` (Booking Details' Unsold
Room Nights) computes `Available − Sold`. `Available` already included LP
automatically once §1.5's window fix landed (both go through the same
`getAvailableRoomNights()`), but `Sold` was still `COUNT(*)` on
`sales_booking` alone, which is always 0 for LP — so selecting LP was
silently counting 100% of its available nights as unsold, when LP actually
sold real nights (just recorded in `sales_booking_lp_monthly`). Fixed by
adding LP's real `SoldRoomNights` into the `Sold` side too. Verified: the
FY 25-26 delta between with/without LP is exactly 1,995 nights = LP's own
Available (5,840) − Sold (3,845) — the correct, LP-only unsold figure, not
5,840.

**Where LP still does NOT participate** (reassessed 2026-08-26, each for a
specific missing column, not a blanket policy):
- Booking Details' Repeat Bookings, Cancellations %, Cancellation Lead Time,
  and Expat stats — no guest-identity, cancellation, or `Country` column
  exists in either LP table at any grain. Remaining Room Nights needs no
  special handling either way: LP's entire data window (Apr 2024–Mar 2026)
  is already in the past, so it naturally never overlaps the forward-looking
  slice this KPI computes.
- OTA Breakdown tab (§8) — no per-OTA-site column in the LP data, only an
  aggregate that can't be attributed to a named OTA.
- Targets tab (§6) — no fixed target was ever set for a retired property, so
  no target-vs-achieved line is fabricated for it, on either the company-wide
  charts or the §6.1 per-property table (adding LP's real Achieved there
  without a matching Target would distort the Total row's achievement %).
- Leads (`lead_tracker`), B2B Contracts (`b2b_bills`), Reviews
  (`rating_sheet`/`ota`) — separate source tables, out of scope for this
  backfill. Each of these already had real, independent LP rows before this
  change (confirmed via BigQuery: 359/548/498+8 rows respectively) and are
  completely unaffected by it either way.

**Verified against live BigQuery** (2026-08-26): LP alone contributes ₹1.53
Cr / 3,845 nights / 5,840 available nights to FY 25-26 across the Revenue
Details/Trends/Brand functions, and this exact figure is the entire delta
between "with LP" and "without LP" runs of `getOverviewKpis` — confirming the
merge is additive with no double-counting or leakage into the 5 pre-existing
properties' figures. For Booking Details: LP's `BookingsCount` (741) and
`GuestServed` (8,410) exactly match the delta of `getBookingStats` with vs
without LP; `getRoomFormatStats` shows LP's full "Studio Room" contribution
folded into the dashboard-wide Studio Room total alongside the other
properties that also have Studio Room units; `getCategoryMix` with LP
selected reproduces the same B2B/B2C/OTA totals already verified for
Revenue Details (internally consistent, as expected — same source data).
