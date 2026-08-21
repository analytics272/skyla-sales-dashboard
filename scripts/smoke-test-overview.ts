import { getOverviewKpis } from "../lib/bigquery/queries/overview";
import { ACTIVE_PROPERTY_CODES } from "../lib/reference/propertyReference";
import { formatIndianCurrency, formatPercent } from "../lib/format/currency";

async function main() {
  console.log("=== All active properties, FY 25-26 ===");
  const r1 = await getOverviewKpis({ fys: ["FY 25-26"] });
  console.log({
    roomRevenue: formatIndianCurrency(r1.roomRevenue),
    extrasRevenue: formatIndianCurrency(r1.extrasRevenue),
    soldRoomNights: r1.soldRoomNights,
    availableRoomNights: r1.availableRoomNights,
    adr: r1.adr?.toFixed(0),
    occupancyPct: r1.occupancyPct !== null ? formatPercent(r1.occupancyPct) : null,
    revPar: r1.revPar?.toFixed(0),
    bySource: r1.bySource,
    yoy: { ...r1.yoy, currentRevenue: formatIndianCurrency(r1.yoy.currentRevenue), priorRevenue: formatIndianCurrency(r1.yoy.priorRevenue), pctChange: r1.yoy.pctChange !== null ? formatPercent(r1.yoy.pctChange) : null },
  });

  console.log("\n=== Single property KDP, FY 25-26, Q2 ===");
  const r2 = await getOverviewKpis({ fys: ["FY 25-26"], quarter: 2, properties: ["KDP"] });
  console.log({
    roomRevenue: formatIndianCurrency(r2.roomRevenue),
    soldRoomNights: r2.soldRoomNights,
    availableRoomNights: r2.availableRoomNights,
    occupancyPct: r2.occupancyPct !== null ? formatPercent(r2.occupancyPct) : null,
  });

  console.log("\n=== BH4 only (known pipeline gap — expect zeros), FY 25-26 ===");
  const r3 = await getOverviewKpis({ fys: ["FY 25-26"], properties: ["BH4"] });
  console.log({
    roomRevenue: r3.roomRevenue,
    soldRoomNights: r3.soldRoomNights,
    availableRoomNights: r3.availableRoomNights,
    occupancyPct: r3.occupancyPct,
  });

  console.log("\n=== Single month: FY 25-26, August (calendar month 8) ===");
  const r4 = await getOverviewKpis({ fys: ["FY 25-26"], months: [8] });
  console.log({
    roomRevenue: formatIndianCurrency(r4.roomRevenue),
    soldRoomNights: r4.soldRoomNights,
    availableRoomNights: r4.availableRoomNights,
    occupancyPct: r4.occupancyPct !== null ? formatPercent(r4.occupancyPct) : null,
  });

  console.log("\nACTIVE_PROPERTY_CODES:", ACTIVE_PROPERTY_CODES);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
