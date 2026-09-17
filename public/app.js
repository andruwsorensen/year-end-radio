const year = document.querySelector("#year");
const load = document.querySelector("#load");
const filter = document.querySelector("#filter");
const favoritesOnly = document.querySelector("#favorites-only");
const favoriteStatsOpen = document.querySelector("#favorite-stats-open");
const favoriteStatsDialog = document.querySelector("#favorite-stats-dialog");
const favoriteStatsClose = document.querySelector("#favorite-stats-close");
const favoriteStats = document.querySelector("#favorite-stats");
const status = document.querySelector("#status");
const songs = document.querySelector("#songs");
const player = document.querySelector("#player");
let chart = [];
let activeSongKey = null;
const favoritesStorageKey = "year-end-radio-favorites";
let favorites = loadFavorites();

function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(favoritesStorageKey)) || {}; }
  catch { return {}; }
}

function favoriteKey(song) {
  return `${year.value}:${song.rank}`;
}

function saveFavorites() {
  localStorage.setItem(favoritesStorageKey, JSON.stringify(favorites));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function renderFavoriteStats() {
  const counts = Object.values(favorites).reduce((totals, favorite) => {
    if (Number.isInteger(favorite.year)) totals[favorite.year] = (totals[favorite.year] || 0) + 1;
    return totals;
  }, {});
  const years = Object.entries(counts).sort(([, firstCount], [, secondCount]) => secondCount - firstCount);
  if (!years.length) {
    favoriteStats.innerHTML = "<p><strong>Your favorite year</strong><span>Star songs to see which chart year wins.</span></p>";
    return;
  }
  const topCount = Number(years[0][1]);
  const topYears = years.filter(([, count]) => Number(count) === topCount).map(([favoriteYear]) => favoriteYear);
  const winner = topYears.join(" & ");
  const total = years.reduce((sum, [, count]) => sum + Number(count), 0);
  favoriteStats.innerHTML = `<p><strong>Your favorite year: ${winner}</strong><span>${topCount} favorite${topCount === 1 ? "" : "s"} · ${total} saved total</span></p><div class="year-counts">${years.map(([favoriteYear, count]) => `<span class="year-count ${topYears.includes(favoriteYear) ? "is-best" : ""}">${favoriteYear}<b>${count}</b></span>`).join("")}</div>`;
}

function render() {
  renderFavoriteStats();
  const query = filter.value.trim().toLowerCase();
  const visible = chart.filter((song) => {
    const matchesSearch = `${song.title} ${song.artist}`.toLowerCase().includes(query);
    return matchesSearch && (!favoritesOnly.checked || favorites[favoriteKey(song)]);
  });
  songs.innerHTML = visible.map((song) => {
    const key = favoriteKey(song);
    const starred = Boolean(favorites[key]);
    const starLabel = starred ? "Remove from favorites" : "Add to favorites";
    const isPlaying = key === activeSongKey && !player.paused;
    const playLabel = isPlaying ? "Pause" : "Play";
    return `<article class="song"><div class="track-control"><button class="play" data-song-key="${key}" data-title="${encodeURIComponent(song.title)}" data-artist="${encodeURIComponent(song.artist)}" aria-label="${playLabel} ${escapeHtml(song.title)} by ${escapeHtml(song.artist)}"><span aria-hidden="true">${isPlaying ? "❚❚" : "▶"}</span></button><span class="rank">#${song.rank}</span></div><div class="track-details"><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(song.artist)}</span></div><button class="favorite ${starred ? "is-starred" : ""}" data-key="${key}" data-rank="${song.rank}" data-title="${encodeURIComponent(song.title)}" data-artist="${encodeURIComponent(song.artist)}" aria-label="${starLabel}: ${escapeHtml(song.title)} by ${escapeHtml(song.artist)}" aria-pressed="${starred}">${starred ? "★" : "☆"}</button></article>`;
  }).join("");
  if (!visible.length) songs.innerHTML = "<p>No songs match that filter.</p>";
}

async function loadChart() {
  status.textContent = `Loading ${year.value}…`;
  songs.innerHTML = "";
  try {
    const response = await fetch(`/api/chart?year=${encodeURIComponent(year.value)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    chart = data.songs;
    status.textContent = `${chart.length} songs from ${year.value}`;
    render();
  } catch (error) { status.textContent = error.message; }
}

load.addEventListener("click", loadChart);
year.addEventListener("change", loadChart);
filter.addEventListener("input", render);
favoritesOnly.addEventListener("change", render);
favoriteStatsOpen.addEventListener("click", () => favoriteStatsDialog.showModal());
favoriteStatsClose.addEventListener("click", () => favoriteStatsDialog.close());
songs.addEventListener("click", (event) => {
  const favorite = event.target.closest(".favorite");
  if (favorite) {
    const key = favorite.dataset.key;
    if (favorites[key]) delete favorites[key];
    else favorites[key] = {
      year: Number(year.value), rank: Number(favorite.dataset.rank),
      title: decodeURIComponent(favorite.dataset.title), artist: decodeURIComponent(favorite.dataset.artist),
    };
    saveFavorites();
    render();
    return;
  }
  const button = event.target.closest(".play");
  if (!button) return;
  const songKey = button.dataset.songKey;
  if (songKey === activeSongKey && player.src) {
    if (player.paused) player.play();
    else player.pause();
    return;
  }
  const title = decodeURIComponent(button.dataset.title);
  const artist = decodeURIComponent(button.dataset.artist);
  activeSongKey = songKey;
  status.textContent = `Finding ${title}…`;
  player.src = `/api/play?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
  player.play().then(() => { status.textContent = `Playing ${title} — ${artist}`; }).catch(() => { status.textContent = "Press play in the player below if your browser blocked autoplay."; render(); });
});
player.addEventListener("play", render);
player.addEventListener("pause", render);
player.addEventListener("ended", () => { activeSongKey = null; render(); });
loadChart();
