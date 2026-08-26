# Skyla Collective — Sales Dashboard PRD

**For:** Claude Code implementation
**Data warehouse:** BigQuery, project `skyla-analytics`, dataset `Skyla_Sales_Automation`
**Deployment:** Code pushed to Git, deployed via Vercel
**Auth:** Single shared username/password gate (no per-property RBAC in v1)

All table references below are short for `skyla-analytics.Skyla_Sales_Automation.<table>` unless stated otherwise.

> **Post-launch corrections (2026-08-24)**: several formulas below were found
> wrong or ambiguous once the built dashboard was tested against real data —
> notably the B2B Contracts formulas (§6.9, §2.2), Extras Revenue (§6.1), the
> B2B/B2C/OTA/Website category (Website removed, §3.1/§6.1/§6.4), and Targets
> rollover math (§6.5). This PRD is left as the original spec for historical
> context; the current, corrected formula for every KPI lives in
> **`Skyla_Dashboard_KPI_Logic_Reference.md`, §0 Revision History** (full
> before/after + rationale) and its per-tab sections (current truth). Inline
> pointers are added at each affected line below.
>
> **LP re-integration (2026-08-26)**: §3.3 and §7 item 5 below describe LP as
> "permanently removed" — that has changed. See
> **`Skyla_Sales_Dashboard_PRD_LP_Addendum.md`** for the full spec: LP is
> re-activated using two new, separately-backfilled monthly-grain BigQuery
> tables (`sales_booking_lp_monthly` / `sales_booking_lp_monthly_roomtype`),
> not `sales_booking` (which still has zero LP rows). Current formulas are in
> `Skyla_Dashboard_KPI_Logic_Reference.md` §1.5/§10/§11. **Extended the same
> day** to also cover Booking Details' bookings/guests/ALOS/unsold-nights and
> room-format KPIs (via `sales_booking_lp_monthly_roomtype`) — Repeat
> Bookings, Cancellations, Expat stats, OTA Breakdown, and Targets were each
> individually reassessed and confirmed to have no data support for LP, and
> remain excluded. Full detail in §11 of the KPI Logic Reference.

---

## 1. Purpose

