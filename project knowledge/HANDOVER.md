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

## D.10 Contribution %, the "All" filter regression, and a real performance bug

Three more rounds of direct testing turned up:
- **Contribution % denominator, final answer**: after the two attempts in
  §D.5, the business gave a direct answer — each B2B company's contribution
  should be measured against **total company-wide revenue across every
  channel** (B2B+B2C+OTA combined, from `sales_booking`), not just its share
  of the B2B channel. Implemented by querying `sales_booking` for the same
  property+FY scope as a new denominator. Values dropped from ~5-10% (B2B-only
  share) to correctly small whole-business shares.
- **"All" filter regression, self-inflicted and caught**: the buffered-apply
  fix from §D.9 accidentally made the "All" option in every multi-select
  dropdown wait for an extra Apply click too, instead of committing
  immediately like it always had — this read as "the filter doesn't work."
  Fixed: "All" is a single decisive action, unlike checking boxes one by one,
  and commits immediately again.
- **A genuine duplicate-query bug**: the multi-FY small-multiples fix in §D.7
  had an unnoticed side effect — `getRevenueAchievement` was re-fetching the
  exact same per-FY monthly rows that the page had already fetched separately
  for the monthly chart, roughly doubling this page's BigQuery round trips.
  Extracted a pure `summarizeRevenueAchievement()` that reuses already-fetched
  data instead of re-querying.

## D.11 "Filter feels broken/slow" — root cause was a missing loading state

User report: FY filter "still not working," and filters "taking a lot of
time to load." Traced both to the same cause: **there was no `loading.tsx`
anywhere in the dashboard**, so a filter change left the old page completely
frozen on screen for however long the BigQuery refetch took (measured ~2
seconds with the dedup fix above), with zero visual feedback — indistinguishable
from "nothing happened." The FY filter's *mechanism* was re-verified correct
at both the component and query level before concluding this — true, but
incomplete: see §D.13 for the actual semantic gap this missed.

Fix: added `app/(dashboard)/loading.tsx`, a shared skeleton Next.js shows
instantly on any navigation in the route group. **Caveat worth remembering**:
adding this to an *already-running* Turbopack dev server hung every page
until the dev server was restarted — reproduced by removing/re-adding the
file and confirmed it wasn't a code bug. Doesn't affect a fresh `npm run dev`
start or a Vercel build (both compile from scratch). Any future session
adding a new special Next.js file (`loading.tsx`, `error.tsx`, etc.) to a
long-running local dev server should expect this and mention it up front.

## D.12 Revenue targets by property (new feature, fixed reference data)

The business provided `FY27 Turnover Projection.xlsx` — a monthly revenue
plan broken out **per property** (Kondapur/KDP, Hitec City/HTC, Jubilee
Hills/JHS, Banjara Hills/BH4, Gachibowli/GB), confirming that
`leadership_targets.dept_Total_Target` is exactly the sum of these five
properties' targets (verified against live BigQuery, every elapsed month
matched to the rupee). Explicit user direction: these per-property targets
are **fixed for FY 26-27 and won't change**, so no BigQuery pipeline was
built for them — they're hardcoded as reference data
(`lib/reference/propertyTargets.ts`), compared against **live** achieved
figures from `sales_booking` (`lib/bigquery/queries/propertyTargets.ts`).
New table on the Targets tab: Property × Target/Achieved Revenue, Occ%, ARR.
Full formula detail in `Skyla_Dashboard_KPI_Logic_Reference.md` §6.1.

## D.13 The real "All" FY bug — a semantic gap, not the filter mechanism

D.11 re-verified the FY filter's *mechanism* (component + query wiring) and
found it correct, and attributed the "not working" report entirely to the
missing loading state. That was real but incomplete — the user came back
with a sharper diagnosis: "when I select All, it should apply to every
visual... show data across all available financial years," and asked for a
check across the whole dashboard, not just whether the dropdown's selection
state changes. Two real gaps, found by grepping every `latestSelectedFy(...)`
call site rather than guessing:

1. **"All" was semantically a no-op.** `resolveSelectedFYs()` treats an empty
   FY selection as "default to the current FY" (by original design, so a
   fresh page load lands on something sensible). But the FY dropdown's "All"
   button *cleared* the selection to get that same empty state — so clicking
   "All" was functionally identical to clicking just "FY 26-27." Fixed
   without touching the default-resolution logic (which is still correct for
   a fresh, untouched page load): `MultiSelectDropdown` gained an `allValue`
   prop — what "All" writes when clicked, defaulting to `[]` (unchanged
   behavior for Property/Month, where empty already means unrestricted).
   FY's dropdown now passes all 3 known FY labels, so clicking "All" writes
   an explicit 3-FY selection to the URL instead of clearing it.
