# HANDOVER — Skyla Analytics (Pipeline status + Sales Dashboard PRD)

**Project:** skyla-analytics / BigQuery dataset `Skyla_Sales_Automation`
**This doc supersedes the previous HANDOVER.md** — Part A carries forward the prior pipeline session in condensed form (with updated statuses), Part B documents this session's dashboard-PRD work in full. Upload this file to Project Knowledge in place of the old one.

---

# PART A — eZee → BigQuery Pipeline (carried over, statuses updated)

## A.1 Config.gs — current state (unchanged from before)

- `BQ_DATASET_ID` = `Skyla_Sales_Automation` (project `skyla-analytics`), tables `sales_booking` / `sales_booking_cancelled`.
- All 5 hotel API keys rotated; old keys dead.
- `HOTELS` includes hotel code **212 = Gachibowli (GB)** — confirmed correct via live API data.
- Hotel code **7931 = Lotus Pond (LP)** removed from `HOTELS` (inactive, not in new key list). Historical LP rows untouched in BigQuery; no new syncs.
- `Code.gs` needed no changes (fully parameterized).

## A.2 `sales_booking_cancelled` table — ✅ RESOLVED

Previously accidentally deleted. **Confirmed fixed and backfilled** this session (user-reported) — table recreated, `loadHistoricalBookings()` re-run successfully.

## A.3 Recurring refresh (`RefreshRecent.gs`) — ✅ LIVE, gap accepted as-is

- `refreshRecentBookings()`: re-syncs `ReservationDate` from 1st of previous calendar month through today.
- `setupRefreshTriggers()`: 3 daily triggers (8am, 1pm, 4pm) — **confirmed live** this session.
- **Known gap, explicitly accepted (not being fixed):** refresh window is scoped by `ReservationDate` (booking creation date), not arrival/stay date. A booking created 3+ months ago for a future stay, cancelled today, won't be caught. `ArrivalFrom`/`ArrivalTo` API parameters exist as a possible future fix but the product decision this session was to leave the current design as-is and treat this as an accepted risk. Documented in the dashboard PRD (Part B, §7) as a caveat rather than a blocker.

## A.4 Column data dictionary — done, unchanged

`sales_booking_column_reference.md` in Project Knowledge is still accurate — full column-by-column reference for `sales_booking`/`sales_booking_cancelled`, sourced from eZee API docs cross-checked against `Code.gs`. No updates needed.

## A.5 OtherRevenue / ExtraCharges investigation — ✅ CLOSED (by decision, not by completing the investigation)

Prior status was "OPEN — full-history run needed." **This session's decision: skip the full-history run, build on what's confirmed.** Confirmed scope stands at: 7-week sample (2026-07-01 → 2026-08-19, all 5 properties), reconciliation `OtherRevenue = sum(ExtraCharges)` exact, only charge types observed were F&B Service + CGST @ 9%. CP/MAP confirmed to live inside `RatePlan` naming, not `ExtraCharges` — baked into room revenue, not `OtherRevenue`. This is now treated as the permanent scope of "Extras Revenue" in the dashboard, not a placeholder pending further investigation — flagged as a caveat in the PRD, not an open task.

---

# PART B — Sales Dashboard PRD (this session, full detail)

## B.1 Session goal

Scope and write a PRD for a new BigQuery-backed sales dashboard (to replace/consolidate the existing multi-sheet Looker Studio dashboard), for implementation by Claude Code and deployment via Vercel. Requirements gathered: stay-based KPIs viewable by month; Property / Financial Year / Quarter / Month filters; minimal tab count with sticky in-page navigation; fully responsive; single shared username/password login; Skyla Collective branding.

## B.2 Data scope — narrowed from 24 tables across 4 datasets down to 7

Running `INFORMATION_SCHEMA.COLUMNS` against the whole `skyla-analytics` project (not just the one dataset) surfaced **24 tables across 4 datasets** — far more than the pipeline docs had described. After review, **final confirmed scope is 7 tables, all in `Skyla_Sales_Automation`:**

`sales_booking`, `sales_booking_cancelled`, `b2b_bills`, `lead_tracker`, `leadership_targets`, `ota`, `rating_sheet`.

