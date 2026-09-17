const year = document.querySelector("#year");
const load = document.querySelector("#load");
const filter = document.querySelector("#filter");
const favoritesOnly = document.querySelector("#favorites-only");
const status = document.querySelector("#status");
const songs = document.querySelector("#songs");
const player = document.querySelector("#player");
let chart = [];
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

function render() {
  const query = filter.value.trim().toLowerCase();
  const visible = chart.filter((song) => {
    const matchesSearch = `${song.title} ${song.artist}`.toLowerCase().includes(query);
    return matchesSearch && (!favoritesOnly.checked || favorites[favoriteKey(song)]);
  });
  songs.innerHTML = visible.map((song) => {
    const key = favoriteKey(song);
    const starred = Boolean(favorites[key]);
    const starLabel = starred ? "Remove from favorites" : "Add to favorites";
    return `<article class="song"><span class="rank">${song.rank}</span><div><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(song.artist)}</span></div><button class="favorite ${starred ? "is-starred" : ""}" data-key="${key}" data-rank="${song.rank}" data-title="${encodeURIComponent(song.title)}" data-artist="${encodeURIComponent(song.artist)}" aria-label="${starLabel}: ${escapeHtml(song.title)} by ${escapeHtml(song.artist)}" aria-pressed="${starred}">${starred ? "★" : "☆"}</button><button class="play" data-title="${encodeURIComponent(song.title)}" data-artist="${encodeURIComponent(song.artist)}" aria-label="Play ${escapeHtml(song.title)} by ${escapeHtml(song.artist)}">Play</button></article>`;
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
  const title = decodeURIComponent(button.dataset.title);
  const artist = decodeURIComponent(button.dataset.artist);
  status.textContent = `Finding ${title}…`;
  player.src = `/api/play?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
  player.play().then(() => { status.textContent = `Playing ${title} — ${artist}`; }).catch(() => { status.textContent = "Press play in the player below if your browser blocked autoplay."; });
});
loadChart();
