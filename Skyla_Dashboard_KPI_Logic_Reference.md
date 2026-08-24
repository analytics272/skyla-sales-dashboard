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
  more clearly stacked vertically than at a shallow diagonal.

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
| LP | Aptly | 16 | Permanently removed — excluded from current/future filters |

- **Available Room Nights** = room count × days in the scoped period, clamped
  to each property's *empirical* active window (`MIN`/`MAX(StayDate)` across
  `sales_booking` + `sales_booking_cancelled`), summed per selected month when
  multiple non-contiguous months are chosen.
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

Source: `lib/bigquery/queries/overview.ts`, table `sales_booking`.

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

| KPI | Formula |
|---|---|
| Total Bookings | `COUNT(DISTINCT CONCAT(Property, ReservationNo))`, excluding rows with a null `ReservationNo` |
| Guests Served | `SUM` of `MAX(NoOfGuest)` per distinct booking |
| ALOS | Sold Room Nights ÷ Total Bookings |
| Revenue per Guest | Room Revenue ÷ Guests Served |
| Repeat Bookings | Bookings sharing a guest key (`Mobile`, falling back to `Email`, then `GuestName`) with >1 distinct booking; share % = repeat ÷ total |
| Cancellations % | Cancelled bookings ÷ (active + cancelled bookings), both counted the same way as Total Bookings |
| Avg Cancellation Lead Time | `AVG(ArrivalDate − CancelDate)` in days, over `sales_booking_cancelled` |
| Unsold Room Nights | Available − Sold, for the selected scope |
| Remaining Room Nights | Available − Sold, narrowed to **[today, scope end]** — 0 if the whole scope is already in the past (implementation choice: PRD didn't give an exact "remaining" formula) |
| Expat Bookings / Revenue / Nights / ALOS | `Country IS NOT NULL AND Country != 'India'`, same booking/night/ALOS logic as above |
| ADR by Room Format | Room Revenue ÷ nights, grouped by Room Type (§1.6) |
| Nights Share by Room Format | Each room type's nights ÷ total nights (no separate room-count-by-type reference exists, so this is a nights-share reading rather than a true occupancy %) |
| Revenue by Room Format & FY | Room Revenue by Room Type, grouped by FY. **Chart type changed 2026-08-24**: room type on the x-axis, one bar per FY per cluster (was: FY on x-axis, stacked by room type — stacking hid the per-segment baseline, making cross-FY comparison hard) |
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
Property filter still does.

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
| Occupancy by Brand | Sold ÷ Available Room Nights, properties rolled up to Skyla / Aptly / Hyber (§1.5) |
| Revenue by Business Category, by FY | Room Revenue by B2B/B2C/OTA (§1.3 — `Website` folded into B2C 2026-08-24), grouped by FY. Comparison strip (whole-FY total + YoY arrow) added above the chart 2026-08-24. |

## 6. Targets tab

Source: `lib/bigquery/queries/targets.ts`, table `leadership_targets`.
**Not property-scoped** — this table has no `Property` column, so only
FY/Quarter/Month apply. `Month_Number` on this table is already fiscal
(Apr=1…Mar=12), matching quarters directly (Q1=1-3, Q2=4-6, Q3=7-9, Q4=10-12).

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
`sales_booking` as of this writing), not a bug in this feature.

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
filtered to the OTA category (§1.3).

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

- **BH4 and LP have zero rows in `sales_booking`/`sales_booking_cancelled`**
  right now, despite BH4 being an Active property — confirmed as a pipeline
  gap, not a dashboard bug. Stay-based KPIs (Revenue Details, Booking Details,
  Trends, Brand) show 0/blank for these two; B2B, Leads, and Reviews are
  unaffected since those tables do have BH4/LP data. Known, accepted, will
  resolve once the eZee sync backfills.
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
