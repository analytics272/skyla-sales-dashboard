import { test } from "node:test";
import assert from "node:assert/strict";
import { OWNER_COMPANY_MAPPING, UNMATCHED_REQUESTS } from "../lib/reference/ownerCompanyMapping";
import { canonicalOwner } from "../lib/reference/owners";

const owners = Object.keys(OWNER_COMPANY_MAPPING);

test("only the five known sales owners are used", () => {
  assert.deepEqual([...owners].sort(), ["Anjali", "Bhanu", "Dikhita", "Rajesh", "Sajal"]);
});

test("no CompanyName is assigned to two owners", () => {
  const seen = new Map<string, string>();
  for (const [owner, entries] of Object.entries(OWNER_COMPANY_MAPPING)) {
    for (const n of entries.flatMap((e) => e.names)) {
      assert.ok(!seen.has(n) || seen.get(n) === owner, `${n} assigned to ${seen.get(n)} and ${owner}`);
      seen.set(n, owner);
    }
  }
});

test("every requested entry maps to at least one name, none are duplicated per owner", () => {
  for (const [owner, entries] of Object.entries(OWNER_COMPANY_MAPPING)) {
    const reqs = entries.map((e) => e.requested.toLowerCase());
    assert.equal(new Set(reqs).size, reqs.length, `${owner} has a duplicate request`);
    for (const e of entries) assert.ok(e.names.length > 0, `${owner}/${e.requested} has no names`);
  }
});

test("Aadya Travels is Dhikitha's, exactly once", () => {
  const holders = owners.filter((o) => OWNER_COMPANY_MAPPING[o].some((e) => e.names.includes("AADYA TRAVELS")));
  assert.deepEqual(holders, ["Dikhita"]);
});

test("unmatched requests are not also mapped, and SLVC is flagged", () => {
  const mappedRequests = new Set(Object.values(OWNER_COMPANY_MAPPING).flatMap((es) => es.map((e) => e.requested.toLowerCase())));
  for (const u of UNMATCHED_REQUESTS) assert.ok(!mappedRequests.has(u.requested.toLowerCase()), `${u.requested} is both mapped and unmatched`);
  assert.ok(UNMATCHED_REQUESTS.some((u) => u.requested === "SLVC"));
});

test("Dhikitha / Dikhita spellings resolve to the same canonical owner", () => {
  assert.equal(canonicalOwner("Dhikitha"), canonicalOwner("Dikhita"));
  assert.equal(canonicalOwner(" Dikhita "), canonicalOwner("dikitha"));
});
