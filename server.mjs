import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { firstMediaUrl, MediaUrlCache } from "./playback-source.mjs";
import { LibraryStore, LibraryValidationError } from "./library-store.mjs";
import { createChartLoader } from "./chart-source.mjs";

const port = Number(process.env.PORT || 4173);
const publicDir = join(process.cwd(), "public");
const libraryStore = new LibraryStore(process.env.LIBRARY_FILE || join(process.cwd(), "data", "library.json"));
const ytdlpAvailable = spawnSync("yt-dlp", ["--version"], { stdio: "ignore" }).status === 0;
const mediaUrlCache = new MediaUrlCache(15 * 60 * 1000);
const thumbnailUrlCache = new MediaUrlCache(24 * 60 * 60 * 1000);
const chartFor = createChartLoader();
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };

function sendJson(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) throw new LibraryValidationError("Library data is too large.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new LibraryValidationError("Request body must be valid JSON."); }
}

async function handleLibrary(req, res) {
  try {
    if (req.method === "GET") return sendJson(res, 200, await libraryStore.read());
    if (req.method === "PUT") return sendJson(res, 200, await libraryStore.replace(await readJson(req)));
    if (req.method === "PATCH") return sendJson(res, 200, await libraryStore.apply(await readJson(req)));
    res.writeHead(405, { allow: "GET, PUT, PATCH" });
    res.end();
  } catch (error) {
    const status = error instanceof LibraryValidationError ? 422 : 500;
    sendJson(res, status, { error: status === 500 ? "The shared library could not be saved." : error.message });
  }
}

function resolveAudioUrl(title, artist) {
  const query = `ytsearch5:${artist} - ${title} official audio`;
  // Search several candidates because the first result can be restricted even
  // when another result is playable. Resolve as soon as yt-dlp prints a URL.
  return new Promise((resolve, reject) => {
    const child = spawn("yt-dlp", ["--no-playlist", "--no-warnings", "--get-url", "-f", "bestaudio[ext=webm]/bestaudio", query], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finishWithFirstMediaUrl = (processEnded = false) => {
      const audioUrl = firstMediaUrl(stdout, processEnded);
      if (!audioUrl || settled) return false;
      settled = true;
      resolve(audioUrl);
      if (!child.killed) child.kill("SIGTERM");
      return true;
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      finishWithFirstMediaUrl();
    });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", () => {
      if (!settled) {
        settled = true;
        reject(new Error("Could not start yt-dlp."));
      }
    });
    child.on("close", (code) => {
      if (finishWithFirstMediaUrl(true) || settled) return;
      settled = true;
      reject(new Error(stderr || `yt-dlp stopped with code ${code}.`));
    });
  });
}

function cachedAudioUrl(title, artist) {
  return mediaUrlCache.getOrResolve(title, artist, () => resolveAudioUrl(title, artist));
}

function resolveThumbnailUrl(title, artist) {
  const query = `ytsearch1:${artist} - ${title} official audio`;
  return new Promise((resolve, reject) => {
    const child = spawn("yt-dlp", ["--no-playlist", "--no-warnings", "--skip-download", "--get-thumbnail", query], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", () => reject(new Error("Could not start yt-dlp.")));
    child.on("close", (code) => {
      const thumbnailUrl = firstMediaUrl(stdout, true);
      if (code === 0 && thumbnailUrl) resolve(thumbnailUrl);
      else reject(new Error(stderr || "No artwork was found for this song."));
    });
  });
}

function cachedThumbnailUrl(title, artist) {
  return thumbnailUrlCache.getOrResolve(title, artist, () => resolveThumbnailUrl(title, artist));
}

async function playAudio(res, title, artist) {
  if (!ytdlpAvailable) return sendJson(res, 503, { error: "yt-dlp is not installed. See README.md for the one-line install command." });
  try {
    const audioUrl = await cachedAudioUrl(title, artist);
    if (res.destroyed) return;
    res.writeHead(302, { location: audioUrl, "cache-control": "no-store" });
    res.end();
  } catch (error) {
    if (!res.headersSent && !res.destroyed) sendJson(res, 502, { error: error.message });
  }
}

async function prepareAudio(res, title, artist) {
  if (!ytdlpAvailable) return sendJson(res, 503, { error: "yt-dlp is not installed. See README.md for the one-line install command." });
  try {
    await cachedAudioUrl(title, artist);
    if (!res.destroyed) {
      res.writeHead(204, { "cache-control": "no-store" });
      res.end();
    }
  } catch (error) {
    if (!res.headersSent && !res.destroyed) sendJson(res, 502, { error: error.message });
  }
}

async function sendArtwork(res, title, artist) {
  if (!ytdlpAvailable) return sendJson(res, 503, { error: "yt-dlp is not installed. See README.md for the one-line install command." });
  try {
    const thumbnailUrl = await cachedThumbnailUrl(title, artist);
    if (!res.destroyed) sendJson(res, 200, { thumbnailUrl });
  } catch (error) {
    if (!res.headersSent && !res.destroyed) sendJson(res, 502, { error: error.message });
  }
}

createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  if (requestUrl.pathname === "/api/health") return sendJson(res, 200, { ytdlpAvailable });
  if (requestUrl.pathname === "/api/library") return handleLibrary(req, res);
  if (requestUrl.pathname === "/api/chart") {
    try { return sendJson(res, 200, { songs: await chartFor(requestUrl.searchParams.get("year") || "") }); }
    catch (error) { return sendJson(res, 422, { error: error.message }); }
  }
  if (requestUrl.pathname === "/api/play") return playAudio(res, requestUrl.searchParams.get("title") || "", requestUrl.searchParams.get("artist") || "");
  if (requestUrl.pathname === "/api/prepare") return prepareAudio(res, requestUrl.searchParams.get("title") || "", requestUrl.searchParams.get("artist") || "");
  if (requestUrl.pathname === "/api/artwork") return sendArtwork(res, requestUrl.searchParams.get("title") || "", requestUrl.searchParams.get("artist") || "");
  const safePath = normalize(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname).replace(/^[/\\]+/, "");
  const file = join(publicDir, safePath);
  if (!file.startsWith(publicDir) || !existsSync(file)) return sendJson(res, 404, { error: "Not found" });
  res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Year-End Radio is running at http://localhost:${port}`));
