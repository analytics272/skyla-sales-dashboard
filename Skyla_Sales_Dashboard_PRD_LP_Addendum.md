# PRD Addendum — LP (Lotus Pond) Integration

**Supplements:** `Skyla_Sales_Dashboard_PRD.md`
**Status:** Backfill complete and validated in BigQuery. This addendum is ready for Claude Code to implement against.
**Scope:** How LP's historical KPI data joins the dashboard alongside the 5 PMS/API properties (KDP, HTC, JHS, BH4, GB).

---

## 1. Why LP is handled differently

LP (Lotus Pond) is permanently retired and has no active PMS API key, so it cannot flow through the existing `sales_booking` / `sales_booking_cancelled` pipeline (Google Apps Script → eZee API → BigQuery, per-occupied-night grain). Its historical data instead comes from two tabs in the **"Skyla Revenue Sheets Master"** Google Sheet:

- **`Transposed Data`** — a maintained monthly Property × MetricType rollup. Used as the **primary source** for Revenue, Available/Sold Room Nights, Guest counts, and B2B/B2C/OTA splits.
- **`Detailed Revenue Report`** — reservation-level rows. Used only to supply what `Transposed Data` lacks: Bookings count, CP/MAP/Day Use/Late Charges totals, and Room Type detail.

**Explicit design constraint:** no night-level revenue is fabricated for LP anywhere in this pipeline. Because the source sheets don't provide a reliable per-stay-night revenue breakdown (unlike the PMS API's `BaseRateExclusiveTax`/`BaseRateInclusiveTax`), LP data is kept at **monthly grain** rather than split evenly across nights. This is a deliberate accuracy trade-off, not a gap to "fix" later — even-splitting would produce numbers that look precise but aren't.

This works cleanly with the dashboard because **the dashboard's finest filter grain is already Month** (per the main PRD — Property / FY / Quarter / Month, no daily drill-down). LP fits the existing filter model without any UI changes.

---

## 2. New BigQuery tables

Both live in `skyla-analytics.Skyla_Sales_Automation`, created and populated by a one-time (re-runnable) Apps Script backfill. Neither table is touched by the existing PMS pipeline (`Code.gs`, `RefreshRecent.gs`) — LP data does not get refreshed automatically since the property is retired and the sheets are historical.

### `sales_booking_lp_monthly` — one row per month

