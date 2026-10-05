import { test } from "node:test";
import assert from "node:assert/strict";
import { OWNER_COMPANY_MAPPING, PENDING_OWNER_NAMES, pendingOwnerSql } from "../lib/reference/ownerCompanyMapping";
import { canonicalOwner, ownersOf, formatOwners } from "../lib/reference/owners";

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

test("pending names never conflict with a mapped company's owner", () => {
  for (const p of PENDING_OWNER_NAMES) {
    const mappedTo = owners.find((o) => OWNER_COMPANY_MAPPING[o].some((e) => e.names.some((n) => n.toUpperCase().startsWith(p.name.toUpperCase()))));
    if (mappedTo) assert.ok(p.owners.includes(mappedTo), `${p.name}: pending owners ${p.owners} exclude mapped owner ${mappedTo}`);
  }
});

test("SLVC is shared by Sajal and Bhanu", () => {
  const slvc = PENDING_OWNER_NAMES.find((p) => p.name === "SLVC");
  assert.deepEqual([...slvc!.owners].sort(), ["Bhanu", "Sajal"]);
  assert.match(pendingOwnerSql("c.CompanyName").replace(/\s+/g, " "), /'SLVC '\)\) THEN 'Bhanu\|Sajal'/);
});

test("shared owner strings split and format correctly", () => {
  assert.deepEqual(ownersOf("Bhanu|Sajal"), ["bhanu", "sajal"]);
  assert.deepEqual(ownersOf("Dhikitha"), ["dikitha"]);
  assert.equal(formatOwners("Bhanu|Sajal"), "Bhanu, Sajal");
  assert.equal(formatOwners(null), "");
});

test("pending (not-yet-booked) names resolve to the right owners", () => {
  const byName = new Map(PENDING_OWNER_NAMES.map((p) => [p.name, p.owners.join("|")]));
  for (const n of ["Yashodha", "Oasis", "CCIL", "Stay3Sixty", "Blueground", "Nutmegs Hospitality"]) assert.equal(byName.get(n), "Dikhita");
  assert.equal(byName.get("ACT"), "Sajal");
  assert.equal(byName.get("Atria Convergence Technologies"), "Sajal");
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

test("ACT / Atria Convergence Technologies are Sajal's under every spelling", () => {
  const atria = OWNER_COMPANY_MAPPING.Sajal.find((e) => e.requested.startsWith("ACT"));
  assert.ok(atria && atria.names.length >= 3 && atria.names.every((n) => n.startsWith("ATRIA CONVERGENCE TECHNOLOGIES")));
  const sql = pendingOwnerSql("c.CompanyName").replace(/\s+/g, " ");
  assert.match(sql, /= 'ACT' THEN 'Sajal'/);
  assert.match(sql, /'ATRIA CONVERGENCE TECHNOLOGIES '\)\) THEN 'Sajal'/);
});
