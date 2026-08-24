# HANDOVER — Skyla Analytics (Pipeline status + Sales Dashboard PRD + Build)

**Project:** skyla-analytics / BigQuery dataset `Skyla_Sales_Automation`
**This doc supersedes the previous HANDOVER.md** — Part A carries forward the prior pipeline session in condensed form, Part B documents the PRD-writing session, Part C documents the actual dashboard build, **Part D (new) documents post-launch testing and corrections** — several formulas from the original PRD/build turned out wrong once tested against real numbers; Part D is the fix log. Upload this file to Project Knowledge in place of the old one.

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

## Open items from Part B (status as of Part C — see below)

1. ~~Supply the missing OTA commission rates~~ — **Resolved in Part C**: BH4 Booking.com 15%, Travex 20% flat. The generic `"OTA"` source label is still unresolved (0%, no rate ever supplied) — the only item from this list still open.
2. ~~Hand `Skyla_Sales_Dashboard_PRD.md` to Claude Code~~ — **Done, see Part C.**
3. Expats / Repeat Booking definitions — **still the original PRD assumptions, unchanged.** Not revisited during the build; flag if the business wants a different definition.
4. No pipeline items remain open from Part A.

---

# PART C — Dashboard build (this session, full detail)

## C.1 Session goal

Implement `Skyla_Sales_Dashboard_PRD.md` end to end: Next.js + BigQuery data
layer, shared-login auth gate, responsive UI shell, and every KPI in the §6
catalog wired to live data — then, on request, restructure the tabs and add
several KPIs to match the team's existing Looker Studio dashboard more
closely. Deployment target is Vercel; **not pushed to GitHub or deployed
during this session** (explicitly out of scope — user handles that step).

## C.2 Stack

Next.js 16 (App Router, Server Components fetch BigQuery directly — no
separate API layer needed), `@google-cloud/bigquery`, Recharts, Tailwind,
`jose` (session JWT) + `bcryptjs` (password hash) for the auth gate. Full
rationale and file layout: see the repo's own `AGENTS.md`/project structure,
or ask for it again — not duplicated here.

## C.3 Real-data findings during implementation (none were in the PRD)

These surfaced only once real BigQuery data was queried — each one is now
handled in code and documented in `Skyla_Dashboard_KPI_Logic_Reference.md`:

- **BH4 and LP have zero rows in `sales_booking`/`sales_booking_cancelled`**,
  despite BH4 being listed Active. Confirmed by enumerating every distinct
  `Property` value across both tables — only KDP/HTC/JHS/GB appear. This is a
  pipeline gap (BH4 has real data in `b2b_bills`/`lead_tracker`/`rating_sheet`,
  just not the two booking tables), not a dashboard defect. **Decision:
  build it anyway** — BH4/LP show zero/blank stay-based KPIs until the eZee
  sync backfills; unaffected tabs (B2B, Leads, Reviews) show BH4's real data.
- **GB's actual active window starts 2024-04-02**, not "mid-2026" as
  originally documented — real StayDate data contradicted the reference doc.
  Available Room Nights now uses each property's empirical `MIN/MAX(StayDate)`
  instead of a hardcoded date, for all properties.
- **Room→RoomType join only matched 37% of real rows** — the reference
  sheet's `Room` values carry a room-number prefix (`"107-Studio Supreme"`)
  that most real `sales_booking.Room` values don't have. Fixed via
  number-prefix normalization (37% → 99.997% match rate, verified no
  duplicate-row fan-out from the join). GB needed a separate fix since its
  room *number* — not just the text — decides Room vs Lite vs Go.
- **`lead_tracker` has two Property codes outside the 6-property reference
  table**: `KOND` (1,017 rows) and `JH44` (729 rows). User-confirmed remap:
  `KOND → KDP` (Kondapur), `JH44 → JHS` (Jubilee Hills).
- **`b2b_bills`'s own `Financial_Year` column uses a different FY convention**
  than the standard Apr–Mar rule (a `2024-03-31` row is labeled `FY 24-25`,
  not `FY 23-24`). Trusted as-is rather than recomputed, same principle as
  `leadership_targets`.
- **`rating_sheet`/`ota` hold review history back to 2013/2016** — over a
  decade before `sales_booking` starts. The Reviews tab's rating trend is
  scoped to the selected FY (not "one line per FY" like Trends) specifically
  because of this — an unscoped version produced a 15-series chart spanning
  `FY 13-14` to `FY 26-27`.
- A handful of small query bugs were caught by cross-checking totals between
  independent queries and fixed: NULL `ReservationNo` rows double-counting
  bookings, `"Go-MMT"` vs `"go-mmt"` showing as duplicate OTA rows, and a
  BigQuery `HAVING`-clause case-insensitive alias collision.

## C.4 Decisions made this session

