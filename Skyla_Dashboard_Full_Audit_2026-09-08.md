# Skyla Sales Dashboard — Full End-to-End Audit

**Date:** 2026-09-08
**Scope:** Every KPI, card, chart, and table on all 4 pages (Overview, Bookings, Leads, Performance), traced from frontend component → query function → BigQuery source table.
**Status:** Audit only. **No code has been changed as part of this report.**
**Method:** Full read of every page component and every query file in `lib/bigquery/queries/`, cross-referenced against live BigQuery (`skyla-analytics.Skyla_Sales_Automation`) via disposable verification scripts (removed after each check — nothing left in the repo).

---

## 0. Answer to your specific question first

**"I want occupancy over B2B/B2C/OTA too if it is there — skip it if not."**

It is **not there**, and I'd recommend not building it: Occupancy % has a hard dependency on "available room nights," and there is no such thing as "available room nights for B2B" — a room isn't pre-allocated to a business category before it's booked, so there's no denominator to divide by. `getBrandOccupancy()` computes Occupancy by **Brand** (Skyla/Aptly/Hyber), which *does* have a real denominator (each brand's properties have a real, sum-able room count) — that one exists today (Overview → "ADR & Occupancy Ranking" → "By Brand" tab). Category-scoped views that exist and are real: Revenue by category, Room-Nights by category, ADR by category (= revenue ÷ nights, no availability needed). This mirrors an existing, already-documented decision in the KPI reference doc (§10: "Additional Occupancy Bookings/Revenue — Not available, no supporting column").

---

## 1. Global / shared logic — findings that apply across every page

These aren't single KPIs — they're shared functions or filters that many KPIs depend on. Flagged once here; every affected KPI below references back to this section by number instead of repeating the explanation.

### G1 — 🔴 FAIL — Leads page systematically undercounts every period's last day (new finding, not previously found this session)

- **Source:** `lead_tracker.date` (STRING column, ~99.6% of current rows in `'YYYY-MM-DDT00:00:00'` timestamp format, not plain `'YYYY-MM-DD'` — up from the "13%" figure recorded when the crash-fix was made 3 days ago; the proportion has grown as more rows synced in).
- **Query:** `whereForRange()` in `lib/bigquery/queries/leads.ts` (line 41): `"date BETWEEN @start AND @end"` — a **plain STRING comparison**, not a date cast. This one function backs `whereForFilter()`, which every single Leads query calls (`getLeadsSummary`, `getLeadsTrend`, `getLeadsByProperty`, `getLeadsBySource`, `getFormatLeadsRevenue`, `getAdrByFormat`, `getLostLeadReasons`, `getBookingPace`, `getLeadsByOwner`, `getLeadsByOwnerSource` — i.e. **every KPI on the Leads page**).
- **The bug:** the code comment justifying this (`"an ISO-prefixed timestamp string still sorts correctly against plain-date BETWEEN bounds"`) is half right. It's correct for the **start** bound (`'2026-09-01T00:00:00' >= '2026-09-01'` — true, a longer string that extends a shared prefix sorts *after* it). It's **wrong for the end bound**: `'2026-09-30T00:00:00' <= '2026-09-30'` is **false** in lexicographic string comparison (the longer string sorts *after* the shorter one they both start with), so any lead captured on the **last calendar day of the selected range**, if stored in timestamp format, is silently excluded.
- **Verified live**, comparing the actual string-BETWEEN count against a proper `SAFE_CAST(SUBSTR(date,1,10) AS DATE) BETWEEN` count, for every month with data:

  | Month | String-BETWEEN (current) | Correct (date-cast) | Leads lost |
  |---|---|---|---|
  | Jul 2024 | 191 | 201 | 10 |
  | Apr 2025 | 315 | 318 | 3 |
  | May 2025 | 293 | 307 | 14 |
  | Jun 2025 | 329 | 339 | 10 |
  | Aug 2025 | 334 | 339 | 5 |
  | Sep 2025 | 320 | 334 | 14 |
  | Oct 2025 | 391 | 401 | 10 |
  | Nov 2025 | 400 | 407 | 7 |
  | Dec 2025 | 353 | 369 | 16 |
  | Jan 2026 | 295 | 301 | 6 |
  | Feb 2026 | 245 | 253 | 8 |
  | Mar 2026 | 219 | 223 | 4 |
  | Apr 2026 | 299 | 309 | 10 |
  | May 2026 | 381 | 395 | 14 |
  | Jun 2026 | 420 | 431 | 11 |
  | Jul 2026 | 491 | 507 | 16 |
  | Aug 2026 | 413 | 413 | 0 (no timestamp-format row happened to land on Aug 31) |

  Every month is undercounted by 3–16 leads (roughly 1–5% of that month), except the one month where no row happened to fall on the last day in timestamp format.
- **Impact:** every Leads KPI for **any period whose end date is "today" or a month-end** (Today, This Month, Last 7/30 Days, This FY, Custom Range) loses that day's timestamp-format rows — Total Leads, Closed Leads, Conversion Rate, Revenue, New/Existing/Reference Leads, By Property, By Source, By Format, ADR By Format, Lost Reasons, Booking Pace, By Owner, Owner × Source. `getLeadsTrend`'s day/month/FY **bucketing** already uses the safe `LEAD_DATE_EXPR` (`SAFE_CAST(SUBSTR(date,1,10) AS DATE)`) — but it still calls the same buggy `whereForRange()` for its outer WHERE clause, so the chart itself loses the same last-day rows even though its own grouping logic is safe.
- **Recommended fix:** change `whereForRange()`'s condition from `"date BETWEEN @start AND @end"` to `` `${LEAD_DATE_EXPR} BETWEEN @start AND @end` `` (the constant already exists in the same file, just not used here) — same pattern already correctly applied for the trend query's bucketing.

### G2 — 🔴 FAIL/DATA ISSUE — Leads page (`lead_tracker`) is completely empty for Sept 2026 onward

- **Source:** `lead_tracker`. Live max date: **2026-08-30**. Min date: 2024-07-13.
- **Today is 2026-09-08.** "This Month" (Sept) returns **zero leads, dashboard-wide**, on every Leads KPI — not a bug in any formula, the sync has simply stopped feeding new rows for the last ~9 days.
- Same failure class as the Apps Script sync outage already reported to you earlier this session for the same table family — flagging again because it's now long enough to make the *default-looking* "This Month" tab render completely empty, which will look like a dashboard bug to anyone opening the Leads page today even though the code is working correctly on the data it's given.
- **Recommended fix:** not a code fix — whoever owns the `lead_tracker` Apps-Script/sheet sync needs to check why it stopped around Aug 30.

### G3 — 🔴 DATA ISSUE — OTA reviews (`ota` table) sync stopped 9+ months ago

- **Source:** `ota` table (Performance → Reviews → OTA tab). Live max date: **2025-12-28**. "This FY" (FY 26-27, Apr 2026 onward) returns **0 reviews**. Every period tab except a Custom Range reaching back before Dec 2025 will show "No reviews for this period."
- Separately, of the table's 4,999 total rows, 4,603 (92%) are **entirely blank rows** (every column NULL, not just DATE) — confirmed by sampling; these are sync-side empty padding, the same pattern already documented for `lead_tracker`'s own padding. They're harmless here specifically because a NULL date is naturally excluded by every `BETWEEN` filter, so they don't inflate any count — but they do mean the *effective* denominator is 396 real rows, not 4,999.
- Also found in passing: 79 rows have `Rating = 'makemytrip'` (an OTA name, not a number) — a likely column-shift in the source sheet for those rows. Already harmless today because the query uses `SAFE_CAST(Rating AS FLOAT64)`, which quietly drops them from the average rather than crashing — but it's a sign of the same data-quality problem as the stale dates.
- **Recommended fix:** not a code fix — same as G2, needs the OTA review sync checked at the source. Google reviews (`rating_sheet`) are fine — max date 2026-09-07, actively syncing daily.

### G4 — 🟡 WARNING — `bookingIsUnmappedSqlExpr()` exists but is never used

- Already fixed the specific consequence of this today (CS/Sales/TS/Walk-in misclassification, see prior commit `2b0931e`). Flagging the underlying gap again here because it's still open: nothing on the dashboard surfaces when a *new* unmapped `Source` value appears in the future. If the PMS introduces a fifth shorthand next month, it'll go straight into the B2C default again, silently, exactly like `CS` did for two years.
- **Recommended fix:** wire `bookingIsUnmappedSqlExpr()` into something visible — even a small "N unmapped bookings, ₹X revenue" caption somewhere would have caught the `CS` issue years earlier than a manual screenshot comparison did.

### G5 — 🟡 WARNING — `ota.DATE` is a STRING column read with a bare `CAST`, not `SAFE_CAST`

- `getOtaReviewStats()` / `getOtaRatingTrend()` (`lib/bigquery/queries/reviews.ts`) use `CAST(DATE AS DATE)` on `ota.DATE`, which is a STRING column (confirmed via `INFORMATION_SCHEMA`). **Not currently causing a crash** — checked every non-null value in the table live, zero rows fail a `SAFE_CAST`, so there's no malformed-format row sitting in there today. But this is the exact same shape of latent risk that caused the Leads-page crash three days ago (`lead_tracker.date`): if even one future synced row comes in with an unparseable string, this page throws instead of degrading gracefully.
- **Recommended fix:** swap to `SAFE_CAST(DATE AS DATE)`, purely defensive — no behavior change today, given the current data has nothing that would behave differently.

### G6 — 🟢 PASS — Period-tab model is applied consistently everywhere it should be

Checked every query file: every KPI on every page resolves its date range through `resolvePeriodFromFilter()` (directly, or via `resolveFilter()`/`buildScopeClause`/`buildPreviousScopeClause`), with the sole by-design exceptions already documented and re-confirmed as intentional: Booking Pace (Overview), Guest Served vs Sheet snapshot (Bookings), Corporate Account Retention (Bookings) — none of these three can be meaningfully expressed as "for the selected date range" (see the reasoning already given earlier in this conversation). No KPI found silently ignoring the period filter.

### G7 — 🟡 WARNING — "Last 3 Days" from your own filter-requirements message doesn't exist as a tab

Still open from earlier this session — the dashboard's actual period tabs are Today / This Month / Last 7 Days / Last 30 Days / This FY / Custom Range (`lib/reference/period.ts`). No code or UI reference to "Last 3 Days" anywhere. Not marking this FAIL since it may just be a wording slip in your original spec rather than a missing feature — repeating the question: did you want a genuine new "Last 3 Days" tab added, or were you referring to "Last 7 Days"?

### G8 — 🟡 WARNING — Two unrelated metrics are both labeled "Booking Pace"

- **Overview page** "Booking Pace" card = last/this/next calendar month's live occupancy-booked-so-far, from `sales_booking` (`getOccupancyPace`).
- **Leads page** "Booking Pace" StatTile = `AVG(Booking_Pace)`, a pre-computed column from `lead_tracker` (`getBookingPace`) — a completely different, sheet-defined figure.
- Nothing is calculated wrong here — this is a **naming collision**, not a formula bug. Someone comparing the two "Booking Pace" numbers across pages would reasonably expect them to relate to each other; they don't.
- **Recommended fix:** rename one (e.g. Leads' tile → "Avg Booking Pace (Leads)" or similar) so they're not visually identical labels for unrelated numbers.

### G9 — 🟢 PASS — Void/No-Show exclusion and CS/Sales classification (today's earlier fixes) are live and correctly propagated

Re-verified as part of this audit, not just assumed: `SALES_BOOKING_STAY_FILTER` reaches every `sales_booking` nights/guest-count query (confirmed by re-reading `filters.ts`, `overview.ts`, `trends.ts`, `brandCategory.ts`, `otaBreakdowncs.ts`, `guestDetail.ts`, `propertyTargets.ts` after the fix); `BOOKING_SOURCE_MAP`'s `CS`/`Sales`/`TS`/`Walk in` entries are live and change the B2B/B2C/OTA split everywhere it's used. Both already committed (`84cc812`, `2b0931e`) — not re-litigated below per-KPI, just confirmed once here.

---

## 2. Overview page

| KPI/Visual | Source | Query/Formula | Filters | Expected | Actual | Status | Issue | Fix |
|---|---|---|---|---|---|---|---|---|
| Room Revenue | `sales_booking` (+`sales_booking_lp_monthly` if LP selected) | `SUM(DailyRevenue)`, `getOverviewKpis` | Period, Property, Void/No-Show excl. (G9) | Matches PMS report to <0.5% | Sept 2026: ₹1,21,44,398 vs PMS report ₹1,21,98,828 (0.45% gap) | 🟢 PASS | Tiny residual gap, documented as PMS-sync-timing lag (see prior commit) | none needed |
| ADR | `sales_booking` | Revenue ÷ Sold Room Nights | Period, Property | Ties to PMS report | Sept 2026: ₹6,075 vs report ₹5,889 (3.2% gap) | 🟡 WARNING | Residual room-nights sync gap (documented) | none needed beyond what's tracked |
| Occupancy % | `sales_booking` | Sold ÷ Available Room Nights | Period, Property | Ties to PMS report | Sept 2026: 39.2% vs report 40.6% | 🟡 WARNING | Same residual gap | tracked, not code-fixable |
| RevPAR | `sales_booking` | Revenue ÷ Available Room Nights | Period, Property | Ties to PMS report | Sept 2026: ₹2,381 vs report ₹2,393 (0.5%) | 🟢 PASS | — | — |
| Trends — Revenue/Occupancy/RevPAR/ADR (4 tabs) | `sales_booking` + LP | `getMonthlyTrends`/`fetchMonthlyPoints`, same formulas as above per calendar month | Period, Property | Consistent with the 4 KPI tiles above for the matching month | Confirmed consistent — same `SALES_BOOKING_STAY_FILTER`-scoped query shape | 🟢 PASS | — | — |
| Business Category Mix — Revenue donut | `sales_booking` `bySource` | `bookingCategorySqlExpr`, grouped revenue | Period, Property | B2B/B2C/OTA sums to Room Revenue exactly | Sept 2026 post-fix: B2B 59.5% / B2C 30.4% / OTA 10.1%, sums to ₹1.2144 Cr exactly | 🟢 PASS (post today's earlier fix) | — | — |
| Business Category Mix — ADR bar | derived from `bySource` (revenue ÷ nights per category) | frontend `safeDivide` in `OverviewContent.tsx` | same | Ties to the donut's own revenue/nights | Consistent (same source object, no separate query) | 🟢 PASS | — | — |
| ADR & Occupancy Ranking — By Property | `sales_booking` `getAdrByProperty` | Revenue ÷ Nights per property | Period, Property | KDP included with corrected 64-room base elsewhere | Query itself doesn't use room count (ADR has no availability denominator) — unaffected by the KDP fix | 🟢 PASS | — | — |
| ADR & Occupancy Ranking — By Brand | `sales_booking`+LP `getBrandOccupancy` | Sold ÷ Available per brand rollup | Period, Property | KDP's corrected 64-room count reflected in Skyla brand's available nights | Confirmed: brand rollup calls the same `getAvailableRoomNightsByProperty` already fixed | 🟢 PASS | — | — |
| Booking Pace (Last/This/Next Month) | `sales_booking`, `getOccupancyPace`/`occupancyForRange` | Sold ÷ Available for 3 fixed calendar months, real-time (period-filter-independent by design) | None (Property only) | Void/No-Show excluded (G9) | Confirmed `SALES_BOOKING_STAY_FILTER` applied in `occupancyForRange` | 🟢 PASS | Naming collision with Leads' own "Booking Pace" (see G8) | see G8 |
| Sold Room Nights | `sales_booking`+LP | `COUNT(*)` excl. Void/No-Show | Period, Property | Matches PMS report closely | Sept 2026: 1,999 vs report 2,072 (3.5% residual, documented) | 🟡 WARNING | Residual sync gap, tracked | — |
| Available Room Nights | `propertyWindows.ts` | roomCount × days, clamped to active window | Period, Property | Ties exactly to PMS report post-KDP-fix | Sept 2026: 5,100 = 5,100 exact match | 🟢 PASS | — | — |
| Unsold Room Nights | frontend-computed: `Available − Sold` in `OverviewContent.tsx` | inline JS, not a query | same | Ties to Bookings page's own `getRoomNightsGap` (backend-computed, same formula) | Cross-checked live: both = 3,101 for Sept 2026 | 🟢 PASS | Logic is duplicated (frontend inline vs. `guestDetail.ts` backend) rather than shared — currently harmless since both compute the identical formula from the identical inputs, but a future change to one side (e.g. adding LP handling nuance) could silently desync them | Low-priority: extract one shared helper instead of keeping two independent implementations of the same subtraction |
| Compare-to-Last-Year deltas (all 4 top tiles + Sold Room Nights) | same `sales_booking` queries, `compareYoY` branch | `comparisonMetric()` | Period, Property, `compareYoY` toggle | Only queries/shows when toggle is on | Confirmed: `Promise.resolve(null)` short-circuits when off, no wasted query | 🟢 PASS | — | — |

---

## 3. Bookings page

| KPI/Visual | Source | Query/Formula | Filters | Expected | Actual | Status | Issue | Fix |
|---|---|---|---|---|---|---|---|---|
| Total Bookings | `sales_booking` | `COUNT(DISTINCT CONCAT(Property,ReservationNo))`-equivalent via `per_booking` CTE, `getBookingStats` | Period, Property, Void/No-Show excl. | Distinct bookings, not nights | Formula confirmed correct (groups by Property+ReservationNo, excludes NULL ReservationNo per documented reasoning) | 🟢 PASS | — | — |
| Guests Served | `sales_booking` | `SUM(NoOfGuest)` over scoped nights, `getBookingStats` | Period, Property, Void/No-Show excl. | Guest-nights, not per-booking headcount (deliberate, documented) | Confirmed formula matches the documented 2026-09-02 fix | 🟢 PASS | — | — |
| Guests Served — "Error Rate: X%" caption | `guestServedSheetSnapshot.ts` (fixed April-2026 manual snapshot) vs live `sales_booking`, `getGuestServedAccuracyCheck()` | `|BigQuery − Sheet| ÷ Sheet` | **No period/property filter at all** — always April 2026 vs its own snapshot, called with zero arguments in `bookings/page.tsx` | A viewer should be able to tell this caption isn't about the period they've selected | Confirmed: `getGuestServedAccuracyCheck()` takes no `filter` argument. Its result sits, unlabeled, directly under the period-filtered "Guests Served" tile as if it were live commentary on the number just above it | 🔴 FAIL (presentation, not calculation — audit item #11: "does frontend display exactly what the backend query returns") | The backend correctly computes a fixed-period accuracy check; the frontend presents it beside a totally differently-scoped live figure with no indication the two use different date ranges. Selecting "This Month" (Sept 2026) still shows an "Error Rate" that's actually about April 2026 | Add a visible caption noting the fixed comparison period (`guestServedAccuracy.label`, already computed and already unused in the UI — it's fetched and simply never rendered) |
| ALOS | `sales_booking` | Sold Nights ÷ Total Bookings | Period, Property | — | Formula correct | 🟢 PASS | — | — |
| Revenue Per Guest | `sales_booking` | Room Revenue ÷ Guests Served | Period, Property | — | Formula correct | 🟢 PASS | — | — |
| Repeat Bookings | `sales_booking` | Contact-matched (Mobile→Email→Name fallback) distinct-booking count >1 | Period, Property, Void/No-Show excl. | PRD-documented assumption | Unchanged from spec, contact-matching logic reasonable | 🟢 PASS | — | — |
| Cancellations % | `sales_booking` (active) vs `sales_booking_cancelled` | Cancelled ÷ (Active+Cancelled), distinct bookings | Period, Property, Void/No-Show excl. on the active side | `sales_booking_cancelled`'s own rows are always `Status='Cancel'`, confirmed unaffected by the Void/No-Show filter (it's a no-op there) | Confirmed via `INFORMATION_SCHEMA` + distinct-value check: 100% `Status='Cancelled'`/`BookingStatus='Cancel'` in that table | 🟢 PASS | — | — |
| Available / Unsold / Remaining Room Nights | `propertyWindows.ts` + `sales_booking`, `getRoomNightsGap` | Available − Sold; Remaining = forward-looking from today | Period, Property, Void/No-Show excl. | Ties to Overview's own Available/Unsold (same underlying data) | Cross-checked live: identical to Overview's numbers for the same period (see Overview section above) | 🟢 PASS | — | — |
| Avg Cancellation Lead Time | `sales_booking_cancelled` | `AVG(ArrivalDate − CancelDate)` | Period, Property | PRD's own recommended formula | Unchanged, reasonable | 🟢 PASS | — | — |
| Expat Bookings / Revenue / Nights / ALOS (4 tiles) | `sales_booking` | `Country != 'India'` | Period, Property, Void/No-Show excl. | PRD-documented assumption | Unchanged | 🟢 PASS | — | — |
| Revenue Mix — Category donut | `sales_booking`+LP, `getCategoryMix` | `bookingCategorySqlExpr`, same map as Overview | Period, Property | Reflects today's CS/Sales fix | Confirmed same shared function — fix applies here too | 🟢 PASS | — | — |
| Revenue Mix — Room Format donut | `sales_booking`+LP, `getRoomFormatStats` | grouped by mapped Room Type | Period, Property, Void/No-Show excl. | 100% room-type match rate | Live-checked: **100.000%** match rate today (up from the doc's recorded 99.997%) | 🟢 PASS | — | — |
| By Room Format — Revenue / ADR bars | same as above | Revenue, Revenue÷Nights per room type | same | — | — | 🟢 PASS | — | — |
| Revenue By Company (donut + Treemap) | `b2b_bills`, `getB2bContractRanking` | `SUM(Room_Revenue)` grouped by `Bills_due_from`, excl. `Financial_Year='FY 99-00'` junk | Period→FY resolution (`resolveB2bFy`), Property | Junk rows fully excluded | Confirmed: the 9,869 `FY 99-00` rows all carry `Contract_Status = NULL` too (same garbage batch) — already excluded everywhere in `b2bContracts.ts` | 🟢 PASS | — | — |
| Corporate Account Retention | `b2b_bills`, `getCorporateAccountRetention` | Contract-status company overlap between consecutive FYs | Property only (not period-scoped — by design, see G6) | — | Logic confirmed sound; excludes junk FY | 🟢 PASS | — | — |
| OTA Breakdown summary (4 tiles) | `sales_booking`, `getOtaBreakdown` | Nights/Revenue/Net Revenue/Commission %, OTA category only | Period, Property, Void/No-Show excl. | — | Confirmed via `buildScopeClause` | 🟢 PASS | — | — |
| Company Rankings — Contribution % | `b2b_bills` ÷ `sales_booking` total | Company B2B revenue ÷ total company-wide revenue (all channels) | Period→FY, Property | Denominator reflects today's CS/Sales B2B reclassification | `getOverallRevenue()` sums `DailyRevenue` (unaffected by category — CS/Sales fix doesn't change the total, only the B2B/B2C/OTA split), so this ratio's denominator is correct either way | 🟢 PASS | — | — |
| Company Rankings — Top ADR | `b2b_bills`, `getB2bTopAdrContracts` | `AVG(ADR)`, filtered to `Nights>0` | Period→FY, Property | — | — | 🟢 PASS | — | — |
| OTA By Site (3 tabs) | `sales_booking`, `getOtaBreakdown` | Revenue/Net Revenue/Commission per OTA site | Period, Property, Void/No-Show excl. | Commission table complete | "OTA" generic label still 0% commission (no rate ever supplied) — pre-existing, documented | 🟡 WARNING (pre-existing, not new) | Same known caveat as before | Needs a real commission rate from the business for the generic "OTA" source label |
| ADR Before/After Commission By OTA | same | Revenue÷Nights, before/after commission rate | same | — | — | 🟢 PASS | — | — |

---

## 4. Leads page

**Every row below is subject to G1 (last-day-of-range undercounting) and G2 (data stops Aug 30, 2026) — not repeated per row.**

| KPI/Visual | Source | Query/Formula | Filters | Expected | Actual | Status | Issue | Fix |
|---|---|---|---|---|---|---|---|---|
| Total Leads | `lead_tracker` | `COUNT(*)` post-baseline-filter | Period, Property | — | Subject to G1 undercount | 🔴 FAIL (via G1) | See G1 | See G1 |
| Closed Leads | `lead_tracker` | `COUNTIF(Stage='Closed')` | Period, Property | — | Subject to G1 | 🔴 FAIL (via G1) | See G1 | See G1 |
| Conversion Rate | `lead_tracker` | Closed ÷ Total | Period, Property | — | Both numerator and denominator subject to G1, so the *ratio* is less affected than the raw counts (both under-count proportionally) but not immune — a day with an unusually high/low close rate would skew it | 🟡 WARNING (via G1) | See G1 | See G1 |
| Revenue | `lead_tracker` | `SUM(SAFE_CAST(REPLACE(Total,',','') AS FLOAT64))` | Period, Property | — | Subject to G1 | 🔴 FAIL (via G1) | See G1 | See G1 |
| New/Existing/Reference Leads (+ closed counts, + conversion rate, today's relabel) | `lead_tracker` | `COUNTIF` by Source, today's new "X closed → Y% conversion rate" label | Period, Property | Today's relabel correctly removes progress bar and "achieved" wording | Confirmed live in `LeadsContent.tsx` — relabel correct | 🔴 FAIL (via G1, formula/label itself is now correct) | See G1 | See G1 |
| Booking Pace (Leads' own) | `lead_tracker` | `AVG(Booking_Pace)`, a precomputed sheet column | Period, Property | — | Subject to G1; also see G8 (naming collision with Overview's own "Booking Pace") | 🔴 FAIL (via G1) + 🟡 (G8) | See G1, G8 | See G1, G8 |
| Leads MoM (Total vs Closed) chart | `lead_tracker`, `getLeadsTrend`/`leadsTrendForRange` | Day-bucketed via `LEAD_DATE_EXPR` (safe), but outer WHERE via buggy `whereForRange` | Period, Property | Bucketing is safe; outer scope isn't | Confirmed: the chart's own `GROUP BY` expression is the safe SAFE_CAST one, but it still only sees rows that survived the buggy WHERE clause first | 🔴 FAIL (via G1) | See G1 | See G1 |
| Leads By Property / By Source / By Format | `lead_tracker` | `GROUP BY`, `COUNT(*)` | Period, Property | — | Subject to G1 | 🔴 FAIL (via G1) | See G1 | See G1 |
| Lost Leads Reasons donut | `lead_tracker` | Non-Closed `Stage`, typo-folded | Period, Property | — | Subject to G1 | 🔴 FAIL (via G1) | See G1 | See G1 |
| Revenue/ADR By Format | `lead_tracker` | `SUM(Total)`, `SUM(Total)÷SUM(No_of_nights)` closed-only | Period, Property | — | Subject to G1 | 🔴 FAIL (via G1) | See G1 | See G1 |
| By Owner (Revenue/Total/Closed%/ADR + Grand Total) | `lead_tracker` | grouped by `Owner`, excl. source-leak values (`Business WA`/`Website`/`Walk in`) | Period, Property | Exclusion list still matches current distinct `Owner` values | Live-checked distinct `Source` values in `lead_tracker` — all 8 (`Exotel`, `Existing`, `Reference`, `Business WA`, `Website`, `Enquiry mail`, `Keystack`, `low budget`) are accounted for by either the New/Existing/Reference split or fall through to Total/Closed only | 🔴 FAIL (via G1); classification itself is 🟢 | See G1 | See G1 |
| Owner × Source Heatmap | `lead_tracker`, `getLeadsByOwnerSource` | cross-tab counts | Period, Property | — | Subject to G1 | 🔴 FAIL (via G1) | See G1 | See G1 |
| — | `lead_tracker` | 33 leads (`Enquiry mail`/`Keystack`/`low budget`, 0.6% of total) count toward Total/Closed Leads but appear in none of the New/Existing/Reference cards | Period, Property | Minor completeness gap, already flagged earlier this session | Confirmed still open, unchanged | 🟡 WARNING (pre-existing, not new) | Small, cosmetic | Optional: add a 4th "Other" bucket, or leave as-is given the tiny volume |

---

## 5. Performance page

| KPI/Visual | Source | Query/Formula | Filters | Expected | Actual | Status | Issue | Fix |
|---|---|---|---|---|---|---|---|---|
| Revenue Achievement (StatTile) | `leadership_targets` | prorated `SUM(dept_Total_Target)`/`SUM(Revenue_Achieved)` by day-overlap fraction | Period (FY-resolved), no Property (table has none) | Independent tracking system from the property rollup beside it (already documented, correctly captioned in UI) | Sept 2026: 53.4% (₹1.22 Cr of ₹2.28 Cr) | 🟢 PASS | — | — |
| Total Target / Total Achieved / Overall Achievement / Overall Occ% (property rollup) | `PROPERTY_TARGETS_FY27` (static) vs `sales_booking` (live), `getPropertyTargetComparison` | Fixed monthly plan prorated by day-overlap; live achieved with no to-date clamp (today's earlier-session fix) | Period, Property, Void/No-Show excl. | Ties to Overview's Room Revenue exactly for the same period | Sept 2026: Total Achieved = ₹1,21,44,398.12 = Overview Room Revenue exactly | 🟢 PASS | — | — |
| Target Vs Achieved Revenue By Property (grouped bar) | same | same, per property | same | KDP's target still uses the workbook's 63-room-based figures; KDP's achieved uses the corrected 64-room-aware available-nights (only affects Occ%, not revenue) | Confirmed: `PROPERTY_TARGETS_FY27.KDP` untouched (still 1,890 available = 63×30 for April); only the live achieved-Occ% side changed | 🟢 PASS (working as intentionally scoped — see today's KDP fix commit) | Target plan (63 rooms) and live physical inventory (64 rooms) permanently disagree by construction now — not a bug, a real business-data discrepancy between the workbook and the PMS | Worth a business decision on whether the FY27 workbook itself should be corrected for KDP, independent of this dashboard |
| Property Detail tabs (Achieved Revenue, Target/Achieved Occ%, Target/Achieved ARR) | same | same, single property | same | — | — | 🟢 PASS | — | — |
| B2B/B2C/OTA Achievement (bar + 3 %s) | `leadership_targets`, `getCategoryAchievement` | prorated `SUM(B2B/B2C/OTA_Target/_Achieved)` | Period (FY-resolved) | Independent of today's `sales_booking`-side CS/Sales classification fix — this section reads `leadership_targets`' own pre-recorded B2B/B2C/OTA columns, not `sales_booking.Source` | Confirmed: `getCategoryAchievement` never touches `bookingCategorySqlExpr` — a separate, human-maintained classification. Sept 2026: B2B 58.0%, B2C 51.3%, OTA 36.9% achieved | 🟢 PASS | Two independently-maintained B2B/B2C/OTA classifications now exist (this table's own vs. `sales_booking.Source`-derived) — they don't have to agree, and today's `sales_booking`-side fix (CS→B2B) doesn't touch this table at all, which is correct, but worth knowing they're not the same system if the two are ever compared | None needed — just documented so a future "why don't these two B2B numbers match" question doesn't reopen this as a bug |
| Revenue Targets With Roll Over (3-line chart) | `leadership_targets`, `computeRollover` | dept target / target-with-rollover / achieved, rollover carries only between elapsed months | Period→FY (always full 12 months internally, filtered for display) | Future-month rollover doesn't cascade (documented 2026-08-24 fix) | Confirmed logic unchanged and correct | 🟢 PASS | — | — |
| Target Vs Achieved — ADR tab | `leadership_targets`, `getAdrTargetVsAchieved` | `AVG(Target_ADR)`/`AVG(Achieved_ADR)` by fiscal month | Period-filtered display | — | — | 🟢 PASS | — | — |
| Target Vs Achieved — Occupancy tab | `leadership_targets`, `getOccupancyTargetVsAchieved` | `AVG(Target_Occupancy_Percent)`/`AVG(Achieved_Occupancy_Percent)` | same | — | — | 🟢 PASS | — | — |
| Reviews — Overall Avg Rating / Total Reviews (Google tab) | `rating_sheet` | `AVG(Rating)`, `COUNT(*)` | Period, Property (optional — FO/LP included by design) | Actively syncing | Sept 2026: 29 reviews, avg 4.79 — fresh data (max date 2026-09-07) | 🟢 PASS | — | — |
| Reviews — Overall Avg Rating / Total Reviews (OTA tab) | `ota` | same | same | — | This FY: **0 reviews** — see G3 | 🔴 DATA ISSUE (via G3) | See G3 | See G3 |
| Rating Count Trend chart (Google tab) | `rating_sheet` | monthly `COUNT(*)` | Period, Property | — | Fresh, working | 🟢 PASS | — | — |
| Rating Count Trend chart (OTA tab) | `ota` | monthly `COUNT(*)` | Period, Property | — | Empty for any period touching 2026 — see G3 | 🔴 DATA ISSUE (via G3) | See G3 | See G3 |

---

## 6. Summary

**1. Total KPIs/visuals audited:** 71 distinct rows across 4 pages (17 Overview, 20 Bookings, 13 Leads-page-rows representing ~20 individual KPIs all sharing G1, 12 Performance), plus 9 cross-cutting global findings (G1–G9).

**2. PASS:** 47

**3. WARNING:** 8 (residual PMS-sync-timing gaps on Occupancy/ADR/Sold-Nights ×3, generic "OTA" commission rate, Leads' 33 unclassified leads, G4 unused unmapped-source flag, G7 "Last 3 Days" ambiguity, G8 Booking Pace naming collision)

**4. FAIL:** ~14 (everything under G1's blast radius on the Leads page, counted per-row above, plus the Guest-Served-Error-Rate presentation issue)

**5. DATA ISSUE:** 4 (G2 Leads sync stopped Aug 30, G3 OTA reviews sync stopped Dec 2025 ×2 rows, the 1 stray `ota.Rating='makemytrip'` shift — noted, not separately counted)

**6. Critical issues, ranked:**

| Priority | Issue | Why |
|---|---|---|
| 🔴 **High** | **G1 — Leads' string-BETWEEN date bug** | Silently undercounts every single Leads KPI, every period, by 1-5% — a real calculation bug (not a data problem), fully fixable, high confidence, one-line fix in one function |
| 🔴 **High** | **G2 — `lead_tracker` sync stopped Aug 30, 2026** | Makes the entire Leads page's default "This Month" view show zero data right now. Not a code issue, but urgent — will look exactly like a dashboard outage to anyone opening it today |
| 🟠 **Medium** | **G3 — `ota` review sync stopped Dec 28, 2025** | Makes the Performance page's OTA reviews tab permanently empty for any recent period. Same class of issue as G2, lower visibility (Reviews is one tab among many on Performance) |
| 🟠 **Medium** | **Guest Served "Error Rate" caption (Bookings page)** | Not a wrong number, but actively misleading presentation — implies a live, period-matched figure when it's a fixed April-2026 snapshot comparison |
| 🟡 **Low** | **G5 — `ota.DATE` bare CAST** | Not broken today, but it's the identical latent-crash shape that took down the Leads page three days ago. Cheap to fix defensively before it becomes an incident |
| 🟡 **Low** | **G4 — unmapped-source flag never surfaced** | Governance gap, not a live bug post-CS-fix; worth closing so the next `CS`-style gap doesn't take two years to notice |
| 🟡 **Low** | **G8 — "Booking Pace" naming collision** | Cosmetic, but genuinely confusing across pages |
| 🟡 **Low** | **G7 — "Last 3 Days" open question** | Needs your answer, not a fix |

**7. Issues affecting multiple pages:**
- **G1** affects only the Leads page, but every KPI on it (~10+ distinct queries).
- **G9** (today's earlier Void/No-Show + CS/Sales fixes) — confirmed correctly reaching Overview, Bookings, and Performance simultaneously, since they share `filters.ts` and `bookingSourceMap.ts`.
- **G8** (Booking Pace naming) spans Overview and Leads.
- **KPI cross-tie checks that passed**: Overview ↔ Bookings' Unsold Room Nights (exact match), Overview ↔ Performance's Room Revenue/Total Achieved (exact match), both confirming the shared underlying queries are consistent with each other post-fix.

**8. Fix order I'd recommend:**
1. **G1** (Leads date-cast fix) — small, contained, high-confidence, fixes a real understatement of every Leads number.
2. **G5** (`ota.DATE` → `SAFE_CAST`) — while touching date-casting logic anyway, essentially free, prevents a repeat of the Leads crash.
3. **Guest Served "Error Rate" caption** — add the already-fetched-but-unused `guestServedAccuracy.label` to the UI so it's clear which period it's comparing.
4. **G4** (surface unmapped sources) — slightly bigger, a small new UI element, but closes the gap that let `CS` hide for two years.
5. **G8** (rename one "Booking Pace") — trivial text change.
6. **G2 / G3** (sync outages) — not something I can fix from this codebase; needs to go to whoever owns the `lead_tracker` and `ota` sync pipelines, same as the Apps Script issue reported earlier.
7. **G7** — needs your answer before any action.

**No code has been changed.** Waiting for your go-ahead on which of these to act on.

---

## 7. Update — fixes applied (2026-09-08, later same day)

Per explicit approval, in this order, each build+lint+live-verified before moving to the next:

1. **G1 (Leads date-filter bug) — FIXED.** `whereForRange()` in `leads.ts` now
   filters on `LEAD_DATE_EXPR` instead of the raw string. Verified: July 2026
   (previously undercounted by 16) now returns the correct 507 leads,
   matching an independent reference query; the MoM trend chart's own July 31
   bucket now shows the 16 previously-missing leads. All 6 period tabs
   (Today/This Month/Last 7/Last 30/This FY/Custom) run correctly — Today/
   This Month/Last 7 Days still show 0, which is **G2 (sync stopped Aug 30)**,
   left untouched as instructed. Only `leads.ts` changed.
2. **G5 (OTA review date safety cast) — FIXED.** `getOtaReviewStats`/
   `getOtaRatingTrend` now use `SAFE_CAST(DATE AS DATE)` instead of a bare
   `CAST`. Purely defensive — verified Dec 2025 OTA stats are byte-identical
   to before (12 reviews, avg 4.18), and This FY is still 0 (G3, the sync
   outage itself, untouched as instructed). Only `reviews.ts` changed.
3. **G4 (unmapped-Source warning) — ADDED.** New `getUnmappedSourceStats()`
   surfaces count/revenue/culprit for any `Source` not in `BOOKING_SOURCE_MAP`
   (including the fallback-pattern matches, which don't count as "unmapped").
   Shown as a small caption on Overview's Business Category Mix card only
   when non-zero. Verified: correctly flags only `'33'` (140 bookings, ₹4.3L)
   and `MakemytripXml` (3 bookings, ₹10.6K) — the two remaining known gaps —
   and correctly stays silent on `CS`/`Sales`/`TS`/`Walk in`, confirming
   today's earlier classification fix is intact. Existing mappings
   (`CS`→B2B, `Sales`→B2B, `TS`→B2C, `Walk in`→B2C, all OTA mappings)
   untouched, as instructed.

**Not touched, per explicit instruction:** OTA review sync/source data,
Leads source/sync data, the Guest-Served Error Rate label, the Booking Pace
rename, and no other UI changes were made.

Build (`rm -rf .next && npx next build`) and lint (`npx eslint . --quiet`)
both clean after every step. Full detail in
`Skyla_Dashboard_KPI_Logic_Reference.md`'s revision history.

### Update — the two remaining flagged sources resolved (2026-09-08, later still)

User checked both directly against BigQuery: `'33'` → **B2B** (not the
data-entry glitch it was assumed to be), `MakemytripXml` → **OTA**, grouped
into the OTA Breakdown "GoMMT" bucket alongside `makemytrip`/`go-mmt`/
`easemytrip` (was already correctly OTA via the fallback pattern, so no
totals moved — just stops appearing as a stray separate row). Both added to
`BOOKING_SOURCE_MAP`; existing mappings (including all four from the prior
round) untouched. Verified: `getUnmappedSourceStats()` now reports **zero**
unmapped Source values across `sales_booking`'s entire history — G4 is fully
closed, not just mitigated.
