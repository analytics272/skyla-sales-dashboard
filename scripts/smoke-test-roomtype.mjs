import { execSync } from "node:child_process";
import { BigQuery } from "@google-cloud/bigquery";
import fs from "node:fs";

execSync(
  "npx tsc lib/reference/roomTypeMapping.ts --module esnext --target es2020 --moduleResolution bundler --outDir .smoke-build3 --skipLibCheck",
  { stdio: "inherit" }
);
const { roomTypeMappingSqlUnnest, roomTypeJoinCondition } = await import(
  "../.smoke-build3/roomTypeMapping.js"
);

const bq = new BigQuery({ projectId: "skyla-analytics" });
const T = (n) => `\`skyla-analytics.Skyla_Sales_Automation.${n}\``;

console.log("--- room type join coverage (post-fix) ---");
{
  const query = `
    SELECT rt.room_type, COUNT(*) AS n
    FROM ${T("sales_booking")} b
    LEFT JOIN ${roomTypeMappingSqlUnnest()} AS rt
      ON ${roomTypeJoinCondition("b")}
    GROUP BY rt.room_type
    ORDER BY n DESC
  `;
  const [rows] = await bq.query({ query });
  console.table(rows);
}

console.log("--- remaining unmatched (Property, Room) pairs ---");
{
  const query = `
    SELECT b.Property, b.Room, COUNT(*) AS n
    FROM ${T("sales_booking")} b
    LEFT JOIN ${roomTypeMappingSqlUnnest()} AS rt
      ON ${roomTypeJoinCondition("b")}
    WHERE rt.room_type IS NULL
    GROUP BY b.Property, b.Room
    ORDER BY n DESC
    LIMIT 20
  `;
  const [rows] = await bq.query({ query });
  console.table(rows);
}

console.log("--- fan-out check: does join multiply row count? ---");
{
  const query = `
    SELECT
      (SELECT COUNT(*) FROM ${T("sales_booking")}) AS base_count,
      (SELECT COUNT(*) FROM ${T("sales_booking")} b
        LEFT JOIN ${roomTypeMappingSqlUnnest()} AS rt ON ${roomTypeJoinCondition("b")}
      ) AS joined_count
  `;
  const [rows] = await bq.query({ query });
  console.table(rows);
}

console.log("--- GB specific breakdown post-fix ---");
{
  const query = `
    SELECT rt.room_type, COUNT(*) AS n
    FROM ${T("sales_booking")} b
    LEFT JOIN ${roomTypeMappingSqlUnnest()} AS rt
      ON ${roomTypeJoinCondition("b")}
    WHERE b.Property = 'GB'
    GROUP BY rt.room_type
    ORDER BY n DESC
  `;
  const [rows] = await bq.query({ query });
  console.table(rows);
}

fs.rmSync(".smoke-build3", { recursive: true, force: true });