2. **Two charts were hardcoded to one FY regardless of selection**, found via
   `grep -rn latestSelectedFy`: Revenue Details' two small monthly charts
   (inside the Room Revenue and Occupancy hero cards) and Leads MoM. Every
   other query on the dashboard already correctly summed across whatever FYs
   `resolveSelectedFYs()` returned — these two just never got the memo. Fixed
   both to the same "one line/section per selected FY" pattern already
   proven on Trends and Targets (`pivotByFiscalMonth` + `MultiSeriesLineChart`
   for the two Revenue charts, small-multiples for Leads MoM).

Verified against live BigQuery: Room Revenue with all 3 FYs selected sums to
~₹48.87 Cr vs ~₹8.89 Cr for FY 26-27 alone; `pivotByFiscalMonth` with 3 FYs
correctly produces one column per FY per month; Leads MoM correctly returns
different data per FY (1/12/5 months of data for FY24-25/25-26/26-27
respectively, matching real data availability).

## D.15 Property-targets total row, layout width, and Lead Tracker "By Owner" cleanup

Further direct testing after §D.12-13 shipped turned up:
- **Property-targets total row was broken**: the footer summed only Target/
  Achieved Revenue and hardcoded Occ%/ARR to "—", rendering as a blank dash
  row. `getPropertyTargetComparison()` now returns a properly computed
  `total`, derived from the true underlying sold/available-nights sums
  across every included property — not from averaging each property's own
  ratio, which would misrepresent the combined figure across properties with
  very different room counts (63 rooms at KDP vs 18 at BH4, etc). Verified: a
  single-property selection makes the total exactly equal that property's row.
- **Property filter on the Targets tab, clarified not "fixed"**: the
  per-property targets table already fully respected the Property filter
  (verified via BigQuery: 5→1→2 rows narrows correctly) — the "Company-wide,
  not property-scoped" caption was removed per request, but the *other*
  company-wide Targets charts (Revenue Achievement, B2B/B2C/OTA, the three
  monthly charts) genuinely still can't be property-scoped, since
  `leadership_targets` has no Property column at all. Removing the caption
  doesn't change that constraint — flagged directly in chat since the UI no
  longer explains it.
