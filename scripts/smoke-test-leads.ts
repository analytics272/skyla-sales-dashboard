import {
  getLeadsSummary,
  getLeadsMoM,
  getLeadsByProperty,
  getLeadsBySource,
  getFormatLeadsRevenue,
  getAdrByFormat,
  getLostLeadReasons,
  getBookingPace,
} from "../lib/bigquery/queries/leads";

async function main() {
  console.log("--- Leads Summary, all-time ---");
  console.log(await getLeadsSummary({}));

  console.log("--- Leads Summary, FY 25-26 ---");
  console.log(await getLeadsSummary({ fy: "FY 25-26" }));

  console.log("--- Leads MoM, FY 25-26 ---");
  console.log(await getLeadsMoM("FY 25-26"));

  console.log("--- Leads by Property (remapped) ---");
  console.log(await getLeadsByProperty({}));

  console.log("--- Leads by Source (top 10) ---");
  console.log((await getLeadsBySource({})).slice(0, 10));

  console.log("--- Format Leads & Revenue ---");
  console.log(await getFormatLeadsRevenue({}));

  console.log("--- ADR by Format ---");
  console.log(await getAdrByFormat({}));

  console.log("--- Lost Lead Reasons ---");
  console.log(await getLostLeadReasons({}));

  console.log("--- Booking Pace ---");
  console.log(await getBookingPace({}));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
