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

**2026-08-26 (later still — same day):**
- **`getCategoryMix` wired into the Booking Details UI.** The B2B/B2C/OTA
  Night/Revenue Mix query existed and was made LP-correct in the prior entry,
  but was never actually rendered anywhere. Added to
  `app/(dashboard)/booking/page.tsx`'s existing data-fetch and rendered in
  `BookingContent.tsx` as a new "Night/Revenue Mix By Category" section
  (Revenue/Nights/ADR by category, three bar charts). Uses the page's
  existing Property/FY/Month filters — no new filter plumbing. See §3.

**2026-08-27:**
- **Lead Tracker "By Owner" gained a Grand Total row.** `getLeadsByOwner()`
  now returns `{rows, total}` — `total` is computed from summed underlying
  counts/revenue, not by averaging each owner's Closed %/ADR. See §7.
- **OTA Breakdown: EaseMyTrip, MakeMyTrip, and go-mmt combined into one
  "GoMMT" row**, per user direction — a display-grouping change only (all
  three were already OTA-category and already shared the same 20% commission
  rate). See §8.
- **Booking Details gained an "Available Room Nights" stat tile.** No new
  query — `getRoomNightsGap()` already computed this value internally via the
  existing `getAvailableRoomNights()` (§1.5) to derive Unsold/Remaining Room
  Nights; it now also returns that figure so it can sit alongside them.
  Verified identical to a direct `getAvailableRoomNights()` call for the same
  scope. See §3.

**2026-09-02 through 2026-09-07 (not individually logged here — see
`lib/reference/period.ts`'s docstring for the full history):** the dashboard's
global filtering moved from the old multi-select Property/Month/Quarter/FY
model this section still describes to a single-select **period-tab** model —
Today / This Month / Last 7 Days / Last 30 Days / This FY / Custom Range,
plus an opt-in `compareYoY` toggle (off = compare to the immediately
preceding window of the same length; on = the same window one year back).
Every tab now means exactly what typing its own bounds as Custom Range would
mean — no tab silently truncates at "today." Below and throughout this
document, treat any mention of "Month/Quarter/FY filter" or "always the full
FY regardless of Month/Quarter" as describing the pre-redesign model; the
underlying formulas (Room Revenue = `SUM(DailyRevenue)`, Occupancy % = Sold ÷
Available, etc.) are unchanged, only how the date range is chosen is
different. This doc's tab-by-tab sections have not all been reworded for the
new filter yet — `period.ts` and each query file's own comments are the
authoritative source in the meantime.

**2026-09-08:**
- **Real bug, dashboard-wide: Sold Room Nights (and everything derived from
  it — Occupancy %, ADR, RevPAR) was inflated by `COUNT(*)`-counting rows
  that never represented an actual occupied room.** Found while cross-checking
  the Overview page against the business's own PMS Annual Sales Report for
  September 2026 (user-provided): `sales_booking` carries a `BookingStatus`
  column, and two of its values — `Void` (a corrected/rebooked folio; the
  superseded row is left in the table marked Void) and `No Show` (guest never
  arrived) — are 100% `DailyRevenue = 0` across the entire table (2,635 Void +
  64 No Show rows, confirmed live, zero of them carrying any revenue) but were
  never excluded from any `COUNT(*)` "nights" query. Revenue figures were
  therefore always correct (₹0 either way); every nights-derived figure
  wasn't. Reproduced for Sept 2026: BigQuery counted 800 KDP room-nights
  against the PMS report's 748 actual occupied rooms (148 Void + No Show rows
  dashboard-wide that month). **Fixed once, centrally**: `BookingStatus NOT
  IN ('Void', 'No Show')` is now baked into `scopeClauseForRange()`
  (`lib/bigquery/queries/filters.ts`, exported as `SALES_BOOKING_STAY_FILTER`
  for the handful of call sites that build their own raw WHERE clause instead
  of going through `buildScopeClause`/`buildPreviousScopeClause`) — reaches
  every `sales_booking` nights query dashboard-wide: Overview (§2), Property
  Targets' achieved side (§6.1), Trends (§4), Brand (§5), OTA Breakdown (§8),
  Booking Details (§3, including the Guest-Served-vs-sheet accuracy check,
  which sums `NoOfGuest` and was also inflated the same way), and Booking
  Pace. A small residual gap against the PMS report remains after this fix
  (Sept 2026: BigQuery ~1,999 nights vs the report's 2,072, split
  inconsistently by property — some over, some under) — that remainder looks
  like ordinary PMS-to-BigQuery sync timing lag, not a further logic bug; see
  §10.
- **KDP room count corrected 63 → 64** in `lib/reference/propertyReference.ts`
  — the same PMS report shows KDP's "Rooms Available" as 64 rooms × days in
  the month for all 12 of its months (Sep 2026 – Aug 2027 — e.g. 1,920 = 64×30
  for September), not 63. This only affects the *live* Available Room Nights
  figure (Occupancy %, ADR, RevPAR); the fixed FY 26-27 target sheet in
  `lib/reference/propertyTargets.ts` still uses its own workbook-confirmed
  63-based `available` figures per §6.1's "targets are static, not read from
  BigQuery" rule — the planning workbook and the PMS's physical room count
  simply disagree by one room for KDP, and the live side is the one that
  should match the PMS.
- **Lead Tracker's New/Existing/Reference Leads tiles (§7) relabeled**: the
  "X closed → Y% achieved" caption with a progress bar is now "X closed → Y%
  conversion rate" with no bar — there's no target being "achieved" here
  (this isn't the FY 26-27 target-vs-actual context §6.1's progress bars
  describe), just closed ÷ total for that lead segment, the same basis as the
  top-row Conversion Rate KPI (§7) narrowed to one segment. A progress bar
  implies progress toward a goal, which doesn't apply to a plain rate.

**2026-09-08 (later, same day) — real bug, dashboard-wide: 26.9% of all-time
`sales_booking` revenue was silently misclassified by B2B/B2C/OTA category.**
Found while investigating why Overview's "Business Category Mix" donut
(§2/§1.3) looked wrong. `classifyBookingSource()`/`bookingCategorySqlExpr()`
(`lib/reference/bookingSourceMap.ts`) match a booking's raw `Source` text
against `BOOKING_SOURCE_MAP` (ported from the original `Mapping.gs`), then
fall back to a handful of pattern regexes, then default to `'B2C'` for
anything that matches neither — silently, with no error and no visible flag
(a `bookingIsUnmappedSqlExpr()` triage helper existed for exactly this but
was never actually wired into any query or UI). Four real `Source` values in
the live data weren't in the original map and were falling through to that
default:

| Raw Source | All-time revenue | Was defaulting to | User-confirmed meaning | Now maps to |
|---|---|---|---|---|
| `CS` | ₹12.6 Cr (22.7% of all revenue) | B2C | shorthand for "Corporate Sales" | **B2B** |
| `TS` | ₹1.36 Cr (2.4%) | B2C | shorthand for "Tele Sales" | B2C (no change) |
| `Sales` | ₹91.5 L (1.6%) | B2C | shorthand for "Corporate Sales" | **B2B** |
| `Walk in` (no hyphen — `Walk-in` was already mapped) | ₹1.9 L | B2C | same as `Walk-in` | B2C (no change) |

`CS` alone is not a small edge case — confirmed NOT a rename-over-time
artifact (it runs in parallel with the full "Corporate Sales" label every
single month from Apr 2024 through Sept 2026, neither ever replacing the
other; both are shorthand-vs-full-name labels for the same real channel,
entered inconsistently depending on who logs the booking). Verified live:
before this fix, Sept 2026's live B2B revenue (₹51.5L, from `sales_booking`)
was 29% off the independently-tracked `leadership_targets.B2B_Achieved`
figure for that month (₹72.7L); after moving `CS`/`Sales` to B2B, live B2B
revenue is ₹72.2L — within 0.6%. Fixed in `BOOKING_SOURCE_MAP` directly
(`lib/reference/bookingSourceMap.ts`) — reaches every chart/KPI that groups
by B2B/B2C/OTA category dashboard-wide: Business Category Mix and Revenue/
Room-Nights by Source (§2), Business Category ADR (§4), Occupancy by Brand
(§5), Category Achievement (§6.1), and B2B Contribution % (§ B2B section,
since its denominator is total company-wide `sales_booking` revenue by
category). Also found and left unfixed, out of scope for this pass: a
`Source = '33'` garbage value (₹4.3L, obviously a data-entry glitch, still
silently defaulting to B2C — too small to chase further) and 33 `lead_tracker`
leads (`Enquiry mail`/`Keystack`/`low budget` sources, ~0.6% of all leads)
that count toward Total/Closed Leads (§7) but don't appear in any of the New/
Existing/Reference per-segment breakdown cards.

**2026-09-08 (later still, same day) — three fixes from a full end-to-end
dashboard audit** (`Skyla_Dashboard_Full_Audit_2026-09-08.md`, findings G1/G4/G5):

1. **Real bug, Leads page (§7): every KPI undercounted the last day of every
   selected period by 1-5%.** `whereForRange()` (`lib/bigquery/queries/leads.ts`)
   compared `lead_tracker.date` (a STRING column) as a plain string against
   `@start`/`@end` instead of casting it — correct for the start bound
   (`'2026-09-01T00:00:00' >= '2026-09-01'` holds) but wrong for the end bound
   (`'2026-09-30T00:00:00' <= '2026-09-30'` does NOT hold in lexicographic
   string comparison — the longer, timestamp-format string sorts *after* the
   plain-date bound it shares a prefix with). Verified live across every
   month with data (Jul 2024 - Jul 2026): every month undercounted Total
   Leads by 3-16 rows except one where no timestamp-format row happened to
   land on the last day. Fixed by using the file's own existing
   `LEAD_DATE_EXPR` (`SAFE_CAST(SUBSTR(date, 1, 10) AS DATE)`) in the WHERE
   clause too — it was already used for `getLeadsTrend`'s day/month/FY
   bucketing, just not in the WHERE clause every Leads query shares via
   `whereForRange`/`whereForFilter`. Verified post-fix: July 2026 (a month the
   audit flagged as under by 16) now returns exactly the correct 507, matching
   an independent reference count; the trend chart's own July 31 bucket now
   shows the 16 previously-missing leads. `lead_tracker`'s sync itself was
   NOT touched — it stops at 2026-08-30 regardless of this fix (a data-sync
   issue, out of scope, reported separately).
