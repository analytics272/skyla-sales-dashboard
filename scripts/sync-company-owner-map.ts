// Loads lib/reference/ownerCompanyMapping.ts into BigQuery `company_owner_map`.
// Dry run by default; pass --apply to write. Never overwrites an existing
// row that has a different owner (aborts instead) and never touches revenue tables.
//   node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/sync-company-owner-map.ts [--apply]
import { runQuery, table } from "../lib/bigquery/client";
import { OWNER_COMPANY_MAPPING } from "../lib/reference/ownerCompanyMapping";

async function main() {
  const apply = process.argv.includes("--apply");

  const owners: Record<string, string> = {}; // CompanyName -> Owner
  for (const [owner, entries] of Object.entries(OWNER_COMPANY_MAPPING)) {
    for (const e of entries) {
      for (const n of e.names) {
        if (owners[n] && owners[n] !== owner) throw new Error(`"${n}" assigned to both ${owners[n]} and ${owner}`);
        owners[n] = owner;
      }
    }
  }

  const found = await runQuery<{ CompanyId: string; CompanyName: string }>(
    `SELECT DISTINCT CompanyId, CompanyName FROM ${table("sales_company_bills")} WHERE CompanyName IN UNNEST(@names) AND CompanyId IS NOT NULL AND TRIM(CompanyId) != ''`,
    { names: Object.keys(owners) }
  );
  const foundNames = new Set(found.map((r) => r.CompanyName));
  const missing = Object.keys(owners).filter((n) => !foundNames.has(n));
  if (missing.length) throw new Error(`Names not found in sales_company_bills: ${missing.join(" | ")}`);

  const idOwner = new Map<string, string>();
  for (const r of found) {
    const o = owners[r.CompanyName];
    if (idOwner.has(r.CompanyId) && idOwner.get(r.CompanyId) !== o) throw new Error(`CompanyId ${r.CompanyId} maps to two owners`);
    idOwner.set(r.CompanyId, o);
  }

  const existing = await runQuery<{ CompanyId: string; Owner: string }>(`SELECT CompanyId, Owner FROM ${table("company_owner_map")}`);
  const conflicts = existing.filter((e) => idOwner.has(e.CompanyId) && idOwner.get(e.CompanyId) !== e.Owner);
  if (conflicts.length) throw new Error(`Existing different owners, aborting: ${JSON.stringify(conflicts)}`);

  const existingIds = new Set(existing.map((e) => e.CompanyId));
  const toInsert = [...idOwner].filter(([id]) => !existingIds.has(id));
  const perOwner: Record<string, number> = {};
  for (const [, o] of toInsert) perOwner[o] = (perOwner[o] ?? 0) + 1;
  console.log(`Existing rows: ${existing.length}. To insert: ${toInsert.length}`, perOwner);

  if (process.argv.includes("--emit-sql")) {
    const values = toInsert.map(([id, o]) => `('${id}', '${o}')`).join(",\n  ");
    const sql = `-- Generated ${new Date().toISOString().slice(0, 10)} from lib/reference/ownerCompanyMapping.ts (${toInsert.length} rows)\nINSERT INTO ${table("company_owner_map")} (CompanyId, Owner) VALUES\n  ${values};\n`;
    const { writeFileSync } = await import("node:fs");
    writeFileSync("scripts/company-owner-map-insert.sql", sql);
    return console.log(`Wrote scripts/company-owner-map-insert.sql (${toInsert.length} rows)`);
  }
  if (!apply) return console.log("Dry run only — re-run with --apply to write, or --emit-sql to produce SQL for an admin to run.");
  if (!toInsert.length) return console.log("Nothing to insert.");

  await runQuery(
    `INSERT INTO ${table("company_owner_map")} (CompanyId, Owner)
     SELECT ids[OFFSET(i)], owners[OFFSET(i)]
     FROM (SELECT @ids AS ids, @owners AS owners), UNNEST(GENERATE_ARRAY(0, ARRAY_LENGTH(ids) - 1)) AS i`,
    { ids: toInsert.map(([id]) => id), owners: toInsert.map(([, o]) => o) }
  );
  const after = await runQuery<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table("company_owner_map")}`);
  console.log("Inserted. company_owner_map rows now:", after[0].n);
}

main().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
