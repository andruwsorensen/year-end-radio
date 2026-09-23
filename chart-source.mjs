const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);

function decodeHtml(value) {
  return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/^"|"$/g, "").trim();
}

// Keep successful charts and share an in-flight lookup when a range is requested twice.
export function createChartLoader(fetchChartPage = fetch, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  const cachedCharts = new Map();

  async function fetchChart(year) {
    const url = `https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_${year}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetchChartPage(url, { headers: { "user-agent": "YearEndRadio/0.1 (personal local app)" } });
        if (!response.ok) {
          if (retryableStatuses.has(response.status) && attempt < 2) {
            await wait(1000 * (attempt + 1));
            continue;
          }
          throw new Error(response.status === 404
            ? `No chart source was found for ${year}.`
            : `The chart source is temporarily unavailable for ${year} (HTTP ${response.status}).`);
        }
        const html = await response.text();
        const rows = [...html.matchAll(/<tr[^>]*>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/g)];
        const songs = rows.map((match) => ({ rank: Number(match[1]), title: decodeHtml(match[2]), artist: decodeHtml(match[3]) })).filter((song) => song.rank >= 1 && song.rank <= 100 && song.title && song.artist);
        if (songs.length < 50) throw new Error(`The chart source changed its layout for ${year}.`);
        return songs.slice(0, 100);
      } catch (error) {
        if (attempt < 2 && !(error instanceof Error && /chart source/.test(error.message))) {
          await wait(1000 * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
  }

  return function chartFor(year) {
    if (!/^\d{4}$/.test(year) || Number(year) < 1958 || Number(year) > new Date().getFullYear()) {
      throw new Error("Choose a year from 1958 through the current year.");
    }
    if (!cachedCharts.has(year)) {
      const lookup = fetchChart(year).catch((error) => {
        cachedCharts.delete(year);
        throw error;
      });
      cachedCharts.set(year, lookup);
    }
    return cachedCharts.get(year);
  };
}