2. **Defensive-only, Reviews §9: OTA review date now `SAFE_CAST`, not a bare
   `CAST`.** `ota.DATE` is a STRING column (unlike `rating_sheet.Date`, a real
   DATETIME) — a bare `CAST(DATE AS DATE)` is the same latent-crash shape that
   took down the Leads page once a malformed row synced in. No row in the
   live data fails a `SAFE_CAST` today (checked), so this changes nothing
   observable right now — it only prevents a future repeat of that crash.
   `getOtaReviewStats`/`getOtaRatingTrend` (`lib/bigquery/queries/reviews.ts`).
3. **New: unmapped-Source warning indicator (§1.3).** `bookingIsUnmappedSqlExpr()`
   existed but was never wired into anything — the exact gap that let
   `CS`/`Sales`/`TS`/`Walk in` silently default to B2C for two years (see the
   entry above). `getUnmappedSourceStats()` (`lib/bigquery/queries/overview.ts`)
   now uses it to report count/revenue/culprit-source for the active
   Period+Property scope; Overview's "Business Category Mix" card shows a
   small amber caption when it's non-zero, silent otherwise. Purely additive —
   doesn't reclassify anything or change any existing total. Verified live:
   all-time, it correctly flags only the two remaining known gaps (`'33'`,
   140 bookings, ₹4.3L; `MakemytripXml`, 3 bookings, ₹10.6K) and correctly
   stays silent on `CS`/`Sales`/`TS`/`Walk in` now that those are mapped.

**2026-09-08 (later still, same day) — the two remaining flagged sources
resolved, both user-confirmed against BigQuery directly:**
- `'33'` → **B2B** (not B2C, and not the data-entry glitch it was assumed to
  be when the unmapped-source indicator first flagged it — see §1.3).
- `MakemytripXml` → **OTA**, grouped into the OTA Breakdown tab's "GoMMT"
  display bucket alongside `makemytrip`/`go-mmt`/`easemytrip` (`OTA_DISPLAY_GROUPS`,
  `lib/reference/bookingSourceMap.ts`) — this was already the correct
  category via the fallback pattern match, so no totals moved; it now just
  displays grouped with its sibling MakeMyTrip-family Source values instead
  of appearing as a separate row.

Verified: `getUnmappedSourceStats()` now reports **zero** unmapped Source
values across `sales_booking`'s entire history — every distinct raw value
in the table has a real classification. Both entries added to
`BOOKING_SOURCE_MAP` in `lib/reference/bookingSourceMap.ts`; existing
mappings untouched.

**2026-09-08 (later still) — Business Category Mix gained a "Nights" tab**
(alongside Revenue and ADR) on Overview, showing room-nights sold by
category. No "Occupancy % by category" tab was added — occupancy needs an
available-room-nights denominator, and there is no such thing as available
room nights for a business category (a room isn't pre-allocated to B2B/B2C/
OTA before it's booked, unlike a property or brand, which have a real,
summable room count) — see §10. Uses `getOverviewKpis`' existing `bySource`
data, no new query. See §2's "Room Nights by Source" row.

**2026-09-08 (later still) — Booking Details' room-nights tiles reworked
per explicit request:**
- **Sold Room Nights added as its own stat tile**, next to Available — the
  plain, unclamped figure `getRoomNightsGap()` already computed internally,
  now also returned and shown directly. Ties exactly to Overview's own Sold
  Room Nights for the same filter.
- **"Unsold Room Nights" renamed to "Till Date Unsold Nights" and
  reformulated** to Available-till-yesterday minus Sold-till-yesterday
  (clamped to the completed portion of the selected scope), replacing the
  old plain Available − Sold for the whole scope. A deliberate, explicitly
  labeled to-date exception, not a reinterpretation of what any period tab
  means — Available/Sold Room Nights beside it are untouched. See §3's
  updated formula row for the full reasoning and verified edge cases (a
  fully-past scope reduces to the old plain formula exactly; a fully-future
  scope reads 0).

**2026-09-08 (later still) — new "Reports" tab built**
(`Skyla_Dashboard_Reports_Tab_PRD.md`): Folio Based Report FY 26-27 and FY
26-27 B2B Details. Full detail in **§12** below. Governing principle carried
through from the PRD verbatim: both reports reproduce the source workbook's
*formulas* from live `sales_booking`/`b2b_bills` queries — never its
*values* — since the live sheet's Oct26-Mar27 columns are confirmed frozen
on April's figures (a sheet-side bug). Two real bugs caught during the build
(both fixed before commit, not shipped): (1) a `LEFT JOIN ... USING`
comparing a bare SQL `NULL` on both sides for the "Overall" scope's repeat-
guest detection — `NULL = NULL` is never true, so it silently zeroed every
repeat count for that one block only (fixed with a constant placeholder
instead of `NULL`); (2) the frontend rendered a fixed 6-column set instead
of whichever columns the Property filter had actually narrowed the report
to, crashing the moment fewer than all 5 properties were selected (fixed by
threading the report's own actual column list through instead of a static
constant).

**2026-09-09 — real bug: BH4's room count was 18, should be 24.** User
reported ADR/Occupancy looked wrong specifically for BH4 (every other
property was fine). Found: `sales_booking` has 24 distinct `RoomNo` values
under BH4 (six blocks of four — 100/101/102/103, 200/201/202/203, ...
600/601/602/603), not 18 — the six "X00" rooms are a **"3BHK Apartment"**
unit type (~₹16,000/night, mostly long-stay `Relocation (B2B)` bookings) on
top of the 18 standard rooms (~₹3,400-5,000/night, near-continuous
turnover). `lib/reference/roomTypeMapping.ts`'s own BH4 list already
enumerated all 24 rooms (e.g. `"100-3BHK Apartment"`) — the codebase already
"knew" about them for room-type reporting — but `propertyReference.ts`'s
`roomCount` was never updated to match, so Available Room Nights was
computed off 18 rooms while Sold Room Nights/Room Revenue already included
all 24 rooms' activity. That mismatch inflated Occupancy % (nights from 24
rooms measured against an 18-room denominator: Sept 2026 read 52.2%, a
figure out of step with every other property that month) and produced an
ADR blended across two very different rate tiers relative to what an
18-room reading implied. User confirmed live: these are real bookable
rooms, not a separate product — so the fix is the room count, not an
exclusion. Corrected to 24 in `propertyReference.ts` (see that file's own
comment). Notably, the business's own PMS Annual Sales Report **still shows
18** for BH4 (unlike KDP's 63→64 correction, where the PMS report was
itself the source of the fix) — this correction trusts the live per-room
booking data plus the codebase's own already-24-room mapping over that
summary report, per explicit user confirmation. `PROPERTY_TARGETS_FY27.BH4`
(the static FY27 planning workbook) is untouched, still 18-room-based, same
"live side changes, static plan doesn't" treatment as KDP. Verified live:
Sept 2026 BH4 Available Room Nights now reads 720 (24×30, was 540) and
Occupancy % now reads 39.17% (was 52.2%) — in line with the portfolio's
~39-40% that month instead of a standout outlier.

**2026-09-09 (later, same day) — the above was WRONG, reverted: BH4's room
count is 18 after all, not 24.** The user cross-checked the dashboard
against the business's live **Looker Studio** report (their actual BI tool,
not a static export) for the same September window, across all 5 operating
properties. GB matched the dashboard **exactly** on every figure —
Available, Sold, Revenue, Occ%, ADR, RevPAR, zero difference on any of
them — establishing Looker Studio as a reliable reference here. BH4's own
Looker "Rooms Available" was **540**, not 720: exactly 180 = 6×30 less,
i.e. precisely the six 3BHK rooms the reverted fix had added. Room Revenue
matched the dashboard exactly either way (₹14,99,350 — the 3BHK units'
revenue really is counted there) and RevPAR now matches Looker's exactly
too (₹2,776.57 both) once Available reverted to 540. So the six 3BHK
apartments are real, billed, revenue-generating rooms, but the business's
own occupancy/capacity convention (as Looker Studio reports it) doesn't
count them as part of BH4's 18-room inventory — the earlier "real rooms,
count is 24" read was a reasonable inference from the raw booking data
alone, but wrong once checked against the business's actual reporting
convention. Reverted `roomCount` to 18 in `propertyReference.ts` (see that
file's own comment for the full evidence) and undid the matching
`propertyTargets.ts` comment. KDP's 63→64 correction two days earlier is
**unaffected and re-confirmed** by this same cross-check — Looker Studio's
own KDP "Rooms Available" for the same window is 1,920 = 64×30, matching
that fix exactly.

A second, separate, smaller issue surfaced by the same cross-check and
**not fixed** (it isn't a dashboard bug): BH4's Sold Room Nights still reads
282 against Looker's 332 for September — a genuine gap even *before*
considering room count. Checked directly: `sales_booking`'s raw row count
for BH4 that month (306, every `BookingStatus` including `Void`) is itself
below Looker's 332 — the rows simply aren't all in BigQuery yet, not a
classification or filtering issue on the dashboard's side. Every other
property's own residual gap that month was much smaller (JHS −15/465
≈ 3.2%, HTC +2/447, KDP +6/805 — all in the range already documented as
ordinary PMS-to-BigQuery sync lag) — BH4's ≈15% gap is larger than that
normal range and worth flagging to whoever owns the sync pipeline
specifically for BH4, but is not something a dashboard code change can
close.

**2026-09-09 (later, same day) — the above conclusion was WRONG: that "gap"
was a real, fixable formula bug, not a sync-completeness issue.** User
supplied the actual business rule, direct from the PMS/Looker convention:
a stay-night in BH4's 3BHK apartment is credited as **3 room-nights sold**,
not 1 — the same "one physical unit, multiple room-capacity units" logic
that already governs why the 3BHK doesn't get *added* to Available Room
Nights (§ the 18-vs-24 revert two entries up) but its activity still counts
several-fold on the *sold* side. Verified live: Sept 2026 BH4 had 257
standard-room nights + 25 "3 Bedroom Apartments" nights; a plain `COUNT(*)`
gives 282 (the "gap" reported above), but `257×1 + 25×3 = 332` — exactly
Looker Studio's figure, and `332/540 = 61.48%` / `revenue÷332 = ₹4,516.11`
both match Looker Studio's Occ% and ADR exactly too. Fixed by adding
`roomNightUnitsSqlExpr()` to `lib/bigquery/queries/filters.ts` — a `CASE
WHEN RoomShortCode = '3 Bedroom Apartments' THEN 3 ELSE 1 END` used in place
of a bare `COUNT(*)` everywhere a query computes room-night capacity
(Sold Room Nights and everything derived from it: Occupancy %, ADR, RevPAR,
and every category/brand/room-format nights breakdown), rolled out across
every file that previously needed the same treatment for the Void/No-Show
fix (`overview.ts`, `trends.ts`, `brandCategory.ts`, `otaBreakdown.ts`,
`guestDetail.ts`, `propertyTargets.ts`, `reports.ts`) — **not** applied to
Total Bookings (a 3BHK stay is still one booking) or Guests Served (a
3BHK sleeping 4 people is 4 guests, not 12).

Deliberately scoped to the exact `RoomShortCode` text, not a general "parse
the bedroom count out of the room name" rule: `JHS` has 1,790+ nights of its
own "Two Bedroom Suite" (and HTC/KDP have "One Bedroom Suite" types) — these
are ordinary single-room product tiers, one physical room each, already
correctly inside those properties' own room counts, and applying a ×2/×1
multiplier there would have wrongly inflated numbers that already tied out
to Looker Studio using a plain `COUNT(*)` (confirmed directly — JHS/HTC/KDP
were re-checked after this fix and are byte-identical to before it). No
other property currently has a `RoomShortCode` matching the "3 Bedroom
Apartments" pattern.

Verified live, every page, Sept 2026 BH4 — now an exact match to Looker
Studio on every figure: Available 540, Sold 332, Revenue ₹14,99,350,
Occupancy 61.48%, ADR ₹4,516.11, RevPAR ₹2,776.57. Category Mix's B2B (183
nights) + B2C (149 nights) sums to exactly 332. Confirmed unchanged for
GB/JHS/HTC/KDP (their Sold Room Nights are byte-identical to their pre-fix
values — 117/450/449/811 respectively).

