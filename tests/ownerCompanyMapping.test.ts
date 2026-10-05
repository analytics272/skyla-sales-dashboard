import { test } from "node:test";
import assert from "node:assert/strict";
import { OWNER_COMPANY_MAPPING, UNMATCHED_REQUESTS, PENDING_OWNER_NAMES, pendingOwnerSql } from "../lib/reference/ownerCompanyMapping";
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
  for (const p of PENDING_OWNER_NAMES) assert.ok(!mappedRequests.has(p.name.toLowerCase()), `${p.name} is both mapped and pending`);
  assert.ok(UNMATCHED_REQUESTS.some((u) => u.requested === "SLVC"));
});

test("pending (not-yet-booked) names resolve to the right owners", () => {
  const byName = new Map(PENDING_OWNER_NAMES.map((p) => [p.name, p.owner]));
  for (const n of ["Yashodha", "Oasis", "CCIL", "Stay3Sixty", "Blueground", "Nutmegs Hospitality"]) assert.equal(byName.get(n), "Dikhita");
  assert.equal(byName.get("ACT"), "Sajal");
  assert.equal(byName.get("Atrium"), "Sajal");
});

test("pendingOwnerSql builds a CASE with exact-only ACT and prefix-matching others", () => {
  const sql = pendingOwnerSql("c.CompanyName");
  assert.match(sql, /^CASE WHEN /);
  assert.match(sql, /= 'ACT' THEN 'Sajal'/);
  assert.ok(!/STARTS_WITH\([^)]*\), 'ACT '\)/.test(sql.replace(/\s+/g, " ")), "ACT must not be prefix-matched");
  assert.match(sql, /STARTS_WITH\(.*'YASHODHA '\)/);
});

test("Dhikitha / Dikhita spellings resolve to the same canonical owner", () => {
  assert.equal(canonicalOwner("Dhikitha"), canonicalOwner("Dikhita"));
  assert.equal(canonicalOwner(" Dikhita "), canonicalOwner("dikitha"));
});
