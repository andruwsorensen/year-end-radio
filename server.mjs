import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const port = Number(process.env.PORT || 4173);
const publicDir = join(process.cwd(), "public");
const ytdlpAvailable = spawnSync("yt-dlp", ["--version"], { stdio: "ignore" }).status === 0;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };

function sendJson(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function decodeHtml(value) {
  return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/^"|"$/g, "").trim();
}

async function chartFor(year) {
  if (!/^\d{4}$/.test(year) || Number(year) < 1958 || Number(year) > new Date().getFullYear()) throw new Error("Choose a year from 1958 through the current year.");
  const url = `https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_${year}`;
  const response = await fetch(url, { headers: { "user-agent": "YearEndRadio/0.1 (personal local app)" } });
  if (!response.ok) throw new Error(`No chart source was found for ${year}.`);
  const html = await response.text();
  const rows = [...html.matchAll(/<tr[^>]*>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/g)];
  const songs = rows.map((match) => ({ rank: Number(match[1]), title: decodeHtml(match[2]), artist: decodeHtml(match[3]) })).filter((song) => song.rank >= 1 && song.rank <= 100 && song.title && song.artist);
  if (songs.length < 50) throw new Error("The chart source changed its layout; please try another year.");
  return songs.slice(0, 100);
}

function playAudio(res, title, artist) {
  if (!ytdlpAvailable) return sendJson(res, 503, { error: "yt-dlp is not installed. See README.md for the one-line install command." });
  const query = `ytsearch1:${artist} - ${title} official audio`;
  // Redirecting to yt-dlp's resolved media URL lets the browser make its own Range requests for seeking.
  const child = spawn("yt-dlp", ["--no-playlist", "--no-warnings", "--get-url", "-f", "bestaudio[ext=webm]/bestaudio", query], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("error", () => { if (!res.headersSent) sendJson(res, 500, { error: "Could not start yt-dlp." }); });
  child.on("close", (code) => {
    const audioUrl = stdout.trim().split("\n")[0];
    if (code === 0 && audioUrl?.startsWith("https://")) {
      res.writeHead(302, { location: audioUrl, "cache-control": "no-store" });
      return res.end();
    }
    if (!res.headersSent) sendJson(res, 502, { error: stderr || `yt-dlp stopped with code ${code}.` });
  });
  res.on("close", () => { if (!child.killed) child.kill("SIGTERM"); });
}

createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  if (requestUrl.pathname === "/api/health") return sendJson(res, 200, { ytdlpAvailable });
  if (requestUrl.pathname === "/api/chart") {
    try { return sendJson(res, 200, { songs: await chartFor(requestUrl.searchParams.get("year") || "") }); }
    catch (error) { return sendJson(res, 422, { error: error.message }); }
  }
  if (requestUrl.pathname === "/api/play") return playAudio(res, requestUrl.searchParams.get("title") || "", requestUrl.searchParams.get("artist") || "");
  const safePath = normalize(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname).replace(/^[/\\]+/, "");
  const file = join(publicDir, safePath);
  if (!file.startsWith(publicDir) || !existsSync(file)) return sendJson(res, 404, { error: "Not found" });
  res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Year-End Radio is running at http://localhost:${port}`));
