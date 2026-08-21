import {
  getBookingStats,
  getRoomNightsGap,
  getCategoryMix,
  getRepeatBookingShare,
  getRoomFormatStats,
  getRoomFormatByFy,
  getExpatStats,
  getCancellationStats,
  getCancellationLeadTime,
  getB2bByCompany,
} from "../lib/bigquery/queries/guestDetail";

async function main() {
  const filter = { fys: ["FY 25-26"] };

  console.log("--- Booking Stats ---");
  console.log(await getBookingStats(filter));

  console.log("--- Room Nights Gap ---");
  console.log(await getRoomNightsGap(filter));

  console.log("--- Category Mix ---");
  console.log(await getCategoryMix(filter));

  console.log("--- Repeat Booking Share ---");
  console.log(await getRepeatBookingShare(filter));

  console.log("--- Room Format Stats ---");
  console.log(await getRoomFormatStats(filter));

  console.log("--- Room Format by FY (all-time) ---");
  console.log((await getRoomFormatByFy({})).slice(0, 10));

  console.log("--- Expat Stats ---");
  console.log(await getExpatStats(filter));

  console.log("--- Cancellation Stats ---");
  console.log(await getCancellationStats(filter));

  console.log("--- Cancellation Lead Time ---");
  console.log(await getCancellationLeadTime(filter));

  console.log("--- B2B by Company (top 10) ---");
  console.log((await getB2bByCompany(filter)).slice(0, 10));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
