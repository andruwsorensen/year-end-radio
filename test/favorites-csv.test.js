import test from "node:test";
import assert from "node:assert/strict";
import { favoritesCsv } from "../public/favorites-csv.js";

test("exports all favorites in playlist order with valid quoted CSV cells", () => {
  const favorites = {
    "2001:2": { year: 2001, rank: 2, title: 'Hello, "World"', artist: "A\nB" },
    "1999:1": { year: 1999, rank: 1, title: "=SUM(1,2)", artist: "+Artist" },
  };
  assert.equal(favoritesCsv(favorites), "year,rank,title,artist\r\n\"1999\",\"1\",\"'=SUM(1,2)\",\"'+Artist\"\r\n\"2001\",\"2\",\"Hello, \"\"World\"\"\",\"A\nB\"\r\n");
  assert.equal(Object.keys(favorites).length, 2);
});

test("empty favorites export has only the header", () => {
  assert.equal(favoritesCsv({}), "year,rank,title,artist\r\n");
});
