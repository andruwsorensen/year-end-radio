import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const repeats = new Set(["off", "all", "one"]);

export class LibraryValidationError extends Error {}

function cleanSong(value) {
  const song = {
    year: Number(value?.year),
    rank: Number(value?.rank),
    title: String(value?.title || "").trim(),
    artist: String(value?.artist || "").trim(),
  };
  if (!Number.isInteger(song.year) || song.year < 1958 || song.year > 9999 || !Number.isInteger(song.rank) || song.rank < 1 || song.rank > 100 || !song.title || !song.artist) {
    throw new LibraryValidationError("Every saved song needs a valid year, rank, title, and artist.");
  }
  return song;
}

function songKey(song) {
  return `${song.year}:${song.rank}`;
}

function cleanLibrary(value = {}) {
  const favorites = {};
  for (const song of Object.values(value.favorites || {})) {
    const clean = cleanSong(song);
    favorites[songKey(clean)] = clean;
  }

  const playlists = {};
  for (const [id, playlist] of Object.entries(value.playlists || {})) {
    const cleanId = String(id).trim();
    const name = String(playlist?.name || "").trim();
    if (!cleanId || cleanId.length > 100 || !name || name.length > 100 || !Array.isArray(playlist?.songs)) {
      throw new LibraryValidationError("Every playlist needs a valid id, name, and song list.");
    }
    const uniqueSongs = new Map(playlist.songs.map((song) => {
      const clean = cleanSong(song);
      return [songKey(clean), clean];
    }));
    playlists[cleanId] = { name, songs: [...uniqueSongs.values()] };
  }

  const repeat = repeats.has(value.playback?.repeat) ? value.playback.repeat : "off";
  return { favorites, playlists, playback: { repeat } };
}

function defaultLibrary() {
  return { version: 1, revision: 0, updatedAt: null, favorites: {}, playlists: {}, playback: { repeat: "off" } };
}

export class LibraryStore {
  #file;
  #library;
  #pending = Promise.resolve();

  constructor(file) {
    this.#file = file;
  }

  async read() {
    if (this.#library) return structuredClone(this.#library);
    try {
      const parsed = JSON.parse(await readFile(this.#file, "utf8"));
      this.#library = { ...defaultLibrary(), ...cleanLibrary(parsed), revision: Number(parsed.revision) || 0, updatedAt: parsed.updatedAt || null };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.#library = defaultLibrary();
    }
    return structuredClone(this.#library);
  }

  async replace(value) {
    return this.#enqueue(async () => {
      const clean = cleanLibrary(value);
      await this.read();
      this.#library = { version: 1, revision: this.#library.revision + 1, updatedAt: new Date().toISOString(), ...clean };
      await this.#write();
      return structuredClone(this.#library);
    });
  }

  async apply(action) {
    return this.#enqueue(async () => {
      await this.read();
      const next = structuredClone(this.#library);
      const type = String(action?.type || "");

      if (type === "toggleFavorite") {
        const song = cleanSong(action.song);
        const key = songKey(song);
        if (next.favorites[key]) delete next.favorites[key];
        else next.favorites[key] = song;
      } else if (type === "createPlaylist") {
        const id = String(action.id || "").trim();
        const name = String(action.name || "").trim();
        if (!id || id.length > 100 || !name || name.length > 100) throw new LibraryValidationError("Choose a valid playlist name.");
        if (next.playlists[id]) throw new LibraryValidationError("That playlist already exists.");
        next.playlists[id] = { name, songs: [] };
      } else if (type === "deletePlaylist") {
        delete next.playlists[String(action.id || "")];
      } else if (type === "addToPlaylist") {
        const playlist = next.playlists[String(action.id || "")];
        if (!playlist) throw new LibraryValidationError("That playlist no longer exists.");
        const song = cleanSong(action.song);
        if (!playlist.songs.some((saved) => songKey(saved) === songKey(song))) playlist.songs.push(song);
      } else if (type === "removeFromPlaylist") {
        const playlist = next.playlists[String(action.id || "")];
        if (!playlist) throw new LibraryValidationError("That playlist no longer exists.");
        const key = songKey(cleanSong(action.song));
        playlist.songs = playlist.songs.filter((song) => songKey(song) !== key);
      } else if (type === "setRepeat") {
        if (!repeats.has(action.repeat)) throw new LibraryValidationError("Repeat must be off, all, or one.");
        next.playback.repeat = action.repeat;
      } else {
        throw new LibraryValidationError("Unknown library action.");
      }

      this.#library = { ...next, revision: next.revision + 1, updatedAt: new Date().toISOString() };
      await this.#write();
      return structuredClone(this.#library);
    });
  }

  #enqueue(operation) {
    const result = this.#pending.then(operation);
    this.#pending = result.catch(() => {});
    return result;
  }

  async #write() {
    await mkdir(dirname(this.#file), { recursive: true });
    const temporaryFile = `${this.#file}.${process.pid}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify(this.#library, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryFile, this.#file);
  }
}