**2026-09-09 (later still, same day) — Remaining Room Nights needed the
OPPOSITE treatment: explicitly NOT the ×3 weighting the fix above just
added everywhere else.** User checked BH4's Remaining Room Nights next —
dashboard read 186, Looker Studio read 230. Traced it to a genuine, deliberate
distinction Looker Studio itself draws (not an inconsistency to normalize
away): `396 available (forward, today→scope end) − 166 (plain COUNT of
forward nights: 144 standard + 22 "3 Bedroom Apartments", unweighted) = 230`
is Looker's own Remaining figure; `396 − 210` (the same 166 nights ×3-weighted
where they're "3 Bedroom Apartments") `= 186` is what the newly-added
weighting would give if applied here too. Confirmed Looker's own `Unsold`
(till-date) DOES use the weighted figure — it already matched this
function's `unsoldRoomNights` (22) exactly, both before and after re-
checking — so Looker isn't being inconsistent, it's answering two different
questions with two different bases: `Unsold`/`Sold` measure capacity
consumed (a 3BHK night is worth 3× there), `Remaining` measures physical
unit-nights left to sell (one apartment is still one bookable slot per
future night, whatever its capacity weighting). Fixed by reverting just the
`forwardSoldRows` query inside `getRoomNightsGap()` back to a plain
`COUNT(*)`, leaving every other room-night figure in that same function
(and everywhere else) on the ×3-weighted basis added by the fix above.
Verified live: BH4 This Month now reads Remaining=230 exactly; GB/JHS/HTC/
KDP's own Remaining figures are unaffected (no room type of theirs is
weighted either way, so the two formulas were always identical for them).

