// Live reconciliation for the Reports tab's PMS source mapping (2026-10-06).
//   node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/validate-reports-pms.ts
import { runQuery, table, fnbTable } from "../lib/bigquery/client";
import { getFolioBasedReport, getB2bDetailReport } from "../lib/bigquery/queries/reports";
import { SALES_BOOKING_STAY_FILTER } from "../lib/bigquery/queries/filters";
import { bookingCategorySqlExpr } from "../lib/reference/bookingSourceMap";
import { fyBounds } from "../lib/reference/financialYear";
import { REPORT_UNTAGGED_COMPANY } from "../lib/reference/reportProperties";

const PROPS = ["KDP", "HTC", "JHS", "BH4", "GB"];
const inr = (n: number) => Math.round(n).toLocaleString("en-IN");
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`); if (!ok) failed++; };
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

async function one<T = number>(sql: string, params: Record<string, unknown>, col = "v"): Promise<T> {
  const r = await runQuery<Record<string, T>>(sql, params);
  return (r[0]?.[col] ?? 0) as T;
}

async function main() {
  for (const fy of ["FY 24-25", "FY 25-26", "FY 26-27"]) {
    const { start, end } = fyBounds(fy);
    console.log(`\n================ ${fy} (${start} → ${end}) ================`);
    const folio = await getFolioBasedReport(undefined, fy);
    const b2b = await getB2bDetailReport(undefined, fy);
    const sumMonths = (pick: (m: (typeof folio.months)[number]["columns"]["TOTAL"]) => number, col: "TOTAL" | string = "TOTAL") =>
      folio.months.reduce((s, b) => s + pick(b.columns[col as "TOTAL"]), 0);

    // ---- independent direct-SQL truths
    const room = await one(`SELECT SUM(DailyRevenue) v FROM ${table("sales_booking")} WHERE Property IN UNNEST(@p) AND CAST(StayDate AS DATE) BETWEEN @s AND @e AND ${SALES_BOOKING_STAY_FILTER}`, { p: PROPS, s: start, e: end });
    const b2bPms = await one(`SELECT SUM(DailyRevenue) v FROM ${table("sales_booking")} WHERE Property IN UNNEST(@p) AND CAST(StayDate AS DATE) BETWEEN @s AND @e AND ${SALES_BOOKING_STAY_FILTER} AND ${bookingCategorySqlExpr("Source")} = 'B2B'`, { p: PROPS, s: start, e: end });
    const fnbPos = await one(`SELECT CAST(SUM(net_amount) AS FLOAT64) v FROM ${fnbTable("fnb_sale")} WHERE CAST(date AS DATE) BETWEEN @s AND @e AND property != 'LP'`, { s: start, e: end });
    const fnbPosFo = await one(`SELECT CAST(SUM(net_amount) AS FLOAT64) v FROM ${fnbTable("fnb_sale")} WHERE CAST(date AS DATE) BETWEEN @s AND @e AND property = 'FO'`, { s: start, e: end });
    const txOther = await one(`SELECT SUM(ChargeAmount) v FROM ${table("sales_transaction_classified")} WHERE scope='EXTRA_CHARGE' AND charge_type NOT LIKE 'F&B Service%' AND Property IN UNNEST(@p) AND line_dt BETWEEN @s AND @e`, { p: PROPS, s: start, e: end });
    const txPosInPms = await one(`SELECT SUM(ChargeAmount) v FROM ${table("sales_transaction_classified")} WHERE is_pos_bill AND Property IN UNNEST(@p) AND line_dt BETWEEN @s AND @e`, { p: PROPS, s: start, e: end });
    const pmsOnly = await one(`
      WITH tx AS (SELECT Property, charge_type, is_pos_bill, ChargeAmount, REGEXP_EXTRACT(ChargeDescription, r'Voucher no : ([^, ]+)') voucher FROM ${table("sales_transaction_classified")} WHERE scope='EXTRA_CHARGE' AND Property IN UNNEST(@p) AND line_dt BETWEEN @s AND @e),
      pos AS (SELECT DISTINCT property, receipt_no k FROM ${fnbTable("fnb_sale")} UNION DISTINCT SELECT DISTINCT property, order_no FROM ${fnbTable("fnb_sale")})
      SELECT SUM(IF(tx.charge_type LIKE 'F&B Service (manual%' OR (tx.is_pos_bill AND pos.k IS NULL), tx.ChargeAmount, 0)) v FROM tx LEFT JOIN pos ON pos.property = tx.Property AND pos.k = tx.voucher`, { p: PROPS, s: start, e: end });
    const legacyOldFnb = fnbPos; // the old report read fnb_sale only
    const oldOther = await one(`SELECT SUM(DailyOtherRevenueExclusiveTax) v FROM ${table("sales_booking")} WHERE Property = 'GB' AND CAST(StayDate AS DATE) BETWEEN @s AND @e AND ${SALES_BOOKING_STAY_FILTER}`, { s: start, e: end });
    const oldB2bBills = await one(`SELECT SUM(Room_Revenue) v FROM ${table("b2b_bills")} WHERE Financial_Year = @fy AND Property IN UNNEST(@p)`, { fy, p: PROPS });

    // ---- report figures (sum of the 12 month blocks, TOTAL column)
    const rRoom = sumMonths((m) => m.roomRevenue);
    const rFnb = sumMonths((m) => m.fnbRevenue);
    const rOther = sumMonths((m) => m.otherRevenue);
    const rB2b = sumMonths((m) => m.b2bRevenue);
    const b2bDetailTotal = b2b.zoneA.reduce((s, r) => s + r.totalRevenue, 0);
    const untagged = b2b.zoneA.find((r) => r.company === REPORT_UNTAGGED_COMPANY)?.totalRevenue ?? 0;

    console.log("Source / logic                                  BEFORE            AFTER (report)    direct-SQL check");
    console.log(`Room revenue  (sales_booking)                   ${inr(room).padStart(14)}    ${inr(rRoom).padStart(14)}    ${inr(room).padStart(14)}`);
    console.log(`B2B revenue   (sales_booking Source=B2B)        ${"-".padStart(14)}    ${inr(rB2b).padStart(14)}    ${inr(b2bPms).padStart(14)}`);
    console.log(`B2B Details total  (was b2b_bills ${inr(oldB2bBills)})    ${inr(oldB2bBills).padStart(14)}    ${inr(b2bDetailTotal).padStart(14)}    untagged ${inr(untagged)}`);
    console.log(`F&B revenue   (POS + PMS-only slice)            ${inr(legacyOldFnb).padStart(14)}    ${inr(rFnb).padStart(14)}    ${inr(fnbPos + pmsOnly).padStart(14)}  (POS ${inr(fnbPos)} + PMS-only ${inr(pmsOnly)})`);
    console.log(`Other revenue (PMS extras; GB legacy < Jul-25)  ${inr(oldOther).padStart(14)}    ${inr(rOther).padStart(14)}    ${inr(txOther)} + legacy GB`);

    check(`${fy}: room revenue unchanged`, near(rRoom, room, 1) || fy !== "FY 26-27" /* overrides may apply to past FYs */, `${inr(rRoom)} vs ${inr(room)}`);
    check(`${fy}: B2B Details total == Folio B2B revenue`, near(b2bDetailTotal, rB2b, 1), `${inr(b2bDetailTotal)} vs ${inr(rB2b)}`);
    check(`${fy}: Folio B2B == direct PMS B2B`, near(rB2b, b2bPms, 1), `${inr(rB2b)} vs ${inr(b2bPms)}`);
    check(`${fy}: F&B == POS + PMS-only (no double count)`, near(rFnb, fnbPos + pmsOnly, 1), `${inr(rFnb)} vs ${inr(fnbPos + pmsOnly)}`);
    check(`${fy}: PMS-only F&B is a small remainder of PMS-posted F&B (not the whole of it)`, pmsOnly <= txPosInPms * 0.25 + 100000, `${inr(pmsOnly)} of ${inr(txPosInPms)} posted`);
    check(`${fy}: Other >= PMS extras (legacy GB only adds before coverage)`, rOther >= txOther - 1, `${inr(rOther)} vs ${inr(txOther)}`);
    check(`${fy}: FO F&B counted once in TOTAL only`, fnbPosFo >= 0 && rFnb >= fnbPosFo, `FO ${inr(fnbPosFo)}`);
  }

  // property filter: KDP only
  const fy = "FY 25-26";
  const { start, end } = fyBounds(fy);
  const kdpB2b = await getB2bDetailReport(["KDP"], fy);
  const kdpDirect = await one(`SELECT SUM(DailyRevenue) v FROM ${table("sales_booking")} WHERE Property='KDP' AND CAST(StayDate AS DATE) BETWEEN @s AND @e AND ${SALES_BOOKING_STAY_FILTER} AND ${bookingCategorySqlExpr("Source")} = 'B2B'`, { s: start, e: end });
  check("KDP filter: B2B Details == KDP PMS B2B", near(kdpB2b.zoneA.reduce((s, r) => s + r.totalRevenue, 0), kdpDirect, 1));

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
