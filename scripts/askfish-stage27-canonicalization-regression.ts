/*
 * STAGE 2 STEP 2.7.1: Standalone regression checks for the production versioning
 * behavior observed by the portal-contract verifier. Run with:
 *   ts-node --transpile-only --compiler-options '{"module":"CommonJS"}' \
 *     scripts/askfish-stage27-canonicalization-regression.ts
 */

import assert from "node:assert/strict";

import { canonicalizeNewestByKey } from "../apps/isomorphic-i18n/src/askfish/canonicalization";

// STAGE 2 STEP 2.7.1: A tiny ObjectId-like stub exercises the exact fallback used
// by production canonicalization without importing MongoDB or exposing any real IDs.
class FakeObjectId {
  constructor(private readonly timestamp: Date) {}

  getTimestamp() {
    return this.timestamp;
  }
}

// STAGE 2 STEP 2.7.1: Mozambique verification observed up to four physical versions
// for one semantic grain. Confirm four versions collapse to the newest single value
// and are never summed (40 is retained; 100 must never be produced).
const fourVersions = [
  { grain: "same", value: 10, timestamp: new Date("2026-08-01T00:00:00Z") },
  { grain: "same", value: 20, timestamp: new Date("2026-08-02T00:00:00Z") },
  { grain: "same", value: 30, timestamp: new Date("2026-08-03T00:00:00Z") },
  { grain: "same", value: 40, timestamp: new Date("2026-08-04T00:00:00Z") },
];
const canonicalFour = canonicalizeNewestByKey(fourVersions, (record) => record.grain);
assert.equal(canonicalFour.length, 1);
assert.equal(canonicalFour[0]?.value, 40);
assert.notEqual(canonicalFour[0]?.value, 100);

// STAGE 2 STEP 2.7.1: Kenya verification observed up to two physical versions.
// Confirm the ObjectId timestamp fallback selects the newest row when the explicit
// timestamp field is absent.
const twoVersions = [
  { grain: "same", value: 5, _id: new FakeObjectId(new Date("2026-08-01T00:00:00Z")) },
  { grain: "same", value: 9, _id: new FakeObjectId(new Date("2026-08-02T00:00:00Z")) },
];
const canonicalTwo = canonicalizeNewestByKey(twoVersions, (record) => record.grain);
assert.equal(canonicalTwo.length, 1);
assert.equal(canonicalTwo[0]?.value, 9);

// STAGE 2 STEP 2.7.1: Distinct semantic grains must remain distinct while each grain
// independently selects its newest version.
const mixedGrains = [
  { grain: "A", value: 1, timestamp: new Date("2026-08-01T00:00:00Z") },
  { grain: "A", value: 2, timestamp: new Date("2026-08-02T00:00:00Z") },
  { grain: "B", value: 3, timestamp: new Date("2026-08-01T00:00:00Z") },
];
const canonicalMixed = canonicalizeNewestByKey(mixedGrains, (record) => record.grain);
assert.equal(canonicalMixed.length, 2);
assert.deepEqual(
  canonicalMixed.map((record) => [record.grain, record.value]).sort(),
  [["A", 2], ["B", 3]],
);

// STAGE 2 STEP 2.7.1: Emit one concise success line for manual/CI acceptance logs.
console.log("Stage 2.7.1 canonicalization regression: PASS");
