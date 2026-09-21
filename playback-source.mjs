/**
 * Return the first complete HTTPS media URL printed by yt-dlp.
 * While the process is running, an unfinished final line is ignored so a
 * chunk boundary cannot produce a truncated redirect URL.
 */
export function firstMediaUrl(output, processEnded = false) {
  const lines = output.split(/\r?\n/);
  if (!processEnded && !output.endsWith("\n")) lines.pop();
  return lines.find((line) => line.startsWith("https://")) || null;
}

/**
 * Cache short-lived media URLs and share a lookup that is already in progress.
 * Failed lookups are removed so the next request can try again.
 */
export class MediaUrlCache {
  constructor(ttlMs, now = Date.now) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.entries = new Map();
  }

  getOrResolve(title, artist, resolver) {
    const key = JSON.stringify([title.trim().toLowerCase(), artist.trim().toLowerCase()]);
    const existing = this.entries.get(key);
    if (existing?.url && existing.expiresAt > this.now()) return Promise.resolve(existing.url);
    if (existing?.promise) return existing.promise;

    const promise = Promise.resolve().then(resolver);
    this.entries.set(key, { promise });
    promise.then(
      (url) => this.entries.set(key, { url, expiresAt: this.now() + this.ttlMs }),
      () => {
        if (this.entries.get(key)?.promise === promise) this.entries.delete(key);
      },
    );
    return promise;
  }
}