| Decision | Answer |
|---|---|
| BH4/LP zero booking rows | Known pipeline gap — build it anyway |
| GB Available Room Nights window | Use empirical `MIN/MAX(StayDate)`, not a hardcoded date |
| `lead_tracker` KOND/JH44/null Property | Remap KOND→KDP, JH44→JHS; null shown as literal `"null"` |
| Room→RoomType mismatch | Normalize by stripping the room-number prefix; GB reconstructs its key from `RoomNo` |
| Quarter filter alignment | Fiscal, matching the Apr–Mar FY (Q1=Apr-Jun … Q4=Jan-Mar) |
| Booking.com/BH4 commission | 15% |
| Travex commission | 20%, flat across all properties |
| Generic "OTA" label commission | Left at 0% (unresolved, matches original PRD placeholder) |
| Shared login credentials | `Skyla_Sales` / user-supplied password, stored as env vars (bcrypt hash for the password) |
| Multi-select scope | Property and Month are multi-select; FY and Quarter stay single-select |

## C.5 Dashboard structure — restructured mid-build to match the existing Looker Studio dashboard

The PRD's original catalog was delivered first as 7 tabs (Overview, Guest
Detail, Trends, Brand & Category, Targets, Leads, OTA+Reviews combined). The
user then shared screenshots of the team's existing Looker Studio dashboard
and asked for the structure to match it more closely. **Final structure is 8
tabs**, left-sidebar nav (teal, matching the Looker branding) instead of the
original top-tab-bar:

**Revenue Details · Booking Details · Trends · Brand · Targets · Lead Tracker
· OTA Breakdown · Reviews**

B2B Contracts (ranking, top ADR, retention) folded into Booking Details rather
than a standalone tab, matching the Looker layout. OTA and Reviews split back
apart into two tabs (they'd been combined for scope reasons early in the
build). Full KPI-to-tab mapping is in `Skyla_Dashboard_KPI_Logic_Reference.md`.

**KPIs added** during the restructure, beyond the original PRD catalog:
Revenue per Guest, B2C Leads / B2C Leads Closed, an explicit Expat Nights
tile, a Leads-by-Owner table, a monthly "Revenue Targets with Roll Over"
3-line chart (Dept Target / Target w/ Roll Over / Achieved), and an OTA
Breakdown grand-total row. **Additional Occupancy Bookings/Revenue** was
requested again here — still not implemented, same reason as the original
PRD exclusion (no supporting data column); shown as an explicit "not
available" placeholder rather than a fabricated number.

## C.6 Multi-select Month filter — architecture note

Originally Month was single-select. Reworked to multi-select on request,
which required changing date-scoping across all 9 query files: a `BETWEEN`
date range breaks for a non-contiguous selection (e.g. "Apr + Dec" would wrongly
include May–Nov under a range). Now filters as
`FY label = @fy AND EXTRACT(MONTH FROM date) IN UNNEST(@months)` everywhere.
Verified directly against BigQuery post-rework (Apr+Dec FY25-26 → exactly
₹3.75 Cr / 6,627 nights, matching a direct two-month query, not the ₹15.4 Cr
a range would have wrongly produced).

## C.7 Deployment status

- **Superseded by Part D** — the dashboard is now live in production on
  Vercel, pushed to GitHub (`analytics272/skyla-sales-dashboard`), and has
  been through several rounds of post-launch correction. This section is left
  as a historical record of the initial handoff state.
- Originally: **not deployed, not pushed to GitHub** — explicitly held back per user
  instruction. Local git repo is initialized and staged; user runs the commit
  and push themselves.
- `.env.local` and the BigQuery service account key are gitignored; confirmed
  excluded from the staged commit before handing off push instructions.
- **Found and documented a real Vercel-specific gotcha**: the bcrypt password
  hash contains `$` characters, which Next.js's local `.env` file loader
  (`@next/env`, uses dotenv-expand) interprets as variable interpolation and
  silently mangles into an empty string — login failed locally until this was
  found and the `$` characters were backslash-escaped in `.env.local`. That
  escaping is **only correct for the local `.env` file** — Vercel's dashboard
  stores env vars as literal strings with no such parsing, so the *unescaped*
  raw hash (real `$`, no backslashes) is what belongs there. Pasting the
  escaped local value into Vercel produces the "works locally, invalid in
  production" symptom — this exact mix-up happened once already and was
  corrected.

## C.8 Deliverables produced this session