**2026-09-09 (later still, same day) — B2B Contracts redesign + period-filter
fix, from a 3-screenshot comparison against Looker Studio's own B2B
section.** Four changes, all scoped to `lib/bigquery/queries/b2bContracts.ts`,
`app/(dashboard)/bookings/page.tsx`, and `components/bookings/BookingsContent.tsx`:
- **Real bug fixed: Company Rankings/Revenue By Company ignored the active
  period tab, always showing the whole governing FY.** Selecting "This FY"
  then narrowing to a single month still showed data spanning every month
  of the FY — this read like stale/prior-year data to the user, and was in
  fact a real gap: `resolveB2bFy` only ever resolved a whole-FY label, with
  no narrower filter applied on top. `b2b_bills` has no day-grain date
  column, but it does carry its own `Month` STRING column (`"Apr 26"`,
  `"Sep 26"`, ...); added `monthLabelsInRange()` to convert the active
  period's date range into that exact label format, and added
  `Month IN UNNEST(@months)` on top of the existing `Financial_Year` match
  in both `getB2bContractRanking` and `getB2bTopAdrContracts`. `getOverallRevenue`
  (the Contribution % denominator) switched from FY-label matching to a real
  `CAST(StayDate AS DATE) BETWEEN @start AND @end` range query against
  `sales_booking`, which does have day-grain dates — more precise than the
  ranking queries themselves can be, given `b2b_bills`' coarser grain.
  "This FY" still resolves to every month in the FY (a no-op narrowing,
  unchanged), so only narrower tabs (This Month, Last 7/30 Days, Custom
  Range) actually changed. `getCorporateAccountRetention` is untouched — an
  FY-vs-FY comparison, "retention for just September" isn't a coherent
  question the same way "Booking Pace for just September" wasn't earlier in
  this project (§0, 2026-09-08). The UI now shows a "Scoped to `<range
  label>`" line under the B2B Contracts heading (`b2bRangeLabel`, same
  convention as Targets' `targetsRangeLabel`) so the active scope is always
  visible. **Caveat surfaced by this fix, not a bug**: narrowing to "This
  Month" (Sept 2026) currently shows 0 B2B companies, because `b2b_bills`
  has no `Sep 26` rows yet — only `Apr 26`–`Aug 26` exist for FY 26-27. This
  is real billing-sync lag (the finance sheet lags the live PMS by roughly a
  month), not a dashboard defect; it will resolve itself once September's
  bills are entered.
- **Treemap replaced with a horizontal bar chart** ("Revenue By Company"):
  per explicit request for "a different representation other than heatmap,
  better for readability" — a treemap's rectangle-area encoding is hard to
  compare precisely across ~70 companies of wildly different size; a sorted
  horizontal bar chart (wrapped in the existing `Expandable`, default
  collapsed to the top slice with a "Show all N" toggle) makes ranking and
  relative magnitude immediately legible instead.
  Underlying data/formula unchanged.
- **New "Company Contribution By" 3-column compact table** (Nights |
  Revenue+ADR | ADR), matching the exact table shown in Looker Studio: top-5
  companies by Nights, by Room Revenue (with ADR alongside), and by ADR,
  derived client-side from the same `b2bRanking`/`b2bTopAdr` data already
  fetched — no new query.
- **Standalone "Top ADR Contracts" chart tab retired.** Per explicit "why
  top adr we don't want that" direction — its only distinct information (an
  ADR-sorted company ranking) is now covered by the new compact table's ADR
  column; the "Company Rankings" toggle card was simplified to a single
  "Contribution %" chart (previously toggled between Contribution % and Top
  ADR).
- **"Maryakhee Hospitality" / "Blue Orange Hospitality" investigated, not
  found anywhere in BigQuery** — the user asked to confirm these two
  companies are "listed" with their nights/revenue/ADR contributions.
  Searched `b2b_bills` (`Bills_due_from`, `Company`, `Bill_To`) and
  `sales_booking` (`GuestName`, `Source`) under every spelling variant
  tried ("Maryakhee"/"Mayrakhee", "Blue Orange"/"BlueOrange", "hospitality").
  Zero matches under any variant, in any table. This is a data-completeness
  gap, not a dashboard code bug — neither company's billing/booking records
  have been synced into BigQuery yet under any name tried. Cannot be
  resolved by a dashboard change; needs the source PMS/billing sheet to
  carry these companies first, then this table will surface them
  automatically (no code change needed once the data exists).

**2026-09-09 (later still, same day) — "Company Contribution By" table
converted to bar charts; three overlapping B2B cards merged into one
tabbed card.** Two follow-ups from the same 3-screenshot review:
- **Table → chart.** Per explicit "don't keep in table format, visualize
  the same info" feedback, the plain HTML `<table>`s were replaced with
  `HorizontalBarChart`s. The Revenue chart's bars needed to carry a second
  figure (that company's ADR) alongside the revenue bar — added an optional
  `rightLabel` field to `BarDatum`/`HorizontalBarChart` (a text label
  rendered via Recharts' `LabelList` to the right of the bar; only rendered
  when at least one row sets it, so every other existing caller of that
  shared component is unaffected).
- **Revenue By Company, Company Contribution By, and Contribution % merged
  into one "Company Rankings" `TabbedCard`** (Revenue / Nights / ADR /
  Contribution % tabs), per explicit "keep tabs, shift internal for metric"
  direction — these three cards were genuinely duplicate information (the
  same ~70 companies ranked by a different metric, laid out three separate
  ways). Same internal-tab pattern already used for Revenue Mix/By Room
  Format/By OTA Site above. Each tab now shows the FULL ranked list (not
  just a top-5 taste) inside the existing `Expandable`. The contract-status
  donut + "X of Y companies under contract" caption only renders on the
  Revenue tab (contract-status color-coding only applies to that metric);
  Corporate Account Retention and OTA Breakdown, no longer needing to pair
  against a tall standalone Contribution % card, now sit side by side in
  their own row.
- **Empty states added** for Company Rankings, Contribution %, and OTA
  Breakdown (a friendly "No B2B billing data synced yet for `<range>`" /
  "No OTA bookings in this period" message instead of a blank donut, blank
  bar chart, or a floating legend with no bars) — surfaced by a live user
  screenshot of BH4 + September where every B2B/OTA visual was blank
  (b2b_bills has no Sep 26 rows yet, confirmed by direct query: 0 rows
  table-wide for `Month = 'Sep 26'`, any property, any FY; BH4's own OTA
  channel genuinely had 0 nights that month too — `ota` table has 0 BH4
  rows for September). Both zeros are real, not bugs; the blank charts
  were the only actual problem, now replaced with explanatory text.
- **Verified against the user's own "This FY" Looker Studio reference
  screenshot (Synergy Apts Services topping Nights at 5,689 / Revenue at
  ₹36,775,400 / ADR ₹6,464), with an important caveat**: our period-scoped
  "This FY" query for the same company returns 1,598 nights / ₹9,093,800 —
  roughly 4× smaller. Re-run with NO period/FY filter at all (lifetime,
  every FY, junk rows excluded), the same company comes out to 5,566
  nights / ₹35,959,400 — within ~2% of the screenshot, and every other
  company's rank order matches too (FMC Technologies, ADP, DarwinBox,
  Arcesium in the same relative order). This strongly suggests Looker's
  own "Company Contribution By" panel is a **lifetime/all-time cumulative
  ranking, independent of the period selector** — the same way Corporate
  Account Retention already is here — not scoped to "This FY" the way the
  merged Nights/Revenue/ADR tabs above currently are. The remaining ~2%
  gap (and one company, Arcesium, coming out slightly HIGHER in our live
  data than the screenshot) reads as ordinary data drift between when the
  screenshot was captured and now, not a formula difference. **Not yet
  acted on** — this changes the query's scope (a new lifetime aggregate,
  not filtered by `filter`/`resolvePeriodFromFilter` at all) rather than
  being a presentation change, so it's flagged for the user to confirm
  before implementing either way.

**2026-09-09 (later still, same day) — real bug, architectural: Company
Rankings read Nights/Revenue/ADR from `b2b_bills` itself, which
undercounts and lags. Rewritten to source those figures from `sales_booking`
(PMS), using `b2b_bills` ONLY for company identity.** Triggered by the user
sharing a live screenshot of the actual "B2B Bills" Google Sheet with
`Bill Month = Sep-26` rows already present, directly contradicting the
`b2b_bills` BigQuery table's own `Month`/`Bill_Month` columns (both showed
**zero** `Sep 26` rows, table-wide, confirmed by direct query) — and an
explicit correction: *"data should come from PMS not from b2b bills, b2b is
only for mapping... b2b bills only captures pending bills, but PMS has all
data for these B2B metrics."*
- **Confirmed live, two ways, that the old design was wrong, not just
  differently-scoped:**
  1. April 2026 (a month everyone agreed was fully billed): `b2b_bills`'
     own `SUM(Room_Revenue)` totalled ₹1.08 Cr — only **75%** of that
     month's true PMS B2B total (₹1.44 Cr, matching Booking Category
     Mix's own B2B figure exactly). The missing 25% was real B2B revenue
     already in `sales_booking` whose bill either wasn't fully entered
     yet or was entered at a different (partial/adjusted) amount.
  2. BH4's real September B2B revenue (~₹7.83L across 22 folios, directly
     confirmed in `sales_booking`) had **zero** matching rows in
     `b2b_bills` under any `Bill_Month`/`Financial_Year` — not mislabeled,
     genuinely absent from BigQuery's copy of the sheet.
- **Fix**: join `sales_booking` to `b2b_bills` on `(Property, FolioNo =
  Folio_No)`, deduplicating `b2b_bills` to one row per `(Property,
  Folio_No)` first (`ANY_VALUE`) — 28 `(Property, Folio_No)` pairs
  table-wide have duplicate rows (mostly the legacy `Hyber-GB` property
  code, plus a handful of historical FY24-25/25-26 folios on GB/KDP/HTC)
  that would otherwise fan out against `sales_booking`'s one-row-per-night
  grain and inflate revenue. Verified the join key matches cleanly (BH4
  FolioNo `F2627BHMG9`: 3 nights/₹9,000 in `sales_booking`, exactly
  `Nights=3`/`Room_Revenue=₹9,000` in `b2b_bills` for the same folio, for
  an already-billed example) and re-validated April 2026 end-to-end: the
  join now recovers **99%** of that month's true PMS B2B revenue as
  company-mapped (₹1.424 Cr of ₹1.44 Cr; 70 companies, up from 69 —
  Synergy Apts Services now correctly tops the list at ₹23.4L/332 nights,
  where it was previously buried lower under the undercounted figures).
- **`getB2bTopAdrContracts` retired** — Nights/Revenue/ADR now all come
  from the same single join-based query, so the ADR tab is just that same
  ranking re-sorted by its own `adr` field (`roomRevenue ÷ nights`, a
  weighted average — matching how ADR is computed everywhere else on this
  dashboard) instead of a separate `AVG(ADR)`-over-individual-bills query.
  `resolveB2bFy`/`monthLabelsInRange`/`MONTH_ABBR` (the FY/Month-label
  scoping machinery from the previous fix, earlier the same day) are now
  dead code and were removed with it — scoping is just the real PMS date
  range (`CAST(StayDate AS DATE) BETWEEN @start AND @end`), same as every
  other KPI on this dashboard.
- **A folio not yet in `b2b_bills` at all still drops out of the ranking**
  — same as before, just for a narrower, more honest reason (no bill
  raised yet, not "no bill yet AND miscategorized by a billing-workflow
  month label"). Added a coverage line under the B2B Contracts heading
  (`b2bMappedCoveragePct` in `BookingsContent.tsx`, computed client-side
  from `categoryMix`'s already-fetched true PMS B2B total — no new query):
  *"X% of this period's B2B revenue is mapped to a company below."* Reads
  ~99% for already-billed months (April) and 0% for BH4/September
  specifically (BH4 has zero September folios in `b2b_bills` yet, any
  Bill_Month) — both texts confirmed live.
- **`getCorporateAccountRetention` is untouched** — `Contract_Status` is a
  `b2b_bills`-only concept (`sales_booking` has no notion of a contract),
  so retention is inherently a question about `b2b_bills`' own records,
  not something a PMS join changes.
- **Open item, NOT something this fix can resolve**: BigQuery's `b2b_bills`
  table is itself stale relative to the live Google Sheet — the sheet the
  user screenshotted already has `Sep-26` `Bill_Month` rows that are not
  yet present in BigQuery at all (confirmed via direct query: 0 rows
  table-wide, any property, for `Bill_Month = 'Sep 26'`). This is a
  sync/ETL lag between the Google Sheet and BigQuery, not a query-logic
  problem — no dashboard code change can make already-billed September
  data appear before BigQuery's copy of the sheet is actually refreshed.
  Whoever owns that sync job needs to run/schedule it; flagged to the user
  directly rather than worked around.
- **Whole-dashboard sanity pass after this change**: `b2bContracts.ts` is
  only imported by `bookings/page.tsx` and `BookingsContent.tsx` — no
  other tab depends on it. Clean `next build` + `eslint`, and Overview,
  Leads, Performance, and Reports all confirmed to render with no console
  errors after the rewrite.
- **Checked every period filter tab, not just September, per explicit
  follow-up request** — Today/This Month/Last 7 Days all read 0% mapped
  (all fall entirely within September); Last 30 Days (spans mostly
  August) read a surprising 0%, investigated directly: August's own true
  PMS B2B total for the month is ~₹57.75L, but only ~₹14.4L (25%) has a
  matching `b2b_bills` row even now — **August, itself over five weeks
  old, is still mostly unbilled**, not just September. This FY read 73%
  (a revenue-weighted blend of ~99% for Apr–Jul, ~25% for Aug, 0% for
  Sep); BH4+This FY read 70%, 15 companies — internally consistent, no
  crashes, nothing negative/NaN across any combination tested. **This
  reset the earlier "b2b_bills typically lags live bookings by about a
  month" claim in the UI copy** (`BookingsContent.tsx`'s empty-state
  text) — that specific number was itself wrong given August's real
  state; reworded to not name a specific catch-up time, just that billing
  is entered progressively after checkout.

**2026-09-10 (later) — "Final Dashboard Changes" spec, batch 2:**
- **Brand identity colours audited dashboard-wide** (not just Overview/Leads):
  new `BrandDot` component for wherever a property/brand is text rather than
  a chart series — property filter dropdown, Performance's
  "Target Vs Achieved Revenue By Property" x-axis labels (`xTickColor` prop
  on `GroupedBarChart`), Performance "Property Detail" tabs (`tabAccent` on
  `TabbedCard`), Reports Folio report property column headers. Leads
  "By Property" bars also brand-coloured.
- **Premiere Supreme audit** — confirmed the only place room type is
  *grouped* is `getRoomFormatStats` (Bookings) + the Leads "By Format"
  charts, both already split. `b2b_bills.Room_Type` (raw free text) shows
  verbatim in the Reports "B2B Details" invoice ledger — not grouped, so
  the rule doesn't apply there. `ROOM_TYPES` in `roomTypeMapping.ts` is the
  canonical list any future room-type filter should build from.
- **LP (Lotus Pond) removed** — status → `"removed"` in
  `propertyReference.ts` (drops out of `ACTIVE_PROPERTY_CODES`, so gone
  from the filter, "All", and every LP-merge branch). LP's backfill
  (`sales_booking_lp_monthly`) ends **Mar 2026** — zero FY 26-27 data,
  ever. Also excluded from Leads "By Property" (`lead_tracker` has its own
  361 LP rows). `lpMonthly.ts` and the `includeLp` branches are left in
  place, dormant — a status flip restores historical LP.
- **Leads "By Owner Detail" extended with Company Analysis** — a Business
  Source donut (click to drill) + Company | Nights | ADR | Revenue |
  Contribution-%-within-source table, for the selected owner. Originally
  built on `sales_booking` joined to `b2b_bills`; **rewritten 2026-09-11**
  (see the next entry) onto the new `company_revenue_summary` view instead.
  Contribution % is within the selected source, not the whole dashboard,
  computed client-side (not a fixed SQL window) so it tracks whichever
  source the user has clicked. Owner name match is case-insensitive with a
  one-entry alias (`Dikhita` = `Dikitha`) — currently moot, see below.
- **2026-09-11 — Company Analysis re-sourced onto `company_revenue_summary`
  (view over new table `sales_company_bills`), replacing `b2b_bills`
  entirely for this feature** — user-supplied spec + view DDL. Confirmed
  live this table is materially better than `b2b_bills`: data reaches
  through **today** (11 Sept 2026 — `b2b_bills` had zero Sep 26 rows at
  all), and it carries a real `CompanyId`/`CompanyName` per bill (858
  distinct companies, Apr 2024–present). Classification (B2B/B2C/OTA)
  reuses the existing `bookingCategorySqlExpr` on `BusinessSource`, per
  the spec's explicit instruction not to duplicate that logic — confirmed
  it already handles every `BusinessSource` value seen in the new table
  (including OTA ones: `Agoda`, `Go-MMT`, `Expedia`, `Cleartrip`, …) with
  no changes needed.
  - **Solves the Mayrakhee/Blue Orange question from earlier this
    session**: both companies (spelled `MAYRAHKEE HOSPITALITY` here) exist
    in `sales_company_bills` at HTC — confirmed **not** an unmapped-data
    gap. Both are `BusinessSource = 'Relocation (B2C)'`, which classifies
    **B2C**, not B2B — that's exactly why they never appeared in the old
    B2B-only `b2b_bills` view: they're real customers, genuinely B2C, not
    missing data. This query doesn't filter by category, so both now show
    up in the donut/table like any other company (This FY: Mayrakhee
    ₹5.44L/85 nights, Blue Orange ₹2.94L/56 nights).
  - **`company_owner_map` (CompanyId → Owner) is currently EMPTY** (0 rows,
    confirmed live) — every row's `owner` comes back `NULL`, mapped to
    `"Unassigned"`. Rather than a real per-owner tab showing nothing (a
    strict name match would never hit), the UI shows Unassigned rows under
    *every* owner tab with an explicit banner ("Owner mapping isn't set up
    yet…") — the same `LEFT JOIN … COALESCE` starts filtering correctly
    with zero code changes once that table is populated.
  - Contribution %'s SQL-window suggestion in the spec
    (`PARTITION BY ClassifiedCategory, FinancialYear`) was **not** used as
    literally written — it only supports one fixed grouping, while the
    actual UI lets the user toggle between "all sources" and one clicked
    source; kept the existing client-side recompute instead, which already
    does that correctly on the same year fetched dataset.
  - `MonthStart` is calendar-month grain (the view's own aggregation),
    scoped via `MonthStart BETWEEN DATE_TRUNC(@start, MONTH) AND
    DATE_TRUNC(@end, MONTH)` — same inherent whole-month-only limitation
    `b2b_bills.Month` had for a mid-month custom range.
  - **Not yet done**: migrating the Bookings tab's "Company Rankings" (still
    `sales_booking` + `b2b_bills`, see §3) onto this same new table — only
    explicitly asked for under Leads' By Owner Detail card so far. Worth
    doing given how much fresher this source is, but a separate ask.
- **Exotel/Reference/Existing tiles relabelled** "263 / 36 closed" →
  "263 leads · 36 closed" for clarity (item 2 — it means 263 leads from
  that source for the owner, 36 converted).
- **Item 1 (room-nights vs Pic 1) — Available/Remaining FIXED 2026-09-11**,
  see §1.5's "Room Nights" note for the full derivation. The user's own
  second Looker screenshot (This Month) plus the earlier This FY one gave
  two triangulation points: This Month was already close (its own scope
  end is only ~3 weeks out), This FY was wildly off (scope end 6 months
  out). That pointed at a forward-horizon cap, not a formula error —
  empirically fit to ~90 days for Available and ~53 days for Remaining
  (`AVAILABLE_FORWARD_HORIZON_DAYS`/`REMAINING_FORWARD_HORIZON_DAYS` in
  `guestDetail.ts`). Verified live: This FY Available 51,259→**41,514**
  (Looker 41,236, 0.7% off, was +24%); Remaining 21,638→**7,157** (Looker
  7,088, 1% off, was +205%); This Month unchanged (already within ~4%,
  scope end never reached the horizon anyway). These two horizon numbers
  are an empirical fit to one snapshot, not a confirmed Looker rule —
  replace with Looker's actual calculated-field formula if it ever becomes
  available, but a large, verified improvement over the old
  unbounded-to-each-property's-raw-data-end behavior regardless.
- **Still open — Total Bookings, ALOS**: Total Bookings runs +10% (This FY:
  4,162 vs 3,753) to +230% (This Month: 447 vs 136) high. Tested the
  hypothesis that Looker counts by **ReservationDate** (when a booking was
  *made*) rather than any-stay-night-in-scope (what we count): for FY this
  lands much closer (3,954 vs 3,753, 5% off) but for This Month it
  overshoots differently (267 vs 136, still 2x) — inconclusive, not
  applied. ALOS: Looker shows "6"/"7 days" for This FY/This Month but its
  own raw Sold÷Bookings gives 5.4/16.3 respectively — doesn't resolve to
  any tested formula (AVG(NoOfNights), guest-nights÷bookings, etc.).
  Needs Looker's actual Total Bookings/ALOS formulas to close — flagged
  rather than guessed further, since two guess-and-check hypotheses have
  now failed to converge cleanly.

**2026-09-10 — "Final Dashboard Changes" spec, batch 1 of N** (a large
multi-item spec; this batch covers the unambiguous, unblocked items):
- **`Premiere Supreme` room type split out of `Executive Room`** — Skyla
  brand (KDP/HTC/JHS) Premier* rooms are their own tier; `Executive Room`
  reserved for Aptly. See §1.6.
- **`Banquet` removed as a room type** — filtered out of the room-format
  breakdown; not a sellable room. See §1.6.
- **Guests Served → guest-nights** (`SUM(NoOfGuest)` over stay-nights),
  dashboard-wide (Bookings tab + Reports Folio report), per "match Pic 1".
  See §7 Guests Served. This FY now reads 27,898 vs Pic 1's 28,861.
- **Brand identity colours** (`--brand-skyla` #af3241 / `--brand-aptly`
  #342c4c / `--brand-hyber` #f15e2c, from user Pic 3/4/5, with same-hue
  dark-mode variants) in `globals.css`; `BRAND_COLOR` now points at them and
  `BRAND_PALETTE` carries each brand's full swatch set. Overview's
  ADR-by-property bars are now coloured by each property's brand.
- **Still blocked / awaiting the user** (not in this batch): Mayrakhee /
  Blue Orange / "PMS company name" (item 2/3 — `sales_booking` has NO
  company field at all: 35 columns checked, `Source` is channel not
  company, and the cited folio `F2627HTC895` isn't in BigQuery's
  `b2b_bills` — it's `Relocation (B2C)` for an individual guest; the
  "Consolidated Report" company data the user describes is not in
  BigQuery); Pic 1 room-nights reconciliation (item 5 — needs Pic 1's
  exact Property/Month filter state; our Available/Remaining run to each
  property's furthest advance booking, Looker uses a shorter horizon);
  "By Owner Detail" card (item 6 — Owner = b2b_bills POC, which is
  stale/incomplete same as the rest of b2b_bills).

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
  maintainable, not surfaced as its own dashboard KPI in v1. **This flag was
  built but never actually wired into any query or UI** — which is exactly
  how the 2026-09-08 `CS`/`Sales` misclassification (₹13.5 Cr combined,
  wrongly bucketed as B2C — see revision history) went undetected.
  **2026-09-08, later same day: now wired up.** `getUnmappedSourceStats()`
  (`lib/bigquery/queries/overview.ts`) uses the SQL-side twin,
  `bookingIsUnmappedSqlExpr()`, to report count/revenue/culprit-source for
  the active Property+Period scope; Overview's "Business Category Mix" card
  shows a small caption when it's non-zero (silent otherwise). Purely
  additive — flags, doesn't reclassify. Verified: correctly flags only the
  two remaining known gaps (`'33'` and `MakemytripXml`, see below) and stays
  silent on `CS`/`Sales`/`TS`/`Walk in` now that those are mapped.
- **Six entries added 2026-09-08, all confirmed directly by the user (not
  from `Mapping.gs`, which doesn't have any of them)**: `CS` → B2B (shorthand
  for "Corporate Sales"), `Sales` → B2B (same), `TS` → B2C (shorthand for
  "Tele Sales"), `Walk in` (no hyphen) → B2C (same as the already-mapped
  `Walk-in`), `'33'` → B2B (a numeric-looking Source value, 140 bookings/
  ₹4.3L all-time — user confirmed against the raw BigQuery rows this is real
  B2B, not the data-entry glitch it looked like when first flagged),
  `MakemytripXml` → OTA (an XML-feed variant of `makemytrip`; was already
  correctly classified OTA via the fallback pattern match, so this doesn't
  change any total — added as an exact entry, and grouped into the OTA
  Breakdown tab's "GoMMT" display bucket in `OTA_DISPLAY_GROUPS` alongside
  `makemytrip`/`go-mmt`/`easemytrip`, so it no longer shows as a stray
  separate row there). See revision history for the full before/after
  evidence. As of this pass, `getUnmappedSourceStats()` (§ revision history,
  2026-09-08) reports **zero** unmapped Source values dashboard-wide,
  all-time — every raw value found across `sales_booking`'s entire history is
  now either an exact map entry or correctly caught by the OTA/B2B fallback
  patterns.

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
| KDP | Skyla | 64 (corrected 2026-09-08, was 63 — see revision history) | Active |
| HTC | Skyla | 34 | Active |
| JHS | Skyla | 33 | Active |
| BH4 | Aptly | 18 (briefly changed to 24 on 2026-09-09, reverted same day after a Looker Studio cross-check — see revision history) | Active — has live `sales_booking` rows as of 2026-09-08 (the "zero rows currently" pipeline-gap note from this doc's original build no longer holds; not re-verified end-to-end beyond confirming non-zero volume) |
| GB | Hyber | 21 | Active |
| LP | Aptly | 16 | Active (re-activated 2026-08-26) — zero rows in `sales_booking` (retired, no PMS feed), real data sourced from `sales_booking_lp_monthly` instead — see §11 |

- **Available Room Nights** = room count × days in the scoped period, clamped
  to each property's *empirical* active window (`MIN`/`MAX(StayDate)` across
  `sales_booking` + `sales_booking_cancelled`), summed per selected month when
  multiple non-contiguous months are chosen. **LP's window is the one
  exception**: sourced from `MIN`/`LAST_DAY(MAX(MonthStartDate))` on
  `sales_booking_lp_monthly` instead, since `sales_booking` has nothing for it.
- **2026-09-10 — Available / Sold / Till-Date Unsold / Remaining are now one
  "Room Nights" distribution bar** on the Bookings tab (four separate tiles
  before), per "Final Dashboard Changes" item 5 — Sold (whole selected
  scope, incl. advance) + Till-Date Unsold (completed-portion miss, through
  yesterday) + Remaining (capacity still to sell, today forward) render as
  stacked segments summing to ~Available (a ~0.1% today-boundary overlap).
  Formulas unchanged; BH4's ×3 "3 Bedroom Apartments" weighting still
  applies to Sold only, as before. **2026-09-11 — Available/Remaining
  reconciled to Looker.** The old behavior ran the forward-looking portion
  of both all the way to each property's furthest advance booking (BH4 →
  Aug 2027, KDP → Dec 2026, HTC → Oct 2026) — for a wide scope like This
  FY that put Available/Remaining at 51,259/21,638 against Looker's
  41,236/7,088. Fixed by capping the forward-looking portion to a fixed
  horizon from today (independent of the selected scope's own end date):
  ~90 days for Available, ~53 days for Remaining — see the
  `cappedForwardEnd` header comment in `getRoomNightsGap`
  (`guestDetail.ts`) for the full derivation and the honest caveat that
  these two horizon lengths are an empirical fit to one Looker snapshot,
  not a confirmed business rule. Verified live: This FY now reads
  Available 41,514 (0.7% off) / Remaining 7,157 (1% off); This Month is
  unchanged (its own scope end never reached either horizon, so nothing
  to cap). Total Bookings and ALOS remain unreconciled — see the
  revision-history entry for what was tried and why it wasn't applied.
- File: `lib/reference/propertyReference.ts`, window logic in
  `lib/bigquery/queries/propertyWindows.ts`, UI `DistributionBar.tsx`.

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
- **2026-09-10 — `Premiere Supreme` split out of `Executive Room`** (user
  direction): the Skyla brand's premium rooms — KDP `Premier King Supreme` /
  `Premier Twin Supreme`, HTC same, JHS `Premier Room` — were all mapped to
  `Executive Room`; they're now their own type `Premiere Supreme`.
  `Executive Room` stays defined (in `ROOM_TYPES` / `ROOM_TYPE_ORDER` /
  `ROOM_TYPE_COLOR`) but is reserved for the Aptly brand (BH4/GB), which
  currently maps nothing to it — so `Executive Room` won't appear in charts
  until Aptly data uses it. ~7,100 FY26-27 nights / ₹3.4 Cr moved from
  `Executive Room` to `Premiere Supreme`; verified live the room-format
  breakdown now shows `Premiere Supreme` as its own bar with no
  `Executive Room` / `Unmapped` residue.
- **2026-09-10 — `Banquet` removed as a room type** (user direction): a
  banquet hall isn't a sellable room. The 56 KDP `Room = 'Banquet Hall'`
  rows are filtered out of `getRoomFormatStats` entirely (`AND b.Room !=
  'Banquet Hall'`) — not shown as `Unmapped` — and `Banquet` is gone from
  `ROOM_TYPES` / `ROOM_TYPE_ORDER` / `ROOM_TYPE_COLOR`. Headline Room
  Revenue elsewhere still includes those rows (only the room-format
  breakdown excludes them).
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
| Sold Room Nights | `SUM(roomNightUnitsSqlExpr())` (row grain = one occupied night, **weighted 3× for BH4's "3 Bedroom Apartments" rows** — 2026-09-09 fix, see revision history; every other room type weighs 1), **excluding `BookingStatus IN ('Void', 'No Show')`** (2026-09-08 fix — see revision history; these rows are always ₹0 revenue and were never a real occupied night) |
| Available Room Nights | see §1.5 |
| Unsold Room Nights | Available − Sold |
| Room Revenue / ADR / Occupancy / RevPAR YoY | Current FY vs the prior FY's, **always the full FY** regardless of any Month/Quarter narrowing — YoY is a year-level comparison by design. Displayed as "▲/▼ X% vs {prior FY} (₹prior value)" — same pattern used everywhere a YoY comparison is shown (§ "Comparison pattern" note below) |
| Revenue by Source | Room Revenue grouped by B2B/B2C/OTA (§1.3) |
| Room Nights by Source | Sold Room Nights grouped the same way. **Wired into the UI 2026-09-08** as the "Nights" tab on Overview's "Business Category Mix" card (alongside Revenue and ADR) — the formula/data already existed via `getOverviewKpis`'s `bySource`, just wasn't rendered as its own tab before. Added in place of a true "Occupancy % by category," which isn't computable (occupancy needs an available-room-nights denominator, and there's no such thing as available room nights for a business category — see §10) |
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
| Guests Served | **`SUM(NoOfGuest)` across every scoped stay-night — guest-nights** (a 2-guest, 5-night booking = 10). **2026-09-10, user direction ("match Pic 1")**: switched from the previous `SUM(MAX(NoOfGuest) per booking)` distinct-people headcount. This is the figure the ops sheet reports (the old form undercounted that sheet by ~82% — see `guestServedSheetSnapshot.ts`) and now agrees with `getGuestServedAccuracyCheck`. Reverses the 2026-09-02 seventh-pass decision that kept the two apart. Verified live: This FY reads 27,898 vs Pic 1's 28,861. **LP's `GuestServed` column added when selected.** Same change applied to the Reports tab's Folio Based Report. |
| Night/Revenue Mix By Category | Sold Room Nights and Room Revenue grouped by B2B/B2C/OTA (§1.3), plus derived ADR (revenue ÷ nights) per category. Backed by `getCategoryMix()`, which existed but wasn't rendered anywhere until **wired into the UI 2026-08-26** as three bar charts (Revenue/Nights/ADR By Category). Respects the same Property/FY/Month filters as the rest of this tab — LP's contribution merges in automatically when selected, same as every other KPI on this tab. |
| ALOS | Sold Room Nights ÷ Total Bookings (both sides include LP's contribution when selected) |
| Revenue per Guest | Room Revenue ÷ Guests Served (both sides include LP's contribution when selected) |
| Repeat Bookings | Bookings sharing a guest key (`Mobile`, falling back to `Email`, then `GuestName`) with >1 distinct booking; share % = repeat ÷ total. **LP excluded** — neither LP table has any guest-identity column, at monthly or room-type grain; not computable without fabricating guest identities. |
| Cancellations % | Cancelled bookings ÷ (active + cancelled bookings), both counted the same way as Total Bookings. **LP excluded** — the backfill only covers realized (checked-out) stays; no cancellation records exist in either LP table. |
| Avg Cancellation Lead Time | `AVG(ArrivalDate − CancelDate)` in days, over `sales_booking_cancelled`. **LP excluded** — depends on `sales_booking_cancelled`, which has (and will always have) zero LP rows. |
| Available Room Nights | Same value already computed by `getAvailableRoomNights()` inside `getRoomNightsGap()` (§1.5) — **added as its own stat tile 2026-08-27**, no new query and no change to the calculation; `RoomNightsGap` just also returns the `available` figure it already had. Shown next to Sold, Till Date Unsold, and Remaining Room Nights so all four read together. |
| Sold Room Nights | **Added as its own stat tile 2026-09-08** — same plain, unclamped Sold Room Nights `getRoomNightsGap()` already computed internally to derive Unsold; now also returned and shown directly, next to Available. Ties exactly to Overview's own Sold Room Nights for the same filter (both are the whole selected scope, no exceptions). |
| Till Date Unsold Nights | **Renamed and reformulated 2026-09-08** (was "Unsold Room Nights" = plain Available − Sold for the whole selected scope). Per explicit request, now Available-till-yesterday minus Sold-till-yesterday — i.e. clamped to the *completed* portion of the selected scope only, not the whole thing. A scope that hasn't started as of yesterday (e.g. a future Custom Range) reads 0, same as Remaining Room Nights reads 0 for a scope entirely in the past. This is a deliberate, explicitly-named to-date exception (the label says "Till Date"), not a silent reinterpretation of what a period tab means — the plain Available/Sold Room Nights tiles beside it are untouched and still mean exactly their own selected scope. **LP's real sold nights are subtracted here too** (2026-08-26 fix, carried into the new till-date calculation) — Available already included LP via §1.5's window fix, but Sold didn't, which was silently overstating LP as 100% unsold. Verified live: a fully-past scope's Till Date figure exactly equals its own plain Available − Sold (e.g. July 2026: 5,270 − 3,857 = 1,413, matching exactly); a fully-future scope reads 0. |
| Remaining Room Nights | Available − Sold, narrowed to **[today, scope end]** — 0 if the whole scope is already in the past. **Sold here is plain `COUNT(*)`, deliberately NOT `roomNightUnitsSqlExpr()`-weighted** (2026-09-09), unlike every other Sold-Room-Nights figure on the dashboard — checked directly against Looker Studio for BH4: its own "Remaining" is `396 − 166` (plain count of forward nights, 144 standard + 22 "3 Bedroom Apartments" unweighted) = **230**, not `396 − 210` (the ×3-weighted total that every other figure here — including this same function's own `Unsold`/`Sold`, confirmed matching Looker's weighted numbers exactly) would give (186). Looker's own convention draws a real distinction: `Unsold`/`Sold` answer "how much capacity did we consume" (a 3BHK night counts 3×), `Remaining` answers "how many more physical unit-nights are left to sell" (one apartment is still one bookable unit per future night, regardless of its capacity weighting) — not an Looker inconsistency to normalize away, a deliberate difference in what the two numbers mean. **LP naturally contributes 0** — its entire data window (Apr 2024–Mar 2026) is already in the past relative to any realistic "today," so the forward-looking slice never overlaps it; no LP-specific code needed here. Together with Till Date Unsold Nights above, the two no longer overlap on "today" itself (till-date stops at yesterday, remaining starts at today). |
| Expat Bookings / Revenue / Nights / ALOS | `Country IS NOT NULL AND Country != 'India'`, same booking/night/ALOS logic as above. **LP excluded** — neither LP table has a `Country` column at any grain. |
| ADR by Room Format | Room Revenue ÷ nights, grouped by Room Type (§1.6). **LP merged in when selected** (2026-08-26) via `sales_booking_lp_monthly_roomtype` — see §11 for the nights-allocation caveat. |
| Nights Share by Room Format | Each room type's nights ÷ total nights (no separate room-count-by-type reference exists, so this is a nights-share reading rather than a true occupancy %). LP included in both the per-type and total-nights figures when selected. |
| Revenue by Room Format & FY | Room Revenue by Room Type, grouped by FY. **Chart type changed 2026-08-24**: room type on the x-axis, one bar per FY per cluster (was: FY on x-axis, stacked by room type — stacking hid the per-segment baseline, making cross-FY comparison hard). **LP merged in when selected** (2026-08-26) — exact, not estimated (see §11). |
| **Additional Occupancy Bookings/Revenue** | **Not available.** No supporting column found across the 7 in-scope tables (PRD §3.6). Shown as an explicit placeholder, not fabricated. |
| Corporate Account Retention | For each consecutive FY pair: % of companies with `Contract_Status = 'Contract'` in the earlier FY that also appear (any status) in the later FY. **Not period-filter-scoped** (2026-09-09) — inherently an FY-vs-FY question, unaffected by the narrowing below. |
| **Company Rankings** (Revenue / Nights / ADR / Contribution % tabs) | **One `TabbedCard`, 2026-09-09** — was three separate cards (Contract Status & Ranking, the old "Company Contribution By" 3-column table, and a standalone Contribution % chart) all ranking the same ~70 companies by a different metric; merged per explicit "keep tabs, shift internal for metric" direction. Every tab is scoped to the active period tab, not always the whole FY (**Corporate Account Retention above is the one exception**). Each tab shows the full ranked company list inside the same `Expandable`. **Sourcing rewritten 2026-09-09, later same day**: Nights/Revenue/ADR now come from `sales_booking` (PMS), joined to `b2b_bills` on `(Property, FolioNo = Folio_No)` purely for company identity (`Bills_due_from`) and `Contract_Status` — not read from `b2b_bills`' own `Nights`/`Room_Revenue`/`ADR` columns anymore. That old design undercounted (75% of true PMS B2B revenue for a fully-billed month) and lagged real stays by however long a bill takes to reach `b2b_bills` (BH4's real September B2B revenue had zero matching `b2b_bills` rows under any label). See revision history for the full before/after validation. A "X% of this period's B2B revenue is mapped to a company below" line under the B2B Contracts heading states current coverage — ~99% for an already-billed month, 0% where no bills have been raised yet for that scope. |
| — Revenue tab | Companies ranked by `SUM(sales_booking.DailyRevenue)` for their matched folios (tax-exclusive), bars color-coded by `Contract_Status` (green/amber), each bar's own ADR shown as a text label to its right. Chart type changed 2026-09-09: Treemap → sorted horizontal bar chart — a treemap's area-encoding was hard to compare precisely across ~70 companies; bars rank and scale better. The contract-status donut + "X of Y companies under contract" caption above the chart is specific to this tab (contract-status coloring doesn't apply to the other three metrics). |
| — Nights tab | Same companies, re-sorted by `SUM(roomNightUnitsSqlExpr())` descending — weighted the same way every other nights figure on the dashboard is (BH4's "3 Bedroom Apartments" rows count 3×). |
| — ADR tab | **Simplified 2026-09-09, later same day** — used to be a separate `getB2bTopAdrContracts` query, `AVG(ADR)` over individual `b2b_bills` rows; now that Nights/Revenue/ADR all come from the same PMS-sourced ranking, this tab is just that same array re-sorted by its own `adr` field (`roomRevenue ÷ nights`, a weighted average, matching how ADR is computed everywhere else on this dashboard), filtered to `nights > 0`. `getB2bTopAdrContracts` was retired. |
| — Contribution % tab | Each company's `SUM(Room_Revenue)` ÷ **total company-wide revenue across every channel** (B2B+B2C+OTA, from `sales_booking`, same Property+period scope) — i.e. what share of Skyla's *entire* business this one B2B company represents, not its share of the B2B channel alone. Went through two earlier, narrower definitions (share of Contract-status revenue only, then share of all-B2B revenue only) before landing here 2026-08-24. **Open question (2026-09-09, not yet resolved)**: the equivalent Looker Studio panel appears to be a lifetime/all-time ranking rather than period-scoped — see revision history's "Verified against the user's own This FY Looker Studio reference" entry. |
| — "Contract revenue achieved" (summary tiles above the Revenue tab) | `SUM(Room_Revenue)` **restricted to `Contract_Status = 'Contract'` rows only** — deliberately narrower than that tab's own bars, which show each company's total revenue regardless of status. Not to be confused with each other. |

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

Date scoping uses `LEAD_DATE_EXPR` (`SAFE_CAST(SUBSTR(date, 1, 10) AS DATE)`),
**both for filtering (`whereForRange`'s WHERE clause) and for bucketing**
(`getLeadsTrend`'s day/month/FY grouping) — fixed 2026-09-08 (see revision
history) after the WHERE clause was found comparing `date` as a plain STRING,
which silently dropped every lead recorded on the exact last day of whatever
period was selected. Scoping is on the `date` column (lead capture date), not `Check_in_date_2`
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
| B2C Leads | `COUNTIF(Source IN ('Exotel', 'Business WA', 'Website'))` — broadened 2026-08-24 from `Exotel` only to also include WhatsApp (`Business WA`) and `Website` inquiries, all genuine B2C acquisition channels. Displayed on the dashboard as "New Leads". Card sub-label shows "X closed → Y% conversion rate" (relabeled 2026-09-08 from "→ Y% achieved", progress bar removed — see revision history) — Y% here is that segment's own Closed ÷ Total, same basis as the top-row Conversion Rate above but narrowed to this one lead segment. |
| B2C Leads Closed | Same source set, `AND Stage = 'Closed'` |
| Existing Leads Closed | `COUNTIF(Source = 'Existing' AND Stage = 'Closed')` — same "X closed → Y% conversion rate" caption pattern as New Leads above, no progress bar |
| Reference Leads Closed | `COUNTIF(Source = 'Reference' AND Stage = 'Closed')` — same "X closed → Y% conversion rate" caption pattern as New Leads above, no progress bar |
| Booking Pace | `AVG(Booking_Pace)` — a precomputed sheet column |
| Leads MoM | Total vs Closed, by fiscal month, for the selected FY. **Now respects the Property filter** (previously ignored it despite `lead_tracker` having a `Property` column — fixed 2026-08-24). |
| Leads by Property | Grouped by the remapped display property. **Bars coloured by brand** (2026-09-10) — Skyla crimson / Aptly plum / Hyber orange, same `BRAND_COLOR` used on Overview's property/brand charts. |
| Leads by Source | Grouped by raw `Source` |
| Format-wise Leads & Revenue | Grouped by `Format`. **2026-09-10**: `lead_tracker.Format` is free text (`Premier`, `Executive`, `Studio`, `1BHK`…) — the three "By Format" charts now display-normalise it to the dashboard's room-type vocabulary (`Premier` → **Premiere Supreme**, `Executive` → Executive Room, `Studio` → Studio Room, `1BHK`/`2BHK` → `1 BHK`/`2 BHK`, `Hyber Go`/`Hyber Lite` → `Hyber Room Go`/`Hyber Room Lite`) and colour each bar with the matching `ROOM_TYPE_COLOR`, so Leads and Bookings' room-format charts read the same. `3BHK`/`4BHK` have no single room-type equivalent — shown as-is in the neutral baseline colour. Underlying grouping/counts unchanged. |
| ADR by Format | `SUM(Total) ÷ SUM(No_of_nights)`, **closed leads only** |
| Lost Leads Reasons | Non-`Closed` `Stage` values, with `"Not Intersted"` (a sheet typo) folded into `"Not Interested"` |
| By Owner | Revenue, Total/Closed leads, Closed %, Exotel leads/closed, Reference, Existing leads, and ADR (`SUM(Total) ÷ SUM(No_of_nights)` on closed leads), grouped by `Owner`. **Filtered to real employee names only** (2026-08-25): `Owner` also has lead-*source* values leaking into it (`Business WA`, `Website`, `Walk in`/`walk in`) alongside the 5 real names (Anjali, Rajesh, Dikhita, Sajal, Bhanu) — `Owner` is meant to be employee-level, so those 3 are excluded (`LOWER(TRIM(Owner)) NOT IN ('business wa', 'website', 'walk in')`). Those channel names still correctly appear on **Leads by Source**, a different chart keyed off `Source` — this exclusion only applies to the Owner-grouped table. **Grand total row added** (2026-08-27): `getLeadsByOwner()` now returns `{rows, total}`, with `total` computed from the true underlying summed counts/revenue across every owner — not by averaging each owner's own Closed %/ADR, which would misrepresent the combined figure across owners with very different lead volumes (same principle as the Targets §6.1 property-total fix). Verified: the total row's `totalLeads`/`closedLeads`/`revenue` exactly equal the sum of the individual owner rows. |

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

**EaseMyTrip, MakeMyTrip, and go-mmt combined into one "GoMMT" row (2026-08-27,
user direction)** — a further display grouping on top of the case-variant
folding above, via a new `otaBreakdownDisplayNameSqlExpr()`
(`lib/reference/bookingSourceMap.ts`), used only by this tab's `GROUP BY`.
Doesn't touch §1.3's B2B/B2C/OTA category (all three are already OTA) or the
per-row commission rate lookup (`commissionRateSqlExpr` still keys off each
row's own raw `Source` before this grouping applies) — and since all three
already carried the same 20% rate (§1.4), the combined row's blended
commission % comes out at exactly 20%, unchanged from what each showed
separately. Verified against live BigQuery: exactly one "GoMMT" row appears,
no stray EaseMyTrip/MakeMyTrip/go-mmt rows remain.

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
| Total Reviews (OTA) | `COUNT(*)`, date-scoped via `SAFE_CAST(DATE AS DATE)` — `ota.DATE` is also a STRING column (unlike `rating_sheet.Date`, a real DATETIME); switched from a bare `CAST` 2026-09-08, defensively, after the same bare-CAST pattern crashed the Leads page once a malformed row synced in (§7) — no row in `ota` currently fails the cast, this only prevents a future repeat |
| Rating Count Trend (both) | `COUNT(*)` by fiscal month, **for the single selected FY only** |

The trend is deliberately scoped to one FY, not "one line per FY" like the
Trends tab — `rating_sheet`/`ota` hold review history back to **2013/2016**
(over a decade before `sales_booking` starts), so an unscoped trend produced a
15-series chart spanning `FY 13-14` through `FY 26-27`. §6.8 of the PRD only
specifies "monthly x-axis," not a multi-year comparison, so this tab follows
the FY filter like every other section rather than showing full history.

---

## 10. Known data caveats (accepted, not bugs)

- **BH4's `sales_booking` pipeline gap has closed.** This doc originally
  noted BH4 at zero rows in `sales_booking`/`sales_booking_cancelled` despite
  being Active; confirmed 2026-09-08 that BH4 now has live, non-trivial
  volume (e.g. 294 Sept-2026 room-nights). Not re-audited beyond confirming
  non-zero volume — if a BH4-specific figure still looks off, don't assume
  this note's old "known gap" explanation still applies. **LP is a different,
  still-current case** — see §11; LP will never get a live PMS feed (retired
  hotel), so its numbers come from a one-time backfill instead of a sync.
- **Residual PMS-vs-BigQuery gap on room-nights, small and inconsistent by
  property** (2026-09-08): after excluding Void/No-Show rows (see revision
  history), Sold Room Nights still doesn't tie out exactly to the business's
  own PMS Annual Sales Report — Sept 2026 was ~1,999 (BigQuery) vs 2,072
  (PMS report), and the per-property direction isn't consistent (BH4 and JHS
  read lower in BigQuery, KDP/HTC/GB read close to the report). This doesn't
  match any single-cause explanation found so far (not Void/No-Show — already
  excluded; not a room-count error — Available Room Nights now ties out
  exactly to the report at 5,100). Treated as ordinary PMS→BigQuery sync
  timing lag rather than a dashboard logic bug, but not independently
  confirmed — if it grows or a specific property's gap looks large, it's
  worth asking whoever owns the eZee/BigQuery sync rather than assuming it's
  this dashboard's calculation. **Update 2026-09-09, then corrected same
  day**: BH4 specifically had a materially larger gap than the rest of the
  portfolio (Sept 2026 Sold Room Nights read 282 vs Looker Studio's 332),
  first suspected to be a sync-completeness gap — but it turned out to be a
  real, fixable formula bug, not a sync issue: BH4's "3 Bedroom Apartments"
  rows needed a ×3 room-night weighting that a plain `COUNT(*)` didn't apply
  (see §2's Sold Room Nights row and the revision history entry for the
  full fix). Fixed; BH4 now matches Looker Studio exactly. JHS/HTC/KDP's own
  small single-digit-percent gaps against Looker Studio remain and are still
  believed to be ordinary sync lag (unaffected by this fix, re-confirmed
  unchanged) — this general note otherwise still stands for them.
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
- **Corporate Account Retention's most recent FY-to-FY point can understate
  the current FY's true company count**, checked 2026-09-09 during the
  Company Rankings PMS-join rewrite (see §3/revision history) — deliberately
  NOT fixed the same way, so documenting it here instead. Retention still
  determines "did company X appear in FY Y" by checking `b2b_bills`
  directly (`Contract_Status` is a `b2b_bills`-only concept with no PMS
  equivalent, so a join can't fully replace this the way it did for
  Nights/Revenue/ADR). A company that has genuinely already returned in the
  current FY per `sales_booking` won't count as "retained" here until its
  bill is entered — so the FY25-26→FY26-27 point (72%, 52 of 84) is likely
  a floor, not the true figure, and will drift upward on its own as
  billing for FY26-27 catches up. The completed FY24-25→FY25-26 point
  (79%) isn't affected the same way (both its FYs are long-since fully
  billed). Not fixed because it would require redefining "presence in a
  FY" via a `sales_booking` join for this one metric while every other
  Retention concept (`Contract_Status` itself) stays `b2b_bills`-only —
  a bigger, more invasive change than this pass's scope; flagged instead
  of silently left.

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

---

## 12. Reports tab (2026-09-08)

Source: `Skyla_Dashboard_Reports_Tab_PRD.md`, `lib/bigquery/queries/reports.ts`.
One nav item ("Reports"), two reports switched by an in-page toggle
(`ReportsContent.tsx`) rather than a second route. **Both reports are fixed
to FY 26-27 and ignore the global period-tab filter** — only Property
narrows them (same convention as Property Targets' fixed-FY section on
Performance). Property universe is fixed to `KDP/HTC/JHS/BH4/GB` — no LP (no
live PMS feed, not a column in either source sheet) and no FO (not a room
property) — narrowed further by the Property filter, never widened past
this set (`lib/reference/reportProperties.ts`).

**Governing principle** (PRD §0, load-bearing for the whole tab): the source
Revenue Workbook sheets are a template for structure/labels/formulas only —
never the source of values. Confirmed live: the sheet's Oct26–Mar27 columns
are frozen on April's exact figures (checked on two independent rows, Room
Revenue and F&B Revenue Share) — a sheet-side formula bug. Both reports
below compute every cell fresh from `sales_booking`/`b2b_bills`, so they're
unaffected by that bug and will show real (if currently unverifiable
against the live sheet) figures for those months.

### 12.1 Folio Based Report FY 26-27

Table: metric rows × (Property ∪ TOTAL) columns, grouped into 13 blocks —
"Overall – till date" (FY start through today, inclusive) then one full
calendar month per block, Apr 26 → Mar 27. Month blocks include real
advance-booking data for months after today (`sales_booking` legitimately
carries forward bookings) — not zeroed, not projected.

| Metric | Formula | Status |
|---|---|---|
| Room Revenue | `SUM(DailyRevenue)`, excl. Void/No-Show | Confirmed |
| F&B Revenue | `SUM(DailyOtherRevenueExclusiveTax)` | Confirmed |
| Total Revenue | Room + F&B | Confirmed |
| F&B Revenue Share | `SAFE_DIVIDE(F&B, Total)` | Confirmed |
| Available Room Nights | `getAvailableRoomNightsByProperty` (§1.5), scoped per block | Confirmed |
| Sold Room Nights | `SUM(roomNightUnitsSqlExpr())` excl. Void/No-Show — BH4's "3 Bedroom Apartments" rows weigh 3× (2026-09-09 fix, §2/revision history), every other room type weighs 1 | Confirmed — exact match to Looker Studio for BH4 Sept 2026 |
| Occupancy % | Sold ÷ Available | Confirmed |
| Guests Served | **`SUM(NoOfGuest)` across the booking's stay-nights (guest-nights)** — 2026-09-10, matched to the Bookings tab's own switch (see §7 Guests Served). Booking still bucketed to whichever month(s) its own nights fall in | Confirmed pattern |
| RevPAR / ADR / Rev per Guest | Revenue ÷ Available / Sold / Guests | Confirmed |
| B2B/B2C/OTA Nights, Revenue, ADR | `bookingCategorySqlExpr` classification (§1.3), same as Booking Details' Category Mix | B2B confirmed; B2C/OTA **not yet independently confirmed against the sheet** (PRD §1.3) |
| **B2B Revenue Share** | `SAFE_DIVIDE(b2b_bills' ALL-TIME SUM(Room_Revenue) for the property, RoomRevenue)` — **not the same B2B Revenue as the row above**, not ÷ Total Revenue, and **legitimately exceeds 100%** by design | Reconstructed from one confirmed data point (PRD's own KDP-Overall example, 265%) — verified live match: 260.2%. **Only the Overall column's magnitude was checked**; individual month columns produce much larger percentages (the same large all-time numerator against a much smaller one-month denominator) and are not independently confirmed |
| B2C/OTA Revenue Share | `SAFE_DIVIDE(category revenue, RoomRevenue)` — a normal, always-≤100% share, unlike B2B's | Not yet independently confirmed (PRD §1.3) |
| Total Bookings, Repeat Count, Unique Count, Repeat %, ALOS | Booking-grain, same guest-key/ReservationNo logic as `getBookingStats`/`getRepeatBookingShare`, reapplied per block's own range — a guest who stayed in two different *month* blocks isn't "repeat" in either individual month, only in a range spanning both (e.g. Overall) | Row grouping not yet independently confirmed against the sheet (PRD §1.3) |
| Expat Bookings/Revenue/Revenue%/Nights/ALOS/Repeat Count/Repeat Share | Same `Country != 'India'` filter as §3, restricted to expat bookings for the repeat calc too | Not yet independently confirmed (PRD §1.3) |

