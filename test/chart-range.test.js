import test from "node:test";
import assert from "node:assert/strict";
import { yearRangeLabel, yearsInRange } from "../public/chart-range.js";

test("builds an inclusive ascending range", () => {
  assert.deepEqual(yearsInRange("1998", "2000", 2026), [1998, 1999, 2000]);
});

test("keeps a single selected year as a one-item range", () => {
  assert.deepEqual(yearsInRange("2025", "2025", 2026), [2025]);
  assert.equal(yearRangeLabel([2025]), "2025");
});

test("labels a multi-year selection with both endpoints", () => {
  assert.equal(yearRangeLabel([1998, 1999, 2000]), "1998–2000");
});

test("rejects reversed and out-of-bounds ranges", () => {
  assert.throws(() => yearsInRange("2000", "1999", 2026), /starting year/);
  assert.throws(() => yearsInRange("1957", "2000", 2026), /1958 through 2026/);
  assert.throws(() => yearsInRange("2000", "2027", 2026), /1958 through 2026/);
});

test("requires two whole-number years", () => {
  assert.throws(() => yearsInRange("", "2000", 2026), /Choose both/);
  assert.throws(() => yearsInRange("1999.5", "2000", 2026), /Choose both/);
});