- The full dashboard application (all files under `app/`, `components/`,
  `lib/`, plus `middleware`→`proxy.ts` per Next.js 16's rename).
- `Skyla_Dashboard_KPI_Logic_Reference.md` — every KPI/chart across all 8
  tabs with its exact formula and data source, for anyone auditing the
  numbers without reading the code.
- This updated `HANDOVER.md`.

## Open items, as of end of Part C

1. **Generic "OTA" source label commission rate** — still 0%, never supplied. Only remaining gap from the original OTA commission table.
2. **Expats / Repeat Booking definitions** — still PRD-documented assumptions, never revisited with the business.
3. **BH4/LP booking-table pipeline gap** (§C.3) — a pipeline issue, not a dashboard one; will self-resolve once the eZee sync backfills BH4/LP into `sales_booking`.
4. ~~**Deployment**~~ — **done, see Part D.** Repo pushed to GitHub, connected to Vercel, live in production.
5. **Additional Occupancy Bookings/Revenue** — still no supporting data column found; would need a new source (not one of the 7 in-scope tables) to ever populate this KPI.

---

# PART D — Post-launch testing and corrections (this session)

## D.1 Session goal

The dashboard from Part C went live on Vercel and through several rounds of
user testing against the real numbers (side-by-side with the business's own
knowledge of what things should look like, and against the legacy Looker
Studio dashboard's layout/conventions). This part is the fix log for what
that testing turned up — several formulas were wrong, not just cosmetically
off. Full before/after detail for every KPI lives in
`Skyla_Dashboard_KPI_Logic_Reference.md` §0 (Revision History); this section
is the narrative summary of what happened and why, session by session.

## D.2 Login / Vercel env var mixup (recurrence)

The exact `$`-escaping mixup documented in §C.7 recurred — an escaped local
`.env.local` value was pasted into Vercel's dashboard, which doesn't parse
`.env` files that way. Same fix: the raw unescaped bcrypt hash is what
belongs in Vercel's env var UI, no backslashes.

## D.3 Property filter gaps

Three B2B Contracts functions (`getB2bContractRanking`,
`getB2bTopAdrContracts`, `getCorporateAccountRetention` in
`lib/bigquery/queries/b2bContracts.ts`) and `getLeadsMoM`
(`lib/bigquery/queries/leads.ts`) silently ignored the Property filter
entirely, despite `b2b_bills` and `lead_tracker` both having a `Property`
column. Found by an explicit code audit (not just user report) after the
user flagged "not all filters are applied for each graph" — all four now
scope by Property like every other query on the dashboard.

## D.4 B2B Bills: company identity and revenue source, re-specified

Two related corrections, made together after direct business input (this
wasn't discoverable from the data alone):
- **Company identity**: group by `Bills_due_from` (the operational name used
  day-to-day) instead of `Company`/`Bill_To` (the legal entity name) — company
  count for the same scope drops from 436 to ~280 as multiple legal entities
  collapse under one operational name.
- **Revenue figures**: `Room_Revenue` (tax-exclusive) instead of `col_21`
  ("Room Charges With Tax") — the dashboard is meant to show tax-exclusive
  figures throughout.

Both changes are confined to `b2b_bills`-sourced KPIs (Contract Status &
Ranking, Top ADR Contracts, Corporate Account Retention, and the now-merged
"Nights/Revenue/ADR by Company" table) — the B2B *category* used elsewhere
(Revenue by Source, Trends, Brand — all from `sales_booking.Source` via
`bookingSourceMap.ts`) is a separate, unrelated classification and wasn't
touched.

## D.5 Contribution % — three attempts to get the definition right

Worth recording because it's a good example of how much a single vague
phrase ("company's contribution") can hide: three distinct definitions were
implemented in sequence, each replacing the last, before landing on what the
business actually meant.
1. **First**: share of `Contract_Status = 'Contract'` revenue only (a narrow
   pool — non-contract companies got no contribution % at all).
2. **Second**: share of total B2B revenue across every company in the
   filtered scope (all contract statuses) — closer, but still confined to
   the B2B channel.
3. **Final** (confirmed via explicit multiple-choice question to the user):
   each company's B2B revenue ÷ **total company-wide revenue across every
   channel** (B2B+B2C+OTA combined, from `sales_booking`) — i.e. what share
   of Skyla's *entire* business this one B2B company represents.

Lesson for future work in this codebase: when a requirement names a
percentage/ratio without spelling out the denominator, don't guess past one
attempt — the cost of a wrong guess compounds (three implementation passes
here) whereas a clarifying question resolves it in one round trip.

## D.6 Target rollover — a real bug, not just a confusing number

The user pushed back hard on a rollover figure that looked obviously wrong
("how come 43 when target is 28") — this turned out to be two compounding
bugs, not one:
1. The sheet's own `Target_With_Roll_Over` column is corrupted for every FY's
   first month (April came out as a few lakh instead of ~₹2 Cr) — confirmed
   by reverse-engineering the correct formula from the other 11 months and
   finding April didn't fit it. Fixed by recomputing rollover in-app.
2. The recomputation itself then had a second bug: because a month that
   hasn't started yet always has `Revenue_Achieved = 0`, treating that as a
   genuine 100% miss caused every future month's "shortfall" to cascade
   fully into the next one, compounding a flat ₹28.00 Cr annual target up to
   ₹43.71 Cr summed. Fixed with a guard: once a month is calendar-future, its
   target-with-rollover is just its own flat target, no compounding penalty.
   Verified fix: same FY now sums to ~₹28.45 Cr, the expected relationship.

A related, separately-caught edge case: hospitality bookings land revenue
against future stay dates in advance, so a "future" month can still have
real partial data (confirmed: September showed ₹41.5L in `Revenue_Achieved`
despite being calendar-future when checked in August). The line-truncation
logic (§D.8) was adjusted so it only stops at a future month with genuinely
zero data, not any future month unconditionally.

## D.7 FY filter not reaching the Targets tab's monthly charts

The three monthly Target charts (Revenue rollover, ADR, Occupancy vs
achieved) were hardcoded to whatever FY `latestSelectedFy()` resolved to —
selecting multiple FYs (or "All") never changed what they showed, which the
user correctly flagged as the FY filter "not working." Fixed by rendering
one section per selected FY (small multiples) instead of trying to cram
multiple FYs into one line chart with a new color scheme.

## D.8 Line chart "stop instead of flatten" behavior

General principle applied across every FY-trend chart and the Targets
monthly charts: a month that hasn't happened yet should make the "actual/
achieved" line simply **stop** — not bridge a false diagonal across the gap
(the original `connectNulls` behavior), and not flat-line at 0 through the
rest of the FY either (an earlier, incomplete fix — 0 reads as "we sold
nothing," which is wrong for a month that hasn't started). The distinction
that matters: elapsed-and-genuinely-zero plots as a real 0 (line stays
flat); not-yet-started-and-empty stops the line; not-yet-started-but-with-
real-advance-booked-data still plots normally. Target/plan lines are never
truncated — those are meant to project across the whole FY.

## D.9 UI/UX fixes from direct user testing

- **Extra Revenue** switched to the tax-exclusive column, then the card was
  removed from the dashboard entirely.
- **`Website` booking category removed**, folded into B2C (was a near-empty
  4th category cluttering every B2B/B2C/OTA chart).
- **B2C Leads** broadened from `Source = 'Exotel'` only to also include
  `Business WA` (WhatsApp) and `Website` — both genuine B2C acquisition
  channels that were being undercounted.
- **Revenue by Room Format chart** changed from a stacked bar (hid the
  per-segment baseline) to room-type-on-x-axis grouped by FY.
- **Duplicate table removed**: "Nights/Revenue/ADR by Company" and "Contract
  Status & Ranking" were the same underlying `b2b_bills` data with different
  columns — merged into one.
- **Comparison strips added**: a reusable `FyComparisonStrip` component
  (value + arrow % vs the FY before it) now sits above every major per-FY
  chart, matching the format the business already uses in Looker Studio.
- **Chart x-axis labels**: `interval={0}` forces every category to render on
  the single-metric bar charts — Recharts was silently auto-skipping labels
  that would otherwise overlap (room format names, mainly).
- **Filter performance**: multi-select dropdowns (Property/Month/FY) used to
  fire one full server round-trip per checkbox click; selections now buffer
  locally and commit once, on Apply or on close. The "All" option is a single
  decisive action and still commits immediately (a first pass at this
  buffering fix accidentally made "All" wait for an extra Apply click too —
  caught and fixed the same session).
- **Reset Filters button** added; FY already defaulted to the current
  financial year automatically (date-driven, no fix needed there).

## D.10 Deliverables produced this part

- All corrections above, live in production.
- `Skyla_Dashboard_KPI_Logic_Reference.md` — added §0 Revision History, and
  updated every affected tab section in place to reflect current formulas.
- `Skyla_Sales_Dashboard_PRD.md` — added a post-launch-corrections pointer
  near the top, plus inline `~~strikethrough~~ → correction` notes at every
  affected formula, without deleting the original spec (kept as historical
  context).
- `Skyla_Reference_Data.md` — added a deviation note above the verbatim
  `Mapping.gs` source re: `Website` category removal (the script itself is
  left unedited as the historical record of what the external script does).
- This updated `HANDOVER.md`.

## Open items, current (supersedes the Part C list above)

1. **Generic "OTA" source label commission rate** — still 0%, never supplied.
2. **Expats / Repeat Booking definitions** — still PRD-documented assumptions, never revisited with the business.
3. **BH4/LP booking-table pipeline gap** — a pipeline issue, not a dashboard one.
4. **Additional Occupancy Bookings/Revenue** — still no supporting data column found.
5. **A "per-property revenue targets" reference** was mentioned but the
   attachment didn't come through in-session — needs to be resent before it
   can be acted on.
