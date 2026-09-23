import test from "node:test";
import assert from "node:assert/strict";
import { createChartLoader } from "../chart-source.mjs";

const chartHtml = Array.from({ length: 100 }, (_, index) => `<tr><td>${index + 1}</td><td>Song ${index + 1}</td><td>Artist</td></tr>`).join("");
const chartResponse = { ok: true, status: 200, text: async () => chartHtml };

test("retries a temporary source failure and caches the recovered chart", async () => {
  let requests = 0;
  const delays = [];
  const chartFor = createChartLoader(async () => {
    requests += 1;
    return requests === 1 ? { ok: false, status: 429 } : chartResponse;
  }, async (ms) => { delays.push(ms); });

  const [first, second] = await Promise.all([chartFor("2024"), chartFor("2024")]);
  assert.equal(first.length, 100);
  assert.deepEqual(second, first);
  assert.equal(requests, 2);
  assert.deepEqual(delays, [1000]);
  assert.deepEqual(await chartFor("2024"), first);
  assert.equal(requests, 2);
});

test("a missing chart does not poison the cache", async () => {
  let requests = 0;
  const chartFor = createChartLoader(async () => {
    requests += 1;
    return requests === 1 ? { ok: false, status: 404 } : chartResponse;
  }, async () => {});

  await assert.rejects(chartFor("2024"), /No chart source was found/);
  assert.equal((await chartFor("2024")).length, 100);
  assert.equal(requests, 2);
});
