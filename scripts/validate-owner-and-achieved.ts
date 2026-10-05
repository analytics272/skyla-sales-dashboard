// Live validation: owner joins must not change revenue; Performance "achieved" must equal PMS.
//   node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/validate-owner-and-achieved.ts
import { runQuery, table } from "../lib/bigquery/client";
import { getB2bContractRanking } from "../lib/bigquery/queries/b2bContracts";
import { getOwnerCompanyAnalysis } from "../lib/bigquery/queries/ownerCompanyAnalysis";
import { getMonthlyAchieved, sumAchieved } from "../lib/bigquery/queries/achievedRevenue";
import { getCategoryAchievement, getMonthlyRevenueTargets, getRevenueAchievement } from "../lib/bigquery/queries/targets";
import { ACTIVE_PROPERTY_CODES } from "../lib/reference/propertyReference";

const inr = (n: number) => Math.round(n).toLocaleString("en-IN");
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`); if (!ok) failed++; };

async function main() {
  // 1. Owner reconciliation (FY 26-27, all active properties)
  const period = { period: "this_fy" as const };
  const analysis = await getOwnerCompanyAnalysis({ properties: ACTIVE_PROPERTY_CODES, ...period } as never);
  const analysisTotal = analysis.reduce((s, r) => s + r.revenue, 0);
  const viewTotal = (await runQuery<{ t: number }>(
    `SELECT SUM(TotalRevenue) t FROM ${table("company_revenue_summary")} WHERE Property IN UNNEST(@p) AND MonthStart BETWEEN '2026-04-01' AND '2027-03-31'`, { p: ACTIVE_PROPERTY_CODES }
  ))[0].t;
  // HAVING revenue > 0 per bucket can only drop negative/zero buckets, so allow tiny drift
  check("Company Analysis revenue (owner-joined) == company_revenue_summary", Math.abs(analysisTotal - viewTotal) / viewTotal < 0.001, `${inr(analysisTotal)} vs ${inr(viewTotal)}`);
  const byOwner = new Map<string, number>();
  for (const r of analysis) byOwner.set(r.owner, (byOwner.get(r.owner) ?? 0) + r.revenue);
  console.log("   revenue by owner:", Object.fromEntries([...byOwner].map(([o, v]) => [o, inr(v)])));

  const ranking = await getB2bContractRanking(ACTIVE_PROPERTY_CODES, { ...period } as never);
  const rankTotal = ranking.reduce((s, r) => s + r.roomRevenue, 0);
  console.log(`   Company Rankings: ${ranking.length} companies, revenue ${inr(rankTotal)}, with owner: ${ranking.filter((r) => r.owner).length}`);
  check("Company Rankings returns an owner field", ranking.every((r) => "owner" in r));

  // 2. PMS achieved vs. PMS-by-month (Excel snapshot: Jul 22,029,254 / Aug 17,623,010 / Sep 20,237,546)
  const months = await getMonthlyAchieved({ start: "2026-04-01", end: "2027-03-31" });
  const m = Object.fromEntries(months.map((x) => [x.monthKey, x]));
  for (const [k, excel] of [["2026-07", 22029254], ["2026-08", 17623010], ["2026-09", 20237546]] as const) {
    console.log(`   ${k}: dashboard PMS ${inr(m[k].revenue)}  | Excel ${inr(excel)}  | diff ${((m[k].revenue / excel - 1) * 100).toFixed(2)}%`);
  }
  const q2 = ["2026-07", "2026-08", "2026-09"].reduce((s, k) => s + m[k].revenue, 0);
  console.log(`   Jul-Sep PMS total ${inr(q2)} (Excel 59,889,810)`);
  check("category achieved sums to total (FY26-27, live months)", months.every((x) => Math.abs(x.b2b + x.b2c + x.ota - x.revenue) < 1), "");

  const octRange = { start: "2026-10-01", end: "2026-10-31" };
  const oct = sumAchieved(await getMonthlyAchieved(octRange)).revenue;
  const ra = await getRevenueAchievement({ period: "this_month" } as never);
  check("Revenue Achievement (This Month) == PMS October", Math.abs(ra.achieved - oct) < 1, `${inr(ra.achieved)} vs ${inr(oct)}; target ${inr(ra.target)}; pct ${(ra.achievedPct! * 100).toFixed(1)}%`);
  const cats = await getCategoryAchievement({ period: "this_month" } as never);
  console.log("   category achieved (Oct):", cats.map((c) => `${c.category} ${inr(c.achieved)}/${inr(c.target)}`).join(" | "));
  const mt = await getMonthlyRevenueTargets("FY 26-27");
  console.log("   monthly achieved:", mt.map((x) => `${x.month}:${inr(x.achievedRevenue)}`).join(" "));
  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