| Column | Type | Notes |
|---|---|---|
| Property | STRING | Always `"LP"` |
| FinancialYear | STRING | e.g. `"FY 24-25"` |
| Month | STRING | e.g. `"Apr 24"` |
| MonthNumber | INTEGER | FY-relative, Apr=1 … Mar=12 |
| MonthStartDate | DATE | 1st of month — use this for date math/sorting |
| KeysAvailable | INTEGER | 16 (LP's room count) |
| AvailableRoomNights | FLOAT | From `Transposed Data` |
| SoldRoomNights | FLOAT | From `Transposed Data` |
| OccupancyPct | FLOAT | `SoldRoomNights / AvailableRoomNights` |
| RoomRevenue | FLOAT | From `Transposed Data`; independently validated against `Detailed Revenue Report`'s room-type totals — matches exactly for all 24 months backfilled |
| FnBRevenue | FLOAT | From `Transposed Data` |
| TotalRevenue | FLOAT | `RoomRevenue + FnBRevenue` |
| ADR | FLOAT | `RoomRevenue / SoldRoomNights` |
| GuestServed | INTEGER | From `Transposed Data` |
| NoOfGuest | INTEGER | From `Transposed Data` |
| B2BRevenue / B2BNights | FLOAT | From `Transposed Data` |
| B2CRevenue / B2CNights | FLOAT | From `Transposed Data` |
| OTARevenue / OTANights | FLOAT | From `Transposed Data` — aggregate OTA only, **no per-OTA-site breakdown** (see §4) |
| BookingsCount | INTEGER | Distinct Folio-number count from `Detailed Revenue Report` |
| CPRevenue / MAPRevenue / DayUseRevenue / LateChargesRevenue | FLOAT | Summed from `Detailed Revenue Report` |

**Validated coverage:** 24 months, Apr 2024 → Mar 2026.

### `sales_booking_lp_monthly_roomtype` — one row per month per Room Type

| Column | Type | Notes |
|---|---|---|
| Property | STRING | Always `"LP"` |
| FinancialYear | STRING | |
| Month | STRING | |
| MonthNumber | INTEGER | |
| MonthStartDate | DATE | |
| RoomType | STRING | Confirmed: **every LP booking is `"Studio Room"`** — LP was a single-room-type property. This is real, not a data gap. |
| BookingsCount | INTEGER | |
| Nights | FLOAT | |
| RoomValue | FLOAT | |
| TotalRevenue | FLOAT | |
| AvgRoomRate | FLOAT | Weighted: `SUM(RoomValue) / SUM(Nights)` |

Entirely sourced from `Detailed Revenue Report`; has no equivalent in `Transposed Data`.

---

## 3. Validation performed (for context, not re-work)

Before this data was loaded, `RoomRevenue` (from `Transposed Data`) was cross-checked against the independently-computed `TotalRevenue` from the room-type aggregation (built entirely from `Detailed Revenue Report`) for all 24 months. **Every month matched exactly**, down to the cent — two structurally different sheets, aggregated two different ways, agreeing perfectly. Occupancy and ADR both stay within sane, expected ranges throughout. This is documented here so Claude Code (and future maintainers) don't need to re-derive or re-justify the LP numbers — they're already validated.

---

## 4. How LP joins the dashboard — the canonical query pattern

Use this pattern for **every monthly KPI query that should include LP alongside the 5 PMS properties.** It's already been run and validated against live BigQuery data (148 rows returned across 6 properties × 24+ months, LP numbers matching the validated backfill exactly).

```sql
WITH pms_monthly AS (
  SELECT
    Property,
    FORMAT_DATE('%b %y', DATE_TRUNC(PARSE_DATE('%Y-%m-%d', StayDate), MONTH)) AS Month,
    DATE_TRUNC(PARSE_DATE('%Y-%m-%d', StayDate), MONTH) AS MonthStartDate,
    SUM(DailyRevenue) AS RoomRevenue,
    SUM(DailyOtherRevenueExclusiveTax) AS FnBRevenue,
    COUNT(*) AS SoldRoomNights,
    COUNT(DISTINCT ReservationNo) AS BookingsCount
  FROM `skyla-analytics.Skyla_Sales_Automation.sales_booking`
  GROUP BY Property, Month, MonthStartDate
),

lp_monthly AS (
  SELECT
    Property, Month, MonthStartDate,
    RoomRevenue, FnBRevenue, SoldRoomNights, BookingsCount
  FROM `skyla-analytics.Skyla_Sales_Automation.sales_booking_lp_monthly`
),

combined AS (
  SELECT * FROM pms_monthly
  UNION ALL
  SELECT * FROM lp_monthly
),

with_capacity AS (
  SELECT
    c.*,
    CASE c.Property
      WHEN 'KDP' THEN 63 WHEN 'HTC' THEN 34 WHEN 'JHS' THEN 33
      WHEN 'BH4' THEN 18 WHEN 'GB' THEN 21 WHEN 'LP' THEN 16
    END * EXTRACT(DAY FROM LAST_DAY(c.MonthStartDate)) AS AvailableRoomNights
  FROM combined c
)

SELECT
  *,
  SAFE_DIVIDE(SoldRoomNights, AvailableRoomNights) AS OccupancyPct,
  SAFE_DIVIDE(RoomRevenue, SoldRoomNights) AS ADR
FROM with_capacity
ORDER BY MonthStartDate, Property;
```

**Implementation notes for Claude Code:**
- Always use `SAFE_DIVIDE`, never bare `/`. Some LP months may have `NULL`/0 in a numerator or denominator; this should render as blank/"N/A" in the UI, not a query error or a fabricated 0%.
- The `CASE` room-count mapping (KDP/HTC/JHS/BH4/GB/LP) is the single source of truth for property capacity — reuse it everywhere `AvailableRoomNights` or occupancy is computed, rather than hardcoding room counts in multiple places.
- **Brand & Business Category KPIs:** apply the Brand mapping (KDP/HTC/JHS→Skyla, BH4/LP→Aptly, GB→Hyber) on top of the `combined` CTE. LP's numbers roll into Aptly's totals alongside BH4 automatically — no separate LP handling needed for brand-level KPIs.

---

## 5. Where LP can participate vs. where it can't

Per product decision: **do not create separate LP-only dashboard cards** unless a metric specifically requires room-type detail. LP should appear inline alongside the other 5 properties wherever the underlying data supports it, and simply be silently absent (not shown as broken, zeroed, or "N/A") where it doesn't.

**LP participates normally in:**
- Revenue & Occupancy Overview (all core KPIs: Revenue, Occupancy%, ADR, Sold Nights, Bookings)
- Trends by FY / Month
- Brand & Business Category (rolls into Aptly)
- B2B vs B2C vs OTA revenue/nights split (aggregate level only — see below)
- Any KPI built on top of the `combined` CTE above

**LP does NOT participate in, and should be silently excluded from:**
- **Per-OTA-site breakdown** (Agoda vs. Booking.com vs. MakeMyTrip, etc.) — `Transposed Data` only gives LP the three-way B2B/B2C/OTA split, not individual OTA names. LP contributes to the aggregate OTA KPI section but must not appear in any KPI that lists individual OTA sources by name.
- **Leads** (`lead_tracker`) — separate source table, untouched by this work. LP only shows up here if it already has rows independent of this backfill.
- **B2B Contracts** (`b2b_bills`) — same as above, separate source, out of scope.
- **Reviews & Ratings** (`rating_sheet` / `ota`) — same as above.
- **Targets vs. Achieved** (`leadership_targets`) — only relevant if that table has LP-specific target rows, which is unlikely for a retired property. LP would show actuals with no target line, which is the correct, honest behavior — do not fabricate a target.

**LP gets its own view only for:**
- **Room-type detail.** LP is a single-room-type property (100% Studio Room, confirmed real, not a data artifact), so it doesn't fit the same query shape as the PMS properties' per-night room-type mix. Query `sales_booking_lp_monthly_roomtype` separately for any KPI drilling into room-type composition, rather than forcing it into a `UNION` that wouldn't reconcile cleanly against the PMS properties' nightly grain.

---

## 6. Known caveats to carry into the dashboard (not blockers)

- LP data is **monthly-only** — there is no day-level drill-down for LP, unlike the PMS properties. If a KPI or filter ever needs daily grain, LP simply won't have data at that resolution; this is expected, not a bug.
- Tax is not tracked for LP (matches the product decision that dashboard KPIs don't use tax figures at all).
- `GuestServed`/`NoOfGuest` for LP come pre-aggregated from `Transposed Data`, not independently re-derived — trust the sheet's own numbers here rather than trying to reconcile them against `Detailed Revenue Report` guest counts, which track something slightly different (per-booking Pax, not monthly guest totals).
- This backfill is a **one-time load**, not a recurring sync. If new LP-adjacent data ever surfaces (it shouldn't, since the property is retired), it would need a manual re-run of the backfill script, not an automatic refresh.
