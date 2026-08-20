import {
  getB2bContractRanking,
  getB2bTopAdrContracts,
  getCorporateAccountRetention,
} from "../lib/bigquery/queries/b2bContracts";

async function main() {
  console.log("--- B2B Contract Ranking, FY 25-26 (top 5) ---");
  console.log((await getB2bContractRanking("FY 25-26")).slice(0, 5));

  console.log("--- B2B Top ADR Contracts, FY 25-26 (top 5) ---");
  console.log((await getB2bTopAdrContracts("FY 25-26")).slice(0, 5));

  console.log("--- Corporate Account Retention ---");
  console.log(await getCorporateAccountRetention());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
