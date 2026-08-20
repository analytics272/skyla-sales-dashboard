// Smoke test: compile the TS reference modules on the fly (via tsx-less approach:
// use the TypeScript compiler API is overkill here — instead we just re-require
// through Next's tsconfig paths isn't available in plain node, so we inline a
// minimal esbuild-free transpile using node's --experimental-strip-types is not
// guaranteed on this Node version, so we shell out to `tsc` to emit JS to a temp
// dir, then run it).
import { execSync } from "node:child_process";
import { BigQuery } from "@google-cloud/bigquery";
import fs from "node:fs";

execSync(
  "npx tsc lib/reference/bookingSourceMap.ts lib/reference/otaCommission.ts lib/reference/roomTypeMapping.ts lib/reference/financialYear.ts --module esnext --target es2020 --moduleResolution bundler --outDir .smoke-build --skipLibCheck",
  { stdio: "inherit" }
);

const { bookingCategorySqlExpr, bookingIsUnmappedSqlExpr } = await import(
  "../.smoke-build/bookingSourceMap.js"
);
const { roomTypeMappingSqlUnnest } = await import("../.smoke-build/roomTypeMapping.js");
const { commissionRateSqlExpr } = await import("../.smoke-build/otaCommission.js");
const { fyLabelSqlExpr, fiscalQuarterSqlExpr } = await import(
  "../.smoke-build/financialYear.js"
);

const bq = new BigQuery({ projectId: "skyla-analytics" });
const T = (name) => `\`skyla-analytics.Skyla_Sales_Automation.${name}\``;

console.log("--- booking source category distribution (sales_booking) ---");
{
  const query = `
    SELECT ${bookingCategorySqlExpr("Source")} AS category, ${bookingIsUnmappedSqlExpr("Source")} AS is_unmapped, COUNT(*) AS n
    FROM ${T("sales_booking")}
    GROUP BY category, is_unmapped
    ORDER BY n DESC
  `;
  const [rows] = await bq.query({ query });
  console.table(rows);
}

console.log("--- room type join coverage (sales_booking) ---");
{
  const query = `
    SELECT rt.room_type, COUNT(*) AS n
    FROM ${T("sales_booking")} b
    LEFT JOIN ${roomTypeMappingSqlUnnest()} AS rt
      ON b.Property = rt.property AND b.Room = rt.room
    GROUP BY rt.room_type
    ORDER BY n DESC
  `;
  const [rows] = await bq.query({ query });
  console.table(rows);
}

console.log("--- unmatched (Property, Room) pairs (should be small/zero) ---");
{
  const query = `
    SELECT b.Property, b.Room, COUNT(*) AS n
    FROM ${T("sales_booking")} b
    LEFT JOIN ${roomTypeMappingSqlUnnest()} AS rt
      ON b.Property = rt.property AND b.Room = rt.room
    WHERE rt.room_type IS NULL
    GROUP BY b.Property, b.Room
    ORDER BY n DESC
    LIMIT 20
  `;
  const [rows] = await bq.query({ query });
  console.table(rows);
}

console.log("--- commission rate distribution (OTA category only) ---");
{
  const query = `
    SELECT TRIM(Source) AS source, Property, ${commissionRateSqlExpr("TRIM(Source)", "Property")} AS rate, COUNT(*) AS n
    FROM ${T("sales_booking")}
    WHERE ${bookingCategorySqlExpr("Source")} = 'OTA'
    GROUP BY source, Property, rate
    ORDER BY n DESC
    LIMIT 30
  `;
  const [rows] = await bq.query({ query });
  console.table(rows);
}

console.log("--- FY label + fiscal quarter sanity ---");
{
  const query = `
    SELECT ${fyLabelSqlExpr("CAST(StayDate AS DATE)")} AS fy, ${fiscalQuarterSqlExpr("CAST(StayDate AS DATE)")} AS q, COUNT(*) AS n
    FROM ${T("sales_booking")}
    GROUP BY fy, q
    ORDER BY fy, q
  `;
  const [rows] = await bq.query({ query });
  console.table(rows);
}

fs.rmSync(".smoke-build", { recursive: true, force: true });