**Explicitly excluded, confirmed out of scope:**
- `skyla_raw` dataset — pre-migration legacy dataset (from before the `skyla_raw` → `Skyla_Sales_Automation` migration in Part A). Contains its own stale copies of `sales_booking`/`sales_booking_cancelled` (different schema — DATE-typed columns and INT64 guest-count fields, vs. the live tables' STRING/FLOAT64), plus `sales_transaction_table` (a richer charge-level table, unused), plus `hr_*` tables, plus a partial set of `fnb_*` tables.
- `skyla_data` dataset — a second, apparently-active F&B revenue/target pipeline (`fnb_item_sale`, `fnb_menu_final`, `fnb_monthly_targets`, `fnb_monthly_targets_roll_over`, `fnb_order_pax`, `fnb_sale`, `fnb_targets`). Out of scope for this dashboard — F&B is a separate system/dashboard.
- `staging.stg_bookings` — a differently-aggregated bookings view (`booking_category`, `room_value`, `total_revenue`, `per_night_rate`). Not used.

## B.3 Per-table findings, verified against source Google Sheets (not just BigQuery schema)

Drive access was used to cross-check ambiguous BigQuery columns against their original Google Sheets, since several columns lost their real names on import.

### `sales_booking` / `sales_booking_cancelled`
No new findings — column reference doc (Part A.4) already covers this table fully.

### `b2b_bills`
Six unnamed FLOAT columns (`col_18`, `col_20`–`col_24`) were merged-header artifacts. Resolved by finding a sibling tab in the source `B2B Biz` Google Sheet with the same column positions but real headers, then validating against sample row data (e.g. `col_20 ≈ Room_Revenue × 12%` held across every sample row):

| BigQuery column | Real meaning |
|---|---|
| `col_18` | Advance Paid |
| `col_20` | Room Charge Tax |
| `col_21` | Room Charges With Tax (`Room_Revenue + col_20`) |
| `col_22` | Extra Charges With Tax |
| `col_23` | Discount |
| `col_24` | Adjustment |

`Contract_Status` distinct values: blank (9,869 rows), `Contract` (9,837), `No Contract` (5,076). `Company` field confirmed usable for B2B contract-level KPIs.

### `lead_tracker` — data quality issue found and fixed
BigQuery table has 45,282 rows; the real underlying sheet has ~5,694. Confirmed via query that `WHERE Name IS NOT NULL AND TRIM(Name) != ''` returns **5,694** rows — matching the real sheet almost exactly. The other ~39,587 rows are sync-side empty padding (the sheet-to-BigQuery sync reads a fixed oversized range), **not** real blank leads. **This filter is now a mandatory baseline for every `lead_tracker` query** — without it, every lead-based KPI (Total Leads, Conversion Rate, Booking Pace, Lost Reasons, etc.) would be inflated roughly 8×.

Also resolved, by reading the source `Skyla Revenue Sheets Master` sheet directly: the table has duplicate-looking columns (`Check_in_date_2`, `Date_2`, `Month_2`, `Property_2`) that are actually a cleanup pass built into the sheet itself — `Check_in_date_2` is a properly-parsed ISO date version of the messy free-text `check_in_date` (e.g. `"31st Oct"` → `2025-10-31`), confirmed correct on every sample row, and should be used for any date logic. `Date_2`/`Month_2`/`Property_2` are pure duplicates of `date`/`Month`/`Property` with no cleanup value.

`Stage` distinct values (within the 5,694 clean rows): blank (open/in-progress — **confirmed counts toward Total Leads**), `Closed`, `Low budget`, `Rejected`, `No response`, `Rental`, `Not Located`, `Non Availability`, `Not Interested`, `Lost`, `Not Intersted` (typo, treat as `Not Interested`), `cancel`.

`Total` is STRING — needs `SAFE_CAST(REPLACE(Total, ',', '') AS FLOAT64)` before aggregating.

### `leadership_targets`
`Is_number` is `TRUE` for all 36 rows (3 financial years × 12 months) — a sheet-side data-quality flag that isn't currently excluding anything. No action needed.

### `ota` (OTA reviews)
`Score` is the OTA's native scale (Booking.com uses 0–10). `Rating` = `ROUND(Score / 2)`, confirmed on sample data — a 5-point normalization so it lines up with `rating_sheet.Rating`. **Use `Rating` for any cross-platform average**, `Score` only for single-OTA native-scale views. `Source` values have inconsistent spacing (`"Booking .com"`, `"Agoda "` with trailing space) — needs `TRIM()` before grouping.

### `rating_sheet` (Google reviews)
Mixes hotel property reviews (KDP/HTC/JHS/BH4/LP/GB) with reviews for `Property = 'FO'` (Fond Of — an F&B/café outlet, not a room property). **Decision: include FO** in the dashboard's review KPIs.

## B.4 Business logic confirmed/built this session

- **Booking source → category (B2B/B2C/OTA/Website):** ports directly from the existing `Mapping.gs` script (108-source exact-match table + pattern-based fallback) — no changes needed, applies to `sales_booking.Source`, `sales_booking_cancelled.Source`, and `lead_tracker.Source`.
- **OTA commission table:** built from a provided spreadsheet formula. Complete for Goibibo, go-mmt, Travelguru, Cleartrip, Agoda, Agoda B2B, Expedia, makemytrip, HyperGuest, EaseMyTrip, Airbnb (0%), and Booking.com at KDP/HTC/GB/JHS. **Gap, still open:** no Booking.com rate for BH4/LP, and no rate for the generic "OTA" label or "Travex". Documented as a placeholder (0%) in the PRD, easy to update once supplied.
- **Property reference:** Brand grouping (KDP/HTC/JHS = Skyla, BH4/LP = Aptly, GB = Hyber) and room counts (KDP 63, HTC 34, JHS 33, BH4 18, LP 16, GB 21) from a provided formula, now in the PRD. Flagged nuance: Available Room Nights calculations must be scoped to each property's actual active window (GB added mid-2026, LP inactive since removal from `HOTELS`) or Occupancy%/RevPAR will be distorted for those two properties.
- **Room → Room Type mapping:** static lookup from the uploaded room reference file (Executive Room, Studio Room, 1 BHK, 2 BHK, Banquet, Hyber Room, Hyber Room Lite, Hyber Room Go), keyed on `(Room, Property)`.
- **Expats definition:** `Country != 'India'` on `sales_booking` — inferred, not explicitly confirmed by the business. Flagged as an assumption.
- **Repeat booking definition:** same guest via `Mobile`/`Email` (fallback `GuestName`) across multiple `ReservationNo` — approximate, flagged as an assumption.
- **"Additional Occupancy Bookings/Revenue" KPI: excluded from v1.** No supporting column found anywhere across the 7 tables; the `OtherRevenue`/`ExtraCharges` investigation (Part A.5) only ever surfaced F&B + GST.

## B.5 Decisions made this session

| Decision | Answer |
|---|---|
| KPI data scope | Cover all KPIs supportable by the 7 confirmed tables (not just PMS) |
| Login model | Single shared username/password for everyone |
| HANDOVER open items (cancelled table, refresh window, OtherRevenue) | Cancelled table: done. Refresh window: live as designed, gap accepted. OtherRevenue: stop investigating, build on F&B+GST scope as final. |
| `rating_sheet` FO rows | Include FO in review KPIs |
| `lead_tracker` blank-Stage rows | Count toward Total Leads (within the 5,694-row clean filter) |

## B.6 Deliverable produced this session

**`Skyla_Sales_Dashboard_PRD.md`** — the full PRD for Claude Code, containing:
1. Purpose and the 7-table data scope (with everything in B.2–B.4 above).
2. Per-table reference (grain, keys, gotchas) for all 7 tables.
3. Shared reference logic (source→category mapping, OTA commission table, property/room reference, FY logic, derived definitions).
4. Auth and UX requirements (sticky tabs, responsive, global filters, monthly stay-based view).
5. Full KPI catalog with BigQuery-flavored formulas, organized into 10 sections: Revenue & Occupancy Overview, Guest & Revenue Detail, Trends by FY, Brand & Business Category, Targets vs Achieved, Leads, OTA Breakdown, Reviews & Ratings, B2B Contracts, and an explicit "Excluded from v1" section.
6. Known data caveats (6 items, matching B.4/B.2 above) and explicitly-out-of-scope tables (matching B.2).

This file was delivered to the user as a download — **not yet handed to Claude Code for implementation.**

## Files produced this session

- `Skyla_Sales_Dashboard_PRD.md` (the PRD itself)
- This updated `HANDOVER.md`

## Open items, in priority order

1. **Supply the missing OTA commission rates** — BH4/LP Booking.com rate, Travex rate (§B.4) — needed before OTA net-revenue KPIs are fully accurate. Currently placeholdered at 0%.
2. **Hand `Skyla_Sales_Dashboard_PRD.md` to Claude Code** to begin actual implementation.
3. Confirm/adjust the inferred business definitions before they ship: Expats (`Country != 'India'`), Repeat Booking (contact-based matching), and whether `lead_tracker`'s "Total Leads" should be row-count (current PRD default, matches legacy formula) or a deduped lead count (a single lead can produce multiple rows for different stay segments).
4. No pipeline items remain open from Part A — all resolved or explicitly accepted as-is this session.
