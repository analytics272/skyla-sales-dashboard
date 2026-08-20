import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery({ projectId: "skyla-analytics" });
const T = (n) => `\`skyla-analytics.Skyla_Sales_Automation.${n}\``;

const [rows] = await bq.query({
  query: `
    SELECT RoomNo, COUNT(*) AS n
    FROM ${T("sales_booking")}
    WHERE Property = 'GB' AND Room = 'Hyber Room'
    GROUP BY RoomNo
    ORDER BY n DESC
    LIMIT 20
  `,
});
console.log("--- GB bare 'Hyber Room' rows: RoomNo distribution ---");
for (const r of rows) console.log(r);

const [nullCheck] = await bq.query({
  query: `
    SELECT COUNTIF(RoomNo IS NULL OR TRIM(RoomNo) = '') AS blank_roomno, COUNT(*) AS total
    FROM ${T("sales_booking")}
    WHERE Property = 'GB' AND Room = 'Hyber Room'
  `,
});
console.log("--- blank RoomNo count ---", nullCheck[0]);