Replace/consolidate the existing multi-sheet Looker Studio sales dashboard with a single BigQuery-backed web dashboard. Core requirement: **stay-based KPIs, viewable by month**, with Property / Financial Year / Quarter / Month filters, minimal tab count, sticky in-page navigation (tabs stay reachable while scrolling a page's content), fully responsive across device sizes.

## 2. Data Sources — 7 tables, confirmed final scope

**Only these 7 tables are in scope.** `skyla_raw`, `skyla_data`, `staging`, and any `hr_*`/`fnb_*` tables were explicitly ruled out — do not query them.

| Table | Grain | Row count (approx) |
|---|---|---|
| `sales_booking` | 1 row per occupied stay-night, active reservations | large, growing daily |
| `sales_booking_cancelled` | 1 row per occupied stay-night, cancelled reservations | large |
| `b2b_bills` | 1 row per invoice/bill line | — |
| `lead_tracker` | 1 row per lead-stage-segment (see §2.4 cleaning) | 45,282 raw / **~5,694 real** |
| `leadership_targets` | 1 row per Financial Year + Month (36 rows: FY24-25/25-26/26-27) | 36 |
| `ota` | 1 row per OTA guest review | — |
| `rating_sheet` | 1 row per Google review (hotels **and** the FO café outlet) | — |

### 2.1 `sales_booking` / `sales_booking_cancelled`

Full column reference already exists in `sales_booking_column_reference.md` (project knowledge) — use it verbatim for column meanings. Key rules to bake into every query:

- **Grain is stay-night, not booking.** `COUNT(*)` = room-nights. Use `COUNT(DISTINCT CONCAT(Property, ReservationNo))` for booking counts (Property included — `ReservationNo` isn't globally unique).
- Which table a reservation lands in is decided once per reservation (cancelled vs active) — never split across both.
- `DailyRevenue`/`DailyTotalTax`/`DailyTotalInclusiveTax` are date-exact when eZee provides a per-date rate breakdown, else an even split across the stay.
- `DailyOtherRevenueExclusiveTax`/`DailyOtherRevenueInclusiveTax` are **always** an even split — never date-exact. Confirmed contents (7-week sample, not full history — full-history confirmation was explicitly skipped per product decision): F&B service charges + GST only. Treat "Extras Revenue" as whatever is in these columns; do not assume other charge types (late checkout etc.) are captured.
- `NoOfNights` (raw API field) can be 0 for day-use bookings — don't use it for "nights sold." Count `StayDate` rows per booking instead.
- `Property` is script-computed and reliable. `Country` is guest-entered and may be blank.
- **Active property-period nuance:** GB (Gachibowli) only started producing data once its API key was added (mid-2026); LP (Lotus Pond) stopped syncing once removed from `HOTELS` (historical LP rows remain, but no new ones). Any "Available Room Nights" calculation (§3.3) must only count a property's room-nights over its actual active window, or Occupancy % will be distorted for GB (understated, if you count days before it existed) and LP (overstated, if you count days after it went inactive). **Update 2026-08-26**: LP is re-activated per `Skyla_Sales_Dashboard_PRD_LP_Addendum.md` — it still has zero `sales_booking` rows, but its real historical revenue/nights now come from a separate monthly-grain table (`sales_booking_lp_monthly`), merged in additively rather than queried from `sales_booking`. LP's active window for Available Room Nights is now sourced from that table's own `MIN/MAX(MonthStartDate)`, not from `sales_booking`.
- Known accepted risk (not being fixed for v1, per product decision): the recurring refresh is scoped by `ReservationDate` (booking creation date) 1 month back, daily 3× (8am/1pm/4pm). A booking created 3+ months ago for a future stay, cancelled today, will not be caught by refresh. Cancellation-based KPIs may lag for these edge cases.

### 2.2 `b2b_bills`

Column translation (BigQuery lost these sub-headers on import from a merged-header row in the source sheet — confirmed against a sibling tab with named columns, and against sample data):

| BigQuery column | Real meaning | Verified relationship |
|---|---|---|
| `ADR` | Tariff/ADR on the bill | — |
| `col_18` | Advance Paid | — |
| `Room_Revenue` | Room Charges | — |
| `col_20` | Room Charge Tax | ≈ `Room_Revenue × 12%` in samples |
| `col_21` | Room Charges With Tax | `= Room_Revenue + col_20` |
| `col_22` | Extra Charges With Tax | F&B/other charges on the B2B invoice |
| `col_23` | Discount | — |
| `col_24` | Adjustment | — |
| `Bills_Total` | Final bill total | `≈ col_21 + col_22 − col_23 ± col_24` |

`Contract_Status` values: blank (9,869), `Contract` (9,837), `No Contract` (5,076). `Company` is the field to use for B2B contract-level KPIs (top ADR contracts, retention).

> **Correction 2026-08-24**: group by `Bills_due_from` instead, not `Company`
> (per business direction — see KPI reference §0). `col_21` ("Room Charges
> With Tax") is no longer used for revenue figures; `Room_Revenue` (tax-exclusive)
> is used instead.

### 2.3 `leadership_targets`

Column names match the source sheet exactly, no translation needed. `Is_number` is `TRUE` for all 36 rows — a sheet-side data-quality flag that isn't currently excluding anything; safe to ignore.

### 2.4 `lead_tracker` — needs a baseline filter, always

The raw table has 45,282 rows but the real underlying sheet has ~5,694. The gap is BigQuery-side padding (the sync reads a fixed oversized range). **Every query against `lead_tracker` must start with:**

```sql
WHERE Name IS NOT NULL AND TRIM(Name) != ''
```

Confirmed this returns 5,694 rows — matches the real sheet. Do not build any `lead_tracker` KPI without this filter, or every metric (Total Leads, Conversion Rate, Lost Reasons, Booking Pace, etc.) will be inflated ~8×.

Within that clean set:
- `Stage` values: blank, `Closed`, `Low budget`, `Rejected`, `No response`, `Rental`, `Not Located`, `Non Availability`, `Not Interested`, `Lost`, `Not Intersted` (typo variant — treat as `Not Interested`), `cancel`. Blank `Stage` = open/in-progress lead, **counts toward Total Leads** (confirmed).
- **Use `Check_in_date_2`, not `check_in_date`**, for any date-based logic — `check_in_date` is free text (`"31st Oct"`, `"1sr Apr"` typos) while `Check_in_date_2` is the cleaned ISO date parsed from it. Confirmed match on every sample row.
- `Date_2`, `Month_2`, `Property_2` are exact duplicates of `date`/`Month`/`Property` — ignore them, use the base columns.
- `Total` is STRING — cast defensively: `SAFE_CAST(REPLACE(Total, ',', '') AS FLOAT64)`.
- A single lead can produce multiple rows (same `Name`/`Mobile`/`date`, different stay segments/`Check_in_date_2`) — for a true lead *count* (not row count), consider `COUNT(DISTINCT Name, Mobile, date)` where that distinction matters (flagged as a judgment call for Claude Code / the business to confirm during build — row-count is what the legacy formula used, so default to row-count unless told otherwise).

### 2.5 `ota` (OTA reviews)

- `Score` = native OTA scale (e.g. Booking.com is 0–10). `Rating` = `ROUND(Score / 2)`, normalized to a 5-point scale to match `rating_sheet.Rating`. **Use `Rating` for any cross-platform "Avg Rating" KPI**; use `Score` only when showing a single OTA's native scale.
- `Source` has inconsistent spacing (`"Booking .com"`, `"Agoda "` with trailing space) — always `TRIM(Source)` before grouping/joining.

### 2.6 `rating_sheet` (Google reviews)

Includes `Property = 'FO'` (Fond Of, an F&B/café outlet) alongside the six hotel property codes. **Confirmed: include FO** in review KPIs — don't filter it out.

---

## 3. Shared Reference Logic (build once, reuse everywhere)

### 3.1 Booking Source → Category (B2B / B2C / OTA / Website)

Port `Mapping.gs` exactly as a BigQuery lookup (SQL `CASE`/UDF or a small reference table), preserving its two-tier logic:
1. Case-insensitive exact match against the 108-source table (mirrors `booking_source_category_mapping.csv` — full table is in `Mapping.gs`).
2. Fallback pattern rules for anything unmatched: OTA name-substring patterns → OTA; `BPO`/`LUT-`/`AGR-`/`PO No`/`NPO-`/"corporate"/"relocation (b2b)" patterns → B2B; everything else → B2C. Flag unmatched sources the same way the script does (`isUnmapped = true`) so new sources surface for triage instead of silently miscategorizing.

Applies to `sales_booking.Source`, `sales_booking_cancelled.Source`, and `lead_tracker.Source`.

### 3.2 OTA Commission Rates

```
Goibibo         20%
go-mmt          20%
Travelguru      20%
Cleartrip       16%   (apply same rate to "Clear trip" spelling variant)
Agoda           17.5%
Agoda B2B       17.5%
Expedia         15%
makemytrip      20%
HyperGuest      16%
EaseMyTrip      20%
Airbnb          0%
(blank)         0%
Booking.com:  KDP 18%, HTC 18%, GB 15%, JHS 16%, BH4 → intentionally blank (0%) for now
Generic "OTA" label, "Travex" → intentionally blank (0%) for now
LP → removed entirely, not part of this table (property permanently removed, §3.3)
```
**Update 2026-08-26**: LP is re-activated (see §3.3 note below) but still has no per-OTA-site breakdown of its own — LP's OTA revenue only participates in the *aggregate* B2B/B2C/OTA split (§6.4/§6.1), never in this per-OTA-name commission table, since `sales_booking_lp_monthly` has no OTA-name column to apply a rate to.

**Confirmed decision:** BH4's Booking.com rate, and the generic "OTA"/"Travex" rows, are intentionally left blank (treated as 0%) for now rather than blocking the build — net-OTA-revenue KPIs (§6.7) will understate commission for these until real rates are supplied. Build the table as an easily-editable config (not hardcoded deep in a query) so filling these in later doesn't require touching query logic.

### 3.3 Property Reference

| Property | Brand grouping | Room count | Status |
|---|---|---|---|
| KDP | Skyla | 63 | Active |
| HTC | Skyla | 34 | Active |
| JHS | Skyla | 33 | Active |
| BH4 | Aptly | 18 | Active |
| LP | Aptly | 16 | ~~Permanently removed — historical `sales_booking` rows remain and should still count in KPIs for the periods LP was active, but LP must not appear in current/future property filters or in any "active properties" list~~ → **Re-activated 2026-08-26** per `Skyla_Sales_Dashboard_PRD_LP_Addendum.md`. LP is back in `ACTIVE_PROPERTY_CODES` and in every property filter. It still has zero `sales_booking` rows (no PMS feed, retired hotel) — its real Apr2024–Mar2026 revenue/nights come from a separately-backfilled monthly table instead. See `Skyla_Dashboard_KPI_Logic_Reference.md` §1.5/§11 for exactly which KPIs it does/doesn't participate in. |
| GB | Hyber | 21 | Active (added mid-2026 — see §2.1 active-period nuance) |

Room count × days-in-period = Available Room Nights, scoped to each property's actual active window (§2.1).

### 3.4 Room → Room Type Mapping

Use the uploaded room reference (Room name + Property → Room Type) as a static lookup table: Executive Room, Studio Room, 1 BHK, 2 BHK, Banquet, Hyber Room, Hyber Room Lite, Hyber Room Go. Join on `(Room, Property)`.

### 3.5 Financial Year

April–March, formatted `"FY YY-YY"` (e.g. FY 26-27). Implement as a shared date-to-FY function, reused across all tables with a date column.

### 3.6 Derived Definitions (inferred — confirm with business during/after build)

- **Expats:** `sales_booking.Country IS NOT NULL AND Country != 'India'`. Not explicitly confirmed by the business — flagged assumption.
- **Repeat booking:** same guest (match on `Mobile` or `Email`, fallback `GuestName`) with more than one distinct `ReservationNo`. Approximate — name/contact variations will cause undercounting.
- **Additional Occupancy Bookings/Revenue:** **no supporting column found.** The `OtherRevenue`/`ExtraCharges` investigation (7-week sample) only surfaced F&B + GST charge types, and the full-history investigation was explicitly not run (product decision to skip). **Exclude this KPI from v1**; leave a placeholder in the UI noting it's pending data confirmation rather than fabricating a number.

---

## 4. Authentication

Single shared username/password gate in front of the whole dashboard. No property-scoped or role-based access in v1.

## 5. Dashboard UX Requirements

- **Minimal tab count**, each tab holding several related KPI sections rather than one KPI per tab.
- **Sticky navigation**: tabs remain reachable while scrolling within a page (don't require scrolling back to top to switch sections).
- **Fully responsive**: usable on phone, tablet, and desktop without separate builds.
- **Filters, available globally**: Property, Financial Year, Quarter, Month. Apply consistently across every tab.
- **Monthly stay-based view**: a core "by month" view showing Revenue, Occupancy, ADR, RevPAR, and the other headline KPIs together for the selected month, not scattered across unrelated pages.
- Skyla Collective logo (attached) in the header/branding area.

## 6. KPI Catalog

Formulas are written as BigQuery-flavored expressions. All are additionally sliceable by the global filters (Property, FY, Quarter, Month) unless noted.

### 6.1 Revenue & Occupancy Overview (`sales_booking`)

| KPI | Formula |
|---|---|
| Room Revenue | `SUM(DailyRevenue)` — format to Cr/L/K per the legacy CASE logic (≥1Cr → "X.XX Cr", ≥1L → "X.XX L", ≥1K → "X.XX K") |
| Extras Revenue | ~~`SUM(DailyOtherRevenueInclusiveTax)`~~ → `SUM(DailyOtherRevenueExclusiveTax)`, corrected 2026-08-24 for tax-exclusive consistency (see §2.1 caveat — F&B + GST only, confirmed). Card removed from the dashboard entirely, same date. |
| ADR | `SUM(DailyRevenue) / COUNT(StayDate rows WHERE effectiveNights > 0)` i.e. sold room-nights |
| Occupancy % | `Sold Room Nights / Available Room Nights` (§3.3, active-period-scoped) |
| RevPAR | `SUM(DailyRevenue) / Available Room Nights` |
| Sold Room Nights | `COUNT(StayDate rows)` in `sales_booking` |
| Available Room Nights | `room_count(Property) × days in period`, active-window-scoped |
| Nights/Revenue by Source (B2B/B2C/OTA) | group by category from §3.1 (`Website` folded into B2C, corrected 2026-08-24) |
| YoY Revenue comparison | current FY room revenue vs prior FY, `▲/▼` + `%` per legacy formula |

### 6.2 Guest & Revenue Detail

| KPI | Formula |
|---|---|
| Total Bookings | `COUNT(DISTINCT Property, ReservationNo)` |
| Guests Served | `SUM(NoOfGuest)` **per unique booking** (dedupe to one row per `ReservationNo`/`Property` first — `NoOfGuest` repeats across a stay's nights, don't sum at night-grain) |
| ALOS | `COUNT(StayDate rows) / COUNT(DISTINCT Property, ReservationNo)` |
| Unsold / Remaining Room Nights | `Available − Sold`, and remaining = available nights from today forward |
| Night/Revenue Mix by Category | group by §3.1 category |
| Repeat Booking Share | §3.6 definition, as % of total bookings |
| ADR & Occ% by Room Format | join room-type mapping (§3.4), group by Room Type |
| Revenue by Room Format & FY | same join, grouped by FY |
| B2B: Nights/Revenue/ADR by Company | from `b2b_bills`, grouped by ~~`Company`~~ → `Bills_due_from` (corrected 2026-08-24). Merged into the Contract Status & Ranking table same date — no longer a separate table. |
| Expats Bookings/Revenue/Nights/ALOS | §3.6 definition, same formulas as above scoped to expat bookings |
| Cancellations % | `sales_booking_cancelled` bookings / (active + cancelled) bookings, by `ReservationNo` count |
| Lead Time for Cancellations | `CancelDate − ReservationDate` (or `− ArrivalDate`, pick one and be consistent — recommend `ArrivalDate − CancelDate` = how far ahead of the stay it was cancelled) |

### 6.3 Trends (by Financial Year)

| KPI | Formula |
|---|---|
| Occupancy Trend | Occupancy % (§6.1), one series per FY, monthly x-axis |
| RevPAR Trend | RevPAR (§6.1), one series per FY, monthly x-axis |
| Month-wise ADR | ADR (§6.1), one series per FY, monthly x-axis |
| Business Category ADR | ADR computed within each of B2B/B2C/OTA (§3.1), by FY |

### 6.4 Brand & Business Category

| KPI | Formula |
|---|---|
| Brand Occupancy % | Occupancy % (§6.1) grouped by Brand (§3.3: Skyla/Aptly/Hyber) |
| B2B/B2C/OTA Revenue by FY | `SUM(DailyRevenue)` filtered to category (§3.1 — `Website` folded into B2C, corrected 2026-08-24), grouped by FY |

### 6.5 Targets vs Achieved (`leadership_targets`)

| KPI | Formula |
|---|---|
| B2B/B2C/OTA Achievement % | `SUM(B2B_Achieved)/SUM(B2B_Target)` (same pattern for B2C, OTA) |
| Total Room Revenue Achievement % | `SUM(Revenue_Achieved)/SUM(dept_Total_Target)` |
| Revenue Targets with Roll Over | `SUM(dept_Total_Target)`, ~~`SUM(Target_With_Roll_Over)`~~, `SUM(Revenue_Achieved)` — formatted /10,000,000 (Cr). **`Target_With_Roll_Over` is corrupted for every FY's first month** (confirmed 2026-08-24) — rollover is now recomputed in-app; see KPI reference §0/§6 for the exact formula and the future-month compounding bug it also fixed. The "Target with roll-over" and "Achieved" headline stat tiles were removed the same date (the monthly chart carries this now). |
| ADR Target vs Achieved | `AVG(Target_ADR)` vs `AVG(Achieved_ADR)`, monthly x-axis |
| Occupancy Target vs Achieved | `AVG(Target_Occupancy_Percent)` vs `AVG(Achieved_Occupancy_Percent)` |
| Revenue Targets by Business Category | Achievement % per category, same pattern as row 1 |

### 6.6 Leads (`lead_tracker`, always with the §2.4 baseline filter)

| KPI | Formula |
|---|---|
| Total Leads | `COUNT(*)` (post-filter) |
| Closed Leads | `COUNTIF(Stage = 'Closed')` |
| New / B2C Leads | ~~`COUNTIF(Source = 'Exotel')`~~ → `COUNTIF(Source IN ('Exotel', 'Business WA', 'Website'))`, broadened 2026-08-24 — WhatsApp and website inquiries are B2C acquisition channels too |
| Existing Leads (Closed) | `COUNTIF(Source = 'Existing' AND Stage = 'Closed')` |
| Reference Leads (Closed) | `COUNTIF(Source = 'Reference' AND Stage = 'Closed')` |
| Revenue | `SUM(SAFE_CAST(REPLACE(Total, ',', '') AS FLOAT64))` |
| Conversion Rate | `Closed Leads / Total Leads` |
| Leads MoM | Total vs Closed, monthly x-axis (`Month`/`Month_Number`). **Now respects the Property filter** (previously ignored it — corrected 2026-08-24, `lead_tracker` has a `Property` column). |
| Leads by Property | group by `Property` |
| Leads by Source | group by `Source` |
| Format-wise Leads & Revenue | group by `Format` |
| ADR by Format | `SUM(Total WHERE Stage='Closed') / SUM(No_of_nights WHERE Stage='Closed')`, by `Format` |
| Lost Leads Reasons | breakdown of non-Closed `Stage` values as a table |
| Booking Pace | `AVG(Booking_Pace)` — already a precomputed column in the sheet |

### 6.7 OTA Breakdown (`ota` for reviews context; commission/net-revenue uses `sales_booking` + §3.2 table)

| KPI | Formula |
|---|---|
| Commission % | from §3.2 reference table, by OTA (from `sales_booking.Source`, mapped via §3.1) |
| Nights / Total Revenue | as in §6.1, filtered to OTA category, grouped by OTA name |
| Net Revenue | `Total Revenue − (Total Revenue × Commission %)` |
| Before/After Commission ADR | `Total Revenue / Nights` vs `Net Revenue / Nights` |

### 6.8 Reviews & Ratings

| KPI | Formula |
|---|---|
| Google: Avg Rating | `AVG(rating_sheet.Rating)`, property filter (FO included, §2.6) |
| Google: Rating Count trend | `COUNT(*)`, monthly x-axis |
| Google: Total Reviews | `COUNT(*)` |
| OTA: Avg Rating | `AVG(ota.Rating)` — the normalized 5-point column (§2.5), not `Score` |
| OTA: Rating Count trend | `COUNT(*)`, monthly x-axis |
| OTA: Total Ratings | `COUNT(*)` |

### 6.9 B2B Contracts (`b2b_bills`)

| KPI | Formula |
|---|---|
| B2B Contract Status & Ranking | ~~group by `Company`, rank by `SUM(col_21)` (room charges with tax)~~ → group by `Bills_due_from`, rank by `SUM(Room_Revenue)` (tax-exclusive), plus `Nights`, `ADR`, and Contribution %. Corrected 2026-08-24 (see KPI reference §0 for the full rationale and the two intermediate Contribution % definitions tried first). Merged with what used to be a separate "Nights/Revenue/ADR by Company" table, same date. |
| — Contribution % (new, 2026-08-24) | Each company's `SUM(Room_Revenue)` ÷ total company-wide revenue across **every channel** (B2B+B2C+OTA, from `sales_booking`), same Property+FY scope |
| — "Contract revenue achieved" (new, 2026-08-24) | `SUM(Room_Revenue)` restricted to `Contract_Status = 'Contract'` rows only — not the same base as Contribution % above |
| B2B Top ADR Contracts | rank ~~`Company`~~ → `Bills_due_from` (2026-08-24) by `AVG(ADR)`, filter to meaningful volume (e.g. `Nights > 0`) |
| Corporate Account Retention | annual renewal rate — `Contract_Status = 'Contract'` companies present in consecutive FYs / total companies in prior FY, grouped by `Bills_due_from` (2026-08-24). Needs a per-company per-FY rollup first. Property filter now applies here too (previously ignored — corrected 2026-08-24). |

### 6.10 Excluded from v1

- **Additional Occupancy Bookings/Revenue** — no data support (§3.6).

---

## 7. Known Data Caveats — carry into build, surface in UI where relevant

1. OTA commission table incomplete (BH4/LP Booking.com rate, Travex rate) — §3.2. Net-OTA-revenue numbers for these will be understated until rates are supplied.
2. `DailyOtherRevenue*` / Extras Revenue confirmed only for F&B + GST in a 7-week sample; full-history confirmation was explicitly skipped by product decision. Don't imply the number is a complete "all extras" figure.
3. Refresh window gap (ReservationDate-scoped, not ArrivalDate-scoped) is an accepted risk, not being fixed in v1 — cancellations of old bookings for future stays may lag.
4. Expats and Repeat Booking definitions are inferred (§3.6), not explicitly confirmed by the business.
5. ~~GB and LP need active-period-scoped Available Room Nights (§2.1, §3.3) or Occupancy %/RevPAR will be wrong for those properties.~~ → GB: unchanged, still needs its empirical active window. LP: **resolved 2026-08-26** — LP's active window now comes from `sales_booking_lp_monthly`'s own date range instead of `sales_booking` (which has none for LP). See the addendum and KPI Logic Reference §1.5.
7. **(new, 2026-08-26, extended same day)** LP participates in Revenue Details, Trends, Brand, the aggregate B2B/B2C/OTA split, and — as far as the monthly-grain data genuinely supports — Booking Details (bookings, guests, ALOS, revenue-per-guest, unsold nights, and the room-format charts via `sales_booking_lp_monthly_roomtype`). It deliberately does **not** participate in: Booking Details' guest-identity-dependent KPIs (Repeat Bookings, Cancellations %, Cancellation Lead Time, Expat stats — no such columns exist in either LP table), the per-OTA-site breakdown (no OTA-name column), or Targets vs Achieved / the per-property Revenue Targets table (§6.1) — no fabricated target line for a retired property. Leads/B2B Contracts/Reviews already had real, independent LP rows before this backfill and are unaffected by it either way. Full rules: `Skyla_Sales_Dashboard_PRD_LP_Addendum.md`, `Skyla_Dashboard_KPI_Logic_Reference.md` §11.
6. `lead_tracker` lead-vs-row-count distinction (§2.4) — default to row count per legacy formula; flag if the business wants deduped lead counts instead.

## 8. Explicitly Out of Scope

`skyla_raw.*` (pre-migration legacy dataset, including its own stale copies of `sales_booking`/`sales_booking_cancelled`), `skyla_data.fnb_*` and `skyla_raw.fnb_*` (F&B revenue — separate system/dashboard), `staging.stg_bookings`, all `hr_*` tables. Do not query or reference these.
