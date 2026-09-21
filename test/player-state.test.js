import test from "node:test";
import assert from "node:assert/strict";
import { nextPreparationIndex, nextQueueIndex, shuffledCopy } from "../public/player-state.js";

test("moves forward and backward within the queue", () => {
  assert.equal(nextQueueIndex({ length: 4, currentIndex: 1 }), 2);
  assert.equal(nextQueueIndex({ length: 4, currentIndex: 1, direction: -1 }), 0);
});

test("stops at either end when repeat is off", () => {
  assert.equal(nextQueueIndex({ length: 4, currentIndex: 3 }), -1);
  assert.equal(nextQueueIndex({ length: 4, currentIndex: 0, direction: -1 }), -1);
});

test("wraps at either end when repeat all is on", () => {
  assert.equal(nextQueueIndex({ length: 4, currentIndex: 3, repeat: "all" }), 0);
  assert.equal(nextQueueIndex({ length: 4, currentIndex: 0, direction: -1, repeat: "all" }), 3);
});

test("repeat one keeps the current song on automatic forward movement", () => {
  assert.equal(nextQueueIndex({ length: 4, currentIndex: 2, repeat: "one" }), 2);
  assert.equal(nextQueueIndex({ length: 4, currentIndex: 2, direction: -1, repeat: "one" }), 1);
});

test("prepares the manual next song during repeat one and wraps during repeat all", () => {
  assert.equal(nextPreparationIndex({ length: 4, currentIndex: 1, repeat: "one" }), 2);
  assert.equal(nextPreparationIndex({ length: 4, currentIndex: 3, repeat: "all" }), 0);
  assert.equal(nextPreparationIndex({ length: 4, currentIndex: 3, repeat: "off" }), -1);
});

test("shuffle creates a new order containing every song exactly once", () => {
  const original = [1, 2, 3, 4];
  const shuffled = shuffledCopy(original, () => 0);
  assert.deepEqual(shuffled, [2, 3, 4, 1]);
  assert.deepEqual(original, [1, 2, 3, 4]);
});
