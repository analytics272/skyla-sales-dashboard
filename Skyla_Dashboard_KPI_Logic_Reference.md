# Skyla Collective Sales Dashboard — KPI & Chart Logic Reference

Every metric and chart in the dashboard, tab by tab, with the exact calculation
behind it: source table(s), columns, formula, and any caveat that affects how
to read the number. Source code lives in `lib/bigquery/queries/*.ts` (one file
per tab's data) and `lib/reference/*.ts` (shared lookup logic) — this document
is the plain-English mirror of that code.

**Global filters** (Property, Month, Quarter, Financial Year) apply to every
KPI below unless a note says otherwise. Property and Month are multi-select;
FY and Quarter are single-select.

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

### 1.3 Booking Source → Category (B2B / B2C / OTA / Website)
- Ported verbatim from the existing `Mapping.gs` script: a 108-entry exact-match
  table (case-insensitive), then a fallback pattern match (OTA platform names,
  `BPO`/`LUT`/`AGR`/`PO`/`NPO` prefixes → B2B, "corporate" → B2B), else B2C.
- Applies to `sales_booking.Source`, `sales_booking_cancelled.Source`, `lead_tracker.Source`.
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
| Room Revenue | `SUM(DailyRevenue)` |
| Extras Revenue | `SUM(DailyOtherRevenueInclusiveTax)` |
| ADR | Room Revenue ÷ Sold Room Nights |
| Occupancy % | Sold Room Nights ÷ Available Room Nights |
| RevPAR | Room Revenue ÷ Available Room Nights |
| Sold Room Nights | `COUNT(*)` (row grain = one occupied night) |
| Available Room Nights | see §1.5 |
| Unsold Room Nights | Available − Sold |
| Room Revenue YoY | Current FY Room Revenue vs the prior FY's, **always the full FY** regardless of any Month/Quarter narrowing — YoY is a year-level comparison by design |
| Revenue by Source | Room Revenue grouped by B2B/B2C/OTA/Website (§1.3) |
| Room Nights by Source | Sold Room Nights grouped the same way |

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
| Revenue by Room Format & FY | Room Revenue by Room Type, grouped by FY |
| **Additional Occupancy Bookings/Revenue** | **Not available.** No supporting column found across the 7 in-scope tables (PRD §3.6). Shown as an explicit placeholder, not fabricated. |
| Corporate Account Retention | For each consecutive FY pair: % of companies with `Contract_Status = 'Contract'` in the earlier FY that also appear (any status) in the later FY |
| Contract Status & Ranking | Companies ranked by `SUM(col_21)` ("Room Charges With Tax"), with their `Contract_Status` |
| Top ADR Contracts | Companies ranked by `AVG(ADR)`, filtered to `SUM(Nights) > 0` |
| Nights / Revenue / ADR by Company | `SUM(Nights)`, `SUM(col_21)`, and their ratio, from `b2b_bills`, scoped by Property + FY only (`b2b_bills` has no per-row date to filter by Month) |

`b2b_bills` note: FY comes from the sheet's own `Financial_Year` column, not
recomputed from a date — a sample row with `Check_In = 2024-03-31` is labeled
`FY 24-25` in the sheet, which doesn't match the standard Apr–Mar rule (would
compute `FY 23-24`). Trusted as authoritative rather than "corrected," same
principle as `leadership_targets`. Rows labeled `FY 99-00` are a junk
placeholder for ~9,869 blank-`Property` rows and are excluded everywhere.

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

## 5. Brand tab

Source: `lib/bigquery/queries/brandCategory.ts`, table `sales_booking`.

| Chart | Formula |
|---|---|
| Occupancy by Brand | Sold ÷ Available Room Nights, properties rolled up to Skyla / Aptly / Hyber (§1.5) |
| Revenue by Business Category, by FY | Room Revenue by B2B/B2C/OTA/Website (§1.3), grouped by FY |

## 6. Targets tab

Source: `lib/bigquery/queries/targets.ts`, table `leadership_targets`.
**Not property-scoped** — this table has no `Property` column, so only
FY/Quarter/Month apply. `Month_Number` on this table is already fiscal
(Apr=1…Mar=12), matching quarters directly (Q1=1-3, Q2=4-6, Q3=7-9, Q4=10-12).

| KPI / Chart | Formula |
|---|---|
| Revenue Achievement % | `SUM(Revenue_Achieved) ÷ SUM(dept_Total_Target)` |
| Target / Target with Roll-over / Achieved | `SUM(dept_Total_Target)`, `SUM(Target_With_Roll_Over)`, `SUM(Revenue_Achieved)` |
| B2B/B2C/OTA Achievement % | `SUM(<Cat>_Achieved) ÷ SUM(<Cat>_Target)` per category |
| Revenue Targets with Roll Over (monthly) | Three lines — `dept_Total_Target`, `Target_With_Roll_Over`, `Revenue_Achieved` — by fiscal month, one FY at a time |
| ADR Target vs Achieved (monthly) | `AVG(Target_ADR)` vs `AVG(Achieved_ADR)` by fiscal month |
| Occupancy Target vs Achieved (monthly) | `AVG(Target_Occupancy_Percent)` vs `AVG(Achieved_Occupancy_Percent)` by fiscal month |

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
| B2C Leads | `COUNTIF(Source = 'Exotel')` |
| B2C Leads Closed | `COUNTIF(Source = 'Exotel' AND Stage = 'Closed')` |
| Existing Leads Closed | `COUNTIF(Source = 'Existing' AND Stage = 'Closed')` |
| Reference Leads Closed | `COUNTIF(Source = 'Reference' AND Stage = 'Closed')` |
| Booking Pace | `AVG(Booking_Pace)` — a precomputed sheet column |
| Leads MoM | Total vs Closed, by fiscal month, for the selected FY |
| Leads by Property | Grouped by the remapped display property |
| Leads by Source | Grouped by raw `Source` |
| Format-wise Leads & Revenue | Grouped by `Format` |
| ADR by Format | `SUM(Total) ÷ SUM(No_of_nights)`, **closed leads only** |
| Lost Leads Reasons | Non-`Closed` `Stage` values, with `"Not Intersted"` (a sheet typo) folded into `"Not Interested"` |
| By Owner | Revenue, Total/Closed leads, Closed %, Exotel leads/closed, Reference, Existing leads, and ADR (`SUM(Total) ÷ SUM(No_of_nights)` on closed leads), grouped by `Owner` |

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