Two real bugs found and fixed during the build (see revision history for
full detail): a NULL-vs-NULL SQL join silently zeroing the "Overall"
block's repeat counts specifically, and the frontend crashing when the
Property filter narrowed the column set below the full 5 properties. Both
verified fixed live before commit.

### 12.2 FY 26-27 B2B Details

Two zones, both from `b2b_bills`, `Financial_Year = 'FY 26-27'` (junk `'FY
99-00'` rows excluded, same as every other `b2b_bills` query — §3's B2B
section):

- **Zone A** — Company × Month pivot (`Bills_due_from` as identity, same
  convention as Contract Status & Ranking, §3): Total Revenue/Nights/ADR
  (`SUM(Room_Revenue)`, `SUM(Nights)`, `SAFE_DIVIDE`), then one Revenue/
  Nights/ADR triplet per fiscal month present in the data. Sortable by any
  total column (default: Revenue desc). A totals row is computed from the
  true summed Revenue/Nights across every company, not averaged from
  per-company ADRs.
- **Zone B** — one row per bill: Property, Guest Name, Check In, Bill Date,
  Inv No, Business Source, Nights, Bills due from, Room Revenue, POC, Month
  — a direct `SELECT` off `b2b_bills`' own columns (`Guest_Name`,
  `SUBSTR(Check_In, 1, 10)`, `Bill_Date`, `Inv_No`, `Business_Source`,
  `Nights`, `Bills_due_from`, `Room_Revenue`, `POC`, `Month`), sorted by
  Property then Check In.

Both zones respect the Property filter (pre-filters `b2b_bills` rows before
pivoting/listing). Verified live: KDP-filtered Zone A total revenue (₹2.11
Cr) exactly matches an independent all-time-FY26-27 KDP query run during
the build's own investigation of the B2B Revenue Share formula above.
