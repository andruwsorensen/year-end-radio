import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LibraryStore, LibraryValidationError } from "../library-store.mjs";

const song = { year: 1999, rank: 1, title: "Believe", artist: "Cher" };

async function temporaryStore() {
  const directory = await mkdtemp(join(tmpdir(), "year-end-radio-"));
  const file = join(directory, "library.json");
  return { file, store: new LibraryStore(file) };
}

test("a new store starts empty and persists replacements", async () => {
  const { file, store } = await temporaryStore();
  assert.deepEqual((await store.read()).favorites, {});

  const saved = await store.replace({ favorites: { oldKey: song }, playlists: {}, playback: { repeat: "all" } });
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.favorites["1999:1"], song);
  assert.equal(JSON.parse(await readFile(file, "utf8")).playback.repeat, "all");
});

test("serialized actions preserve changes from different devices", async () => {
  const { store } = await temporaryStore();
  await Promise.all([
    store.apply({ type: "toggleFavorite", song }),
    store.apply({ type: "createPlaylist", id: "road-trip", name: "Road trip" }),
  ]);
  const saved = await store.apply({ type: "addToPlaylist", id: "road-trip", song });

  assert.equal(saved.revision, 3);
  assert.deepEqual(saved.favorites["1999:1"], song);
  assert.deepEqual(saved.playlists["road-trip"].songs, [song]);
});

test("invalid songs are rejected without changing the file", async () => {
  const { store } = await temporaryStore();
  await assert.rejects(
    store.apply({ type: "toggleFavorite", song: { ...song, rank: 0 } }),
    LibraryValidationError,
  );
  assert.equal((await store.read()).revision, 0);
});
