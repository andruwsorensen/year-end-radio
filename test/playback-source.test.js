import test from "node:test";
import assert from "node:assert/strict";
import { firstMediaUrl, MediaUrlCache } from "../playback-source.mjs";

test("returns the first complete HTTPS URL", () => {
  const output = "warning text\nhttps://media.example/first\nhttps://media.example/second\n";
  assert.equal(firstMediaUrl(output), "https://media.example/first");
});

test("waits for a complete line while yt-dlp is still running", () => {
  assert.equal(firstMediaUrl("https://media.example/part"), null);
  assert.equal(firstMediaUrl("https://media.example/part", true), "https://media.example/part");
});

test("ignores non-HTTPS output", () => {
  assert.equal(firstMediaUrl("ERROR: restricted result\n", true), null);
});

test("shares an in-progress lookup and reuses its resolved URL", async () => {
  const cache = new MediaUrlCache(1000);
  let finishLookup;
  let lookupCount = 0;
  const resolver = () => {
    lookupCount += 1;
    return new Promise((resolve) => { finishLookup = resolve; });
  };

  const first = cache.getOrResolve("Song", "Artist", resolver);
  const second = cache.getOrResolve("song", "artist", resolver);
  assert.equal(first, second);
  assert.equal(lookupCount, 0);

  await Promise.resolve();
  assert.equal(lookupCount, 1);
  finishLookup("https://media.example/song");
  assert.equal(await first, "https://media.example/song");
  assert.equal(await cache.getOrResolve("Song", "Artist", resolver), "https://media.example/song");
  assert.equal(lookupCount, 1);
});

test("resolves again after a cached URL expires", async () => {
  let now = 100;
  let lookupCount = 0;
  const cache = new MediaUrlCache(50, () => now);
  const resolver = () => Promise.resolve(`https://media.example/${++lookupCount}`);

  assert.equal(await cache.getOrResolve("Song", "Artist", resolver), "https://media.example/1");
  now = 151;
  assert.equal(await cache.getOrResolve("Song", "Artist", resolver), "https://media.example/2");
});

test("does not cache a failed lookup", async () => {
  const cache = new MediaUrlCache(1000);
  await assert.rejects(cache.getOrResolve("Song", "Artist", () => Promise.reject(new Error("unavailable"))));
  assert.equal(await cache.getOrResolve("Song", "Artist", () => Promise.resolve("https://media.example/retry")), "https://media.example/retry");
});