- **Dashboard layout width**: `app/(dashboard)/layout.tsx`'s `mx-auto
  max-w-7xl` was capping the content area well short of the viewport on wide
  screens, leaving a large empty margin. Removed — content now fills the
  space next to the sidebar.
- **Lead Tracker "By Owner" was mixing employees with lead sources**:
  `Owner` is meant to be employee/department-level, but the raw data has
  `Business WA`, `Website`, and `Walk in`/`walk in` leaking into it alongside
  the 5 real names (Anjali, Rajesh, Dikhita, Sajal, Bhanu) — confirmed by
  inspecting distinct `Owner` values live. Excluded those 3 from
  `getLeadsByOwner` specifically; "Leads by Source" (a different chart, keyed
  off `Source`) is unaffected and correctly still shows those channel names.
- **Chart x-axis labels switched from a shallow diagonal to fully vertical**
  (`angle={-90}`, was `-20`) on every `SingleMetricBarChart` instance,
  per direct feedback that the diagonal reading was harder to scan than
  straight-up vertical text.

## D.17 Chart x-axis labels — vertical reverted to horizontal, except Lead Tracker's "By Format" charts

Direct follow-up to §D.15's "fully vertical everywhere" change: the user came
back with a screenshot showing the vertical treatment made most charts harder
to scan, and asked for horizontal labels everywhere **except** one specific
chart, "because there isn't enough space for the employee names." Fixed via a
`verticalLabels` boolean prop on `SingleMetricBarChart` (default `false`,
i.e. horizontal) — applied `true` only to Lead Tracker's three "By Format"
charts (Leads/Revenue/ADR By Format), the same concrete match used in §D.15
(flagged again: "By Owner," the chart that actually shows employee names, is
a table, not a bar chart — no chart currently plots employee names as x-axis
categories). Every other `SingleMetricBarChart` instance across the dashboard
is back to horizontal labels.

## D.16 Deliverables produced this part

- All corrections above, live in production.
- New "Revenue targets by property" feature (§D.12), fixed further in §D.15.
- Chart x-axis labels reverted to horizontal dashboard-wide, vertical kept
  only on Lead Tracker's three "By Format" charts (§D.17).
- `Skyla_Dashboard_KPI_Logic_Reference.md` — added §0 Revision History and
  §6.1 (property targets), and updated every affected tab section in place
  to reflect current formulas.
- `Skyla_Sales_Dashboard_PRD.md` — added a post-launch-corrections pointer
  near the top, plus inline `~~strikethrough~~ → correction` notes at every
  affected formula, without deleting the original spec (kept as historical
  context).
- `Skyla_Reference_Data.md` — added a deviation note above the verbatim
  `Mapping.gs` source re: `Website` category removal (the script itself is
  left unedited as the historical record of what the external script does).
- This updated `HANDOVER.md`.

## Open items, as of end of Part D (superseded by Part E below)

1. **Generic "OTA" source label commission rate** — still 0%, never supplied.
2. **Expats / Repeat Booking definitions** — still PRD-documented assumptions, never revisited with the business.
3. **BH4/LP booking-table pipeline gap** — a pipeline issue, not a dashboard one. Directly visible now in the new per-property targets table too (BH4 always shows 0/null achieved). **LP side resolved in Part E** — BH4 remains open.
4. **Additional Occupancy Bookings/Revenue** — still no supporting data column found.
5. **Property targets are FY 26-27 only** — if the business ever wants FY 27-28 (or beyond) per-property targets shown the same way, the reference file (`lib/reference/propertyTargets.ts`) will need a new entry sourced from an updated planning workbook — there's no pipeline that keeps this current automatically, by design.

---

# PART E — LP (Lotus Pond) Re-integration (this session)

## E.1 Session goal

The user supplied `Skyla_Sales_Dashboard_PRD_LP_Addendum.md`, a full addendum
spec re-activating LP (Lotus Pond) on the dashboard. LP had been treated as
permanently removed since Part A (no PMS feed, hotel code dropped from the
sync script) — every prior part of this doc, and the KPI Logic Reference,
documented it that way. The business has since backfilled and validated LP's
full historical trading data into two new BigQuery tables at monthly grain,
and asked for it wired back into the dashboard following a specific set of
participation rules (which tabs LP should and shouldn't appear in). Full
spec lives in the addendum file; this Part is the implementation log.

## E.2 Why a monthly-grain merge, not a UNION

LP will never produce a `sales_booking` row again — it's permanently
retired, and the two new tables (`sales_booking_lp_monthly`,
`sales_booking_lp_monthly_roomtype`) are monthly aggregates, not per-night
rows like every other property's data. A literal `UNION ALL` into
`sales_booking`-shaped queries would either require fabricating fake nightly
rows (misrepresenting LP's real per-night pattern) or would only work for
month-grain aggregations and silently break anything finer. Instead, one
shared query module (`lib/bigquery/queries/lpMonthly.ts`) exposes LP's
monthly totals in the shapes each consumer already needs, and each consumer
(`overview.ts`, `trends.ts`, `brandCategory.ts`) fetches its normal
`sales_booking` query and LP's helper **in parallel**, then adds them
together — by simple addition for single totals, by `Map`-keyed merge
(`fy|month` or `fy|category`) for multi-row series.

## E.3 The one foundational fix that made everything else easy

`getPropertyActiveWindows()` (`lib/bigquery/queries/propertyWindows.ts`) is
the function every Available Room Nights / Occupancy% / RevPAR calculation
on the dashboard is built on top of. It now also queries
`sales_booking_lp_monthly` for LP's own `MIN`/`LAST_DAY(MAX(MonthStartDate))`
and merges it into the same window map used for every other property. Because
every downstream consumer already calls this one function rather than
computing windows itself, LP's availability became correct dashboard-wide
from this single change — no per-tab changes needed on the availability side,
only on the sold-nights/revenue side.

## E.4 Where LP does and doesn't participate

Per the addendum, confirmed in code (Booking Details' scope was later
extended the same day — see §E.7 below, superseding the "does not
participate" line for that tab):
- **Participates** (merged in when LP is in the Property selection): Revenue
  Details (Room Revenue, Sold/Available Nights, Revenue by Source, ADR by
  Property, YoY), Trends (all monthly charts, Business Category ADR), Brand
  (Occupancy by Brand — rolls into Aptly with BH4 — and Revenue by Category
  by FY), and the aggregate B2B/B2C/OTA split wherever it's shown.
- **Does not participate**: ~~Booking Details (nightly-only logic doesn't fit
  LP's monthly grain — already 0/blank for free)~~ → partially resolved,
  §E.7. OTA Breakdown (no per-OTA-site column in LP's data), Targets vs
  Achieved (no target was ever set for a retired property, so no fabricated
  target line), and the §6.1 per-property Revenue Targets table (same
  reason) remain fully excluded.
- **Unaffected either way**: Leads, B2B Contracts, Reviews — these three
  already had real, independent LP rows in their own source tables before
  this backfill (confirmed via BigQuery: 359 lead_tracker rows, 548 b2b_bills
  rows, 498+8 rating_sheet/ota rows), untouched by this change.

Full per-tab detail: `Skyla_Dashboard_KPI_Logic_Reference.md` §11 (new).

## E.5 Verification

Ran a throwaway script (`scripts/_verify_lp_integration.ts`, deleted after
use — matches this project's established verification pattern) against live
BigQuery: confirmed `getAvailableRoomNightsByProperty(["LP"], FY24-25)` = 5,840
(16 rooms × 365 days, correct); confirmed the exact delta between
`getOverviewKpis` run with vs without LP in the Property list (₹1.53 Cr /
3,845 nights / 5,840 available nights for FY 25-26) matches LP's own row in
`getAdrByProperty` to the rupee — proving the merge is purely additive with
no double-counting; confirmed Trends, Business Category ADR, Brand occupancy
rollup, and category-by-FY all reflect LP's contribution once selected;
confirmed YoY still includes LP correctly for both compared years. One
pre-existing, unrelated fact surfaced during this check: **BH4 has zero rows
in `sales_booking` at all**, across every FY — this is the same known
pipeline gap from Part C/D, not something this session's changes touched or
caused.

## E.6 Deliverables produced this part

- `lib/reference/propertyReference.ts` — LP's `status` flipped from
  `"removed"` to `"active"`.
- `lib/bigquery/queries/propertyWindows.ts` — LP's active window now sourced
  from `sales_booking_lp_monthly`.
- `lib/reference/financialYear.ts` — `fiscalMonthNumber()` promoted to a
  shared export (was private inside `targets.ts`).
- `lib/bigquery/queries/lpMonthly.ts` — new shared LP query module.
- `lib/bigquery/queries/overview.ts`, `trends.ts`, `brandCategory.ts` — LP
  merged in additively wherever the addendum calls for it.
- `Skyla_Dashboard_KPI_Logic_Reference.md` — new §11, updated §0/§1.5/§2–§6/
  §8/§10 to reflect LP's re-activation.
- `Skyla_Sales_Dashboard_PRD.md` — `~~strikethrough~~ → correction` notes at
  every place the original spec called LP permanently removed, plus a pointer
  to the addendum near the top.
- This updated `HANDOVER.md`.
- `npx tsc --noEmit` and `npx eslint . --quiet` both clean after every file
  change in this Part.

## E.7 Second pass, same day — extended to Booking Details, reassessed OTA Breakdown and Targets

The user asked to push the integration "as far as the available data safely
allows" and specifically to wire in `sales_booking_lp_monthly_roomtype`
(§E.6 above left it unused) and to individually reassess the three tabs that
were excluded outright in the first pass, rather than accept that exclusion
as final.

**Schema check first**: pulled the full column list of both LP tables
straight from BigQuery (`INFORMATION_SCHEMA.COLUMNS`) rather than relying on
the addendum's prose description. Found `BookingsCount` and `GuestServed` on
the monthly table (both usable for Booking Details' headline stats), and
confirmed no OTA-name/channel column anywhere (OTA Breakdown stays
excluded — see below).

**A real data-quality issue found while comparing the two LP tables**:
`sales_booking_lp_monthly_roomtype`'s own `Nights` column does not reconcile
with the monthly table's already-validated `SoldRoomNights` — checked across
all 24 months, off by 19%–76% with no fixed ratio (ruled out a
guest-nights-vs-room-nights explanation). `TotalRevenue` and `BookingsCount`,
by contrast, reconcile exactly every month. Rather than surface the
suspect `Nights` figure, `getLpRoomTypeStats()` allocates the validated
monthly `SoldRoomNights` total across room types by each type's revenue
share — which is **exact, not an estimate**, for LP's actual data, since LP
has exactly one room type ("Studio Room") in every one of its 24 months.

**Extended**: `getBookingStats` (Total Bookings, Guests Served, ALOS, Revenue
per Guest), `getRoomNightsGap` (Unsold Room Nights), `getCategoryMix`
(B2B/B2C/OTA mix), `getRoomFormatStats`, and `getRoomFormatByFy` — all in
`guestDetail.ts` — now merge in LP when selected. `getCategoryMix` was dead
code at the time (exported but not called from any page) — **wired into the
Booking Details UI the same day** as a new "Night/Revenue Mix By Category"
section (Revenue/Nights/ADR by B2B/B2C/OTA), so this is no longer a gap; see
§E.9.

**A real, pre-existing bug found and fixed along the way**: `getRoomNightsGap`
computes Unsold = Available − Sold. Since Part E.3's window fix, `Available`
already included LP automatically, but `Sold` was still `sales_booking`-only
(always 0 for LP) — so selecting LP on Booking Details was silently counting
100% of its available nights as unsold. Fixed by adding LP's real sold
nights into the `Sold` side too. Verified: the FY 25-26 delta is now exactly
1,995 nights (LP's own 5,840 available − 3,845 sold), not 5,840.

**Reassessed and confirmed to stay excluded** (Booking Details' remaining
sub-KPIs, OTA Breakdown, Targets) — each checked individually against the
real column list or formula set, not assumed:
- Repeat Bookings, Cancellations %, Cancellation Lead Time, Expat stats — no
  guest-identity, cancellation, or `Country` column in either LP table.
- OTA Breakdown — no per-OTA-site column, only an aggregate.
- Targets (all KPIs + the §6.1 per-property table) — every formula in
  `targets.ts` is target-relative; LP was never given a target, and adding
  its real Achieved without one would distort the achievement %.

**Verified against live BigQuery**: LP's `BookingsCount` (741) and
`GuestServed` (8,410) for FY 25-26 exactly match the delta of
`getBookingStats` run with vs without LP; `getRoomFormatStats` shows LP's
full "Studio Room" contribution correctly folded into the dashboard-wide
total; the excluded KPIs (Repeat Bookings, Expat stats, Cancellations) were
re-run with LP selected and returned the same figures as the 5-property-only
baseline, confirming no accidental leakage.

## E.8 Deliverables produced this second pass

- `lib/bigquery/queries/lpMonthly.ts` — added `getLpRoomTypeStats()`,
  `getLpRoomTypeByFy()`, and a `guestsServed` field on `getLpOverviewTotals()`.
- `lib/bigquery/queries/guestDetail.ts` — `getBookingStats`, `getRoomNightsGap`
  (bug fix), `getCategoryMix`, `getRoomFormatStats`, `getRoomFormatByFy` now
  merge in LP; explicit exclusion comments added at `getRepeatBookingShare`,
  `getExpatStats`, `getCancellationStats`, `getCancellationLeadTime`.
- `lib/bigquery/queries/filters.ts` — corrected a stale doc comment that
  still described LP as excluded by default.
- `Skyla_Dashboard_KPI_Logic_Reference.md` — new revision-history entry, §3
  rewritten per-KPI, §6/§8 reassessment notes, §11 substantially expanded.
- `Skyla_Sales_Dashboard_PRD.md` — pointer note and §7 item 7 updated to
  reflect the extended scope.
- This updated `HANDOVER.md`.
- `npx tsc --noEmit` clean; live BigQuery verification per §E.7.

## Open items, current (supersedes the Part D list above)

1. **Generic "OTA" source label commission rate** — still 0%, never supplied.
2. **Expats / Repeat Booking definitions** — still PRD-documented assumptions, never revisited with the business.
3. **BH4 booking-table pipeline gap** — still open, a pipeline issue not a dashboard one. LP had the identical symptom but is now resolved via the backfill in this Part; BH4 still needs the eZee sync to actually add it.
4. **Additional Occupancy Bookings/Revenue** — still no supporting data column found.
5. **Property targets are FY 26-27 only** — unchanged from Part D; still no LP row in that table by design (§E.4/§E.7).
6. ~~`getCategoryMix` (Booking Details' B2B/B2C/OTA Night/Revenue Mix) is not wired to any page~~ → **done, §E.9**: now rendered on Booking Details as "Night/Revenue Mix By Category".
7. **LP's room-type data will always show exactly one room type ("Studio Room")** — the revenue-weighted nights-allocation logic in `getLpRoomTypeStats()` handles a hypothetical multi-room-type future gracefully, but since this is a one-time, non-recurring backfill (per the addendum), that scenario isn't expected to ever occur.

## E.9 Wired `getCategoryMix` into the Booking Details UI (same day)

`getCategoryMix()` (§E.7) was extended for LP but never actually rendered
anywhere — flagged as a gap in the prior report. Wired it into
`app/(dashboard)/booking/page.tsx` (added to the existing `Promise.all` using
the page's already-resolved `filter`, same as every other Booking Details
query — no new filter plumbing needed) and rendered in
`components/booking/BookingContent.tsx` as a new "Night/Revenue Mix By
Category" section: three `SingleMetricBarChart` cards (Revenue, Nights, ADR
by B2B/B2C/OTA), styled with the same `CATEGORY_COLOR`/`CATEGORY_ORDER`
tokens already used on the Brand tab, placed above the existing room-format
charts. Verified against live BigQuery: the Property/FY/Month filters already
in use on this page correctly scope it (checked FY 25-26 with vs without LP,
and a Month-narrowed April-only query) — LP's contribution flows through
automatically since the query itself was already LP-aware from §E.7, this
round only added the missing UI wiring. `tsc`/`eslint` clean. Browser-based
visual verification wasn't possible this round — the local dev server's
shared login only has a bcrypt hash on file (`SHARED_PASSWORD_HASH` in
`.env.local`), not a recoverable plaintext password, so the auth gate
couldn't be passed from this session; verified via BigQuery + code review
instead, consistent with this session's established fallback.

---

# PART F — Lead Tracker Grand Total & OTA GoMMT Grouping (this session)

## F.1 Lead Tracker "By Owner" Grand Total row

Requested directly, with a screenshot of the desired total-row layout.
`getLeadsByOwner()` (`lib/bigquery/queries/leads.ts`) now returns
`{rows, total}` instead of a bare array — `total` is computed from the true
underlying summed counts/revenue across every owner (not by averaging each
owner's own Closed %/ADR, which would misrepresent the combined figure —
same principle as the §D.15 property-targets total fix). Rendered via the
`Table` component's existing `footerRow` prop (already built for exactly this
purpose, previously used only for the Targets §6.1 property table).
`app/(dashboard)/leads/page.tsx` needed no changes — `byOwner` flows straight
into `LeadsContent`. Verified against live BigQuery: the total row's
`totalLeads`/`closedLeads`/`revenue` exactly equal the sum of the individual
owner rows.

## F.2 OTA Breakdown: EaseMyTrip/MakeMyTrip/go-mmt combined into "GoMMT"

Requested directly: these three OTA names should show as one combined
"GoMMT" row rather than three separate rows. Added
`otaBreakdownDisplayNameSqlExpr()` in `lib/reference/bookingSourceMap.ts`, a
thin wrapper around the existing `canonicalSourceNameSqlExpr()` (which only
folds case variants of the *same* name, e.g. "Go-MMT"/"go-mmt") that also
folds these three genuinely different names into one display bucket. Scoped
to the OTA Breakdown tab only (`otaBreakdown.ts`'s `GROUP BY`) — doesn't touch
the B2B/B2C/OTA category classification (all three were already OTA) or the
per-row commission-rate lookup, which still keys off each row's own raw
`Source` value before this grouping applies. Confirmed all three already
carried the same 20% commission rate (`lib/reference/otaCommission.ts`), so
the combined row's blended commission % is unchanged at exactly 20%.
Verified against live BigQuery: exactly one "GoMMT" row appears in the
breakdown, no stray EaseMyTrip/MakeMyTrip/go-mmt rows remain.

## F.3 Deliverables

- `lib/bigquery/queries/leads.ts` — `getLeadsByOwner()` return type changed
  to `OwnerLeadStatsResult`.
- `components/leads/LeadsContent.tsx` — renders the Grand Total footer row.
- `lib/reference/bookingSourceMap.ts` — new `otaBreakdownDisplayNameSqlExpr()`.
- `lib/bigquery/queries/otaBreakdown.ts` — uses the new grouping function.
- `Skyla_Dashboard_KPI_Logic_Reference.md` — new revision-history entry, §7
  and §8 updated.
- This updated `HANDOVER.md`.
- `npx tsc --noEmit` and `npx eslint . --quiet` both clean; verified against
  live BigQuery (§F.1, §F.2).
