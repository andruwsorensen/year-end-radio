import { nextPreparationIndex, nextQueueIndex, shuffledCopy } from "./player-state.js";
import { yearRangeLabel, yearsInRange } from "./chart-range.js";

const yearStart = document.querySelector("#year-start");
const yearEnd = document.querySelector("#year-end");
const load = document.querySelector("#load");
const filter = document.querySelector("#filter");
const favoritesOnly = document.querySelector("#favorites-only");
const favoriteStatsOpen = document.querySelector("#favorite-stats-open");
const favoriteStatsDialog = document.querySelector("#favorite-stats-dialog");
const favoriteStatsClose = document.querySelector("#favorite-stats-close");
const favoriteStats = document.querySelector("#favorite-stats");
const playlistSelect = document.querySelector("#playlist");
const shuffleVisibleButton = document.querySelector("#shuffle-visible");
const playlistName = document.querySelector("#playlist-name");
const playlistNew = document.querySelector("#playlist-new");
const playlistDelete = document.querySelector("#playlist-delete");
const songOptions = document.querySelector("#song-options");
const playlistAddOptions = document.querySelector("#playlist-add-options");
const playlistEmptyHint = document.querySelector("#playlist-empty-hint");
const playlistTarget = document.querySelector("#playlist-target");
const playlistSave = document.querySelector("#playlist-save");
const playlistRemove = document.querySelector("#playlist-remove");
const status = document.querySelector("#status");
const songs = document.querySelector("#songs");
const player = document.querySelector("#player");
const nowPlayingArtwork = document.querySelector("#now-playing-artwork");
const artworkImage = document.querySelector("#artwork-image");
const artworkPlaceholder = document.querySelector("#artwork-placeholder");
const nowPlayingTitle = document.querySelector("#now-playing-title");
const nowPlayingArtist = document.querySelector("#now-playing-artist");
const previousButton = document.querySelector("#previous");
const nextButton = document.querySelector("#next");
const repeatButton = document.querySelector("#repeat");

const favoritesStorageKey = "year-end-radio-favorites";
const playlistsStorageKey = "year-end-radio-playlists";
const playbackStorageKey = "year-end-radio-playback";
let chart = [];
let chartLoadId = 0;
let visibleSongs = [];
let playbackQueue = [];
let activeSongKey = null;
let pendingPlaylistSong = null;
let openMenuButton = null;
let favorites = loadStoredValue(favoritesStorageKey, {});
let playlists = loadStoredValue(playlistsStorageKey, {});
const playbackSettings = loadStoredValue(playbackStorageKey, {});
let repeatMode = ["off", "all", "one"].includes(playbackSettings.repeat) ? playbackSettings.repeat : "off";

function loadStoredValue(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function saveStoredValue(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function applySharedLibrary(library) {
  favorites = library.favorites || {};
  playlists = library.playlists || {};
  repeatMode = ["off", "all", "one"].includes(library.playback?.repeat) ? library.playback.repeat : "off";
  saveStoredValue(favoritesStorageKey, favorites);
  saveStoredValue(playlistsStorageKey, playlists);
  saveStoredValue(playbackStorageKey, { repeat: repeatMode });
}

async function libraryRequest(options = {}) {
  const response = await fetch("/api/library", options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The shared library is unavailable.");
  applySharedLibrary(data);
  return data;
}

async function performLibraryAction(action) {
  return libraryRequest({
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(action),
  });
}

async function refreshSharedLibrary({ quiet = false } = {}) {
  await libraryRequest({ cache: "no-store" });
  render();
  if (!quiet) status.textContent = "Shared favorites and playlists are up to date.";
}

function songKey(song) {
  return `${song.year}:${song.rank}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function selectedSource() {
  if (playlistSelect.value === "favorites") {
    return Object.values(favorites).sort((first, second) => first.rank - second.rank || first.title.localeCompare(second.title));
  }
  if (playlistSelect.value.startsWith("custom:")) return playlists[playlistSelect.value.slice(7)]?.songs || [];
  return chart;
}

function renderPlaylists(selectedValue = playlistSelect.value || "chart") {
  const customOptions = Object.entries(playlists)
    .sort(([, first], [, second]) => first.name.localeCompare(second.name))
    .map(([id, playlist]) => `<option value="custom:${id}">${escapeHtml(playlist.name)}</option>`)
    .join("");
  playlistSelect.innerHTML = `<option value="chart">Current year range</option><option value="favorites">Favorites (${Object.keys(favorites).length})</option>${customOptions}`;
  playlistSelect.value = [...playlistSelect.options].some((option) => option.value === selectedValue) ? selectedValue : "chart";
  playlistDelete.disabled = !playlistSelect.value.startsWith("custom:");

  playlistTarget.innerHTML = Object.entries(playlists)
    .sort(([, first], [, second]) => first.name.localeCompare(second.name))
    .map(([id, playlist]) => `<option value="${id}">${escapeHtml(playlist.name)}</option>`)
    .join("");
  playlistSave.disabled = !playlistTarget.options.length;
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
  const total = years.reduce((sum, [, count]) => sum + Number(count), 0);
  favoriteStats.innerHTML = `<p><strong>Your favorite year: ${topYears.join(" & ")}</strong><span>${topCount} favorite${topCount === 1 ? "" : "s"} · ${total} saved total</span></p><div class="year-counts">${years.map(([favoriteYear, count]) => `<span class="year-count ${topYears.includes(favoriteYear) ? "is-best" : ""}">${favoriteYear}<b>${count}</b></span>`).join("")}</div>`;
}

function renderPlaybackControls() {
  repeatButton.classList.toggle("is-active", repeatMode !== "off");
  repeatButton.setAttribute("aria-pressed", String(repeatMode !== "off"));
  repeatButton.textContent = repeatMode === "one" ? "Repeat: one" : `Repeat: ${repeatMode}`;
  repeatButton.title = `Repeat ${repeatMode}`;
}

function render() {
  closeSongOptions();
  renderFavoriteStats();
  renderPlaylists();
  renderPlaybackControls();
  const query = filter.value.trim().toLowerCase();
  visibleSongs = selectedSource().filter((song) => {
    const matchesSearch = `${song.title} ${song.artist}`.toLowerCase().includes(query);
    return matchesSearch && (!favoritesOnly.checked || favorites[songKey(song)]);
  });
  shuffleVisibleButton.disabled = !visibleSongs.length;
  shuffleVisibleButton.textContent = visibleSongs.length ? `Shuffle visible (${visibleSongs.length})` : "Shuffle visible";
  songs.innerHTML = visibleSongs.map((song) => {
    const key = songKey(song);
    const isCurrent = key === activeSongKey;
    const isPlaying = isCurrent && !player.paused;
    const starred = Boolean(favorites[key]);
    return `<article class="song${isCurrent ? " is-current" : ""}"${isCurrent ? ' aria-current="true"' : ""}><div class="track-control"><button class="play" data-song-key="${key}" aria-label="${isPlaying ? "Pause" : "Play"} ${escapeHtml(song.title)} by ${escapeHtml(song.artist)}"><span aria-hidden="true">${isPlaying ? "❚❚" : "▶"}</span></button><span class="rank">#${song.rank} · ${song.year}</span></div><div class="track-details"><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(song.artist)}</span></div><div class="song-actions"><button class="song-favorite${starred ? " is-favorite" : ""}" data-song-key="${key}" aria-label="${starred ? "Remove" : "Add"} ${escapeHtml(song.title)} ${starred ? "from" : "to"} favorites" aria-pressed="${starred}" title="${starred ? "Remove from" : "Add to"} favorites">${starred ? "★" : "☆"}</button><button class="song-menu" data-song-key="${key}" aria-label="Playlist options for ${escapeHtml(song.title)}" aria-controls="song-options" aria-expanded="false" title="Playlist options">•••</button></div></article>`;
  }).join("");
  if (!visibleSongs.length) songs.innerHTML = "<p>No songs match this playlist and filter.</p>";
}

async function fetchChart(selectedYear) {
  const response = await fetch(`/api/chart?year=${encodeURIComponent(selectedYear)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(`${selectedYear}: ${data.error}`);
  return data.songs.map((song) => ({ ...song, year: selectedYear }));
}

async function loadChart() {
  const loadId = ++chartLoadId;
  let selectedYears;
  try {
    selectedYears = yearsInRange(yearStart.value, yearEnd.value);
  } catch (error) {
    status.textContent = error.message;
    load.disabled = false;
    return;
  }

  const rangeLabel = yearRangeLabel(selectedYears);
  status.textContent = `Loading ${rangeLabel}…`;
  songs.innerHTML = "";
  load.disabled = true;
  try {
    const loadedSongs = [];
    // Small batches make long ranges faster without flooding the chart source.
    for (let index = 0; index < selectedYears.length; index += 4) {
      const batch = selectedYears.slice(index, index + 4);
      loadedSongs.push(...(await Promise.all(batch.map(fetchChart))).flat());
      if (loadId !== chartLoadId) return;
      status.textContent = `Loading ${rangeLabel}… ${Math.min(index + batch.length, selectedYears.length)} of ${selectedYears.length} charts`;
    }
    chart = loadedSongs;
    playlistSelect.value = "chart";
    status.textContent = `${chart.length} songs from ${rangeLabel}`;
    render();
  } catch (error) {
    if (loadId === chartLoadId) status.textContent = error.message;
  } finally {
    if (loadId === chartLoadId) load.disabled = false;
  }
}

function findVisibleSong(key) {
  return visibleSongs.find((song) => songKey(song) === key);
}

function songApiUrl(path, song) {
  return `${path}?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`;
}

function prepareNextSong() {
  if (!playbackQueue.length) return;
  const currentIndex = playbackQueue.findIndex((song) => songKey(song) === activeSongKey);
  const nextIndex = nextPreparationIndex({ length: playbackQueue.length, currentIndex, repeat: repeatMode });
  if (nextIndex === -1) return;
  fetch(songApiUrl("/api/prepare", playbackQueue[nextIndex])).catch(() => {});
}

function loadArtwork(song) {
  const key = songKey(song);
  artworkImage.hidden = true;
  artworkImage.removeAttribute("src");
  artworkImage.dataset.songKey = key;
  artworkPlaceholder.hidden = false;
  nowPlayingArtwork.setAttribute("aria-label", `Loading artwork for ${song.title} by ${song.artist}`);

  fetch(songApiUrl("/api/artwork", song))
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (activeSongKey === key) artworkImage.src = data.thumbnailUrl;
    })
    .catch(() => {
      if (activeSongKey === key) nowPlayingArtwork.setAttribute("aria-label", `No artwork available for ${song.title} by ${song.artist}`);
    });
}

function playSong(song, restart = false) {
  if (!song) return;
  const key = songKey(song);
  nowPlayingTitle.textContent = song.title;
  nowPlayingArtist.textContent = song.artist;
  if (restart && key === activeSongKey) player.currentTime = 0;
  if (key !== activeSongKey || !player.src) {
    activeSongKey = key;
    loadArtwork(song);
    status.textContent = `Finding ${song.title}…`;
    player.src = songApiUrl("/api/play", song);
  }
  player.play().then(() => {
    status.textContent = `Playing ${song.title} — ${song.artist}`;
    prepareNextSong();
  }).catch(() => {
    status.textContent = "Press play in the player if your browser blocked autoplay.";
    render();
  });
}

artworkImage.addEventListener("load", () => {
  if (artworkImage.dataset.songKey !== activeSongKey) return;
  artworkImage.hidden = false;
  artworkPlaceholder.hidden = true;
  const song = playbackQueue.find((candidate) => songKey(candidate) === activeSongKey) || visibleSongs.find((candidate) => songKey(candidate) === activeSongKey);
  if (song) nowPlayingArtwork.setAttribute("aria-label", `Artwork for ${song.title} by ${song.artist}`);
});
artworkImage.addEventListener("error", () => {
  artworkImage.hidden = true;
  artworkPlaceholder.hidden = false;
});

function moveInQueue(direction, automatic = false) {
  if (!playbackQueue.length) playbackQueue = [...visibleSongs];
  if (!playbackQueue.length) return;
  const currentIndex = playbackQueue.findIndex((song) => songKey(song) === activeSongKey);
  const startIndex = currentIndex === -1 ? (direction === 1 ? -1 : playbackQueue.length) : currentIndex;
  const effectiveRepeat = automatic ? repeatMode : (repeatMode === "all" ? "all" : "off");
  const nextIndex = nextQueueIndex({ length: playbackQueue.length, currentIndex: startIndex, direction, repeat: effectiveRepeat });
  if (nextIndex === -1) {
    activeSongKey = null;
    status.textContent = direction === 1 ? "End of playlist." : "Start of playlist.";
    render();
    return;
  }
  playSong(playbackQueue[nextIndex], automatic && repeatMode === "one");
}

// Return the shared menu to the page before song rows are redrawn.
function closeSongOptions(restoreFocus = false) {
  if (!openMenuButton) return;
  if (restoreFocus) openMenuButton.focus();
  openMenuButton.setAttribute("aria-expanded", "false");
  openMenuButton.closest(".song").classList.remove("has-open-menu");
  songOptions.hidden = true;
  songOptions.classList.remove("open-up");
  document.body.append(songOptions);
  openMenuButton = null;
  pendingPlaylistSong = null;
}

function openSongOptions(button, song) {
  closeSongOptions();
  pendingPlaylistSong = song;
  openMenuButton = button;
  const row = button.closest(".song");
  row.append(songOptions);
  row.classList.add("has-open-menu");
  button.setAttribute("aria-expanded", "true");
  updateSongOptions();
  songOptions.hidden = false;
  // Place the menu above songs near the viewport bottom so every control stays reachable.
  const visibleBottom = document.querySelector(".player-dock").getBoundingClientRect().top;
  songOptions.classList.toggle("open-up", songOptions.getBoundingClientRect().bottom > visibleBottom);
}

function updateSongOptions() {
  if (!pendingPlaylistSong) return;
  const inCustomPlaylist = playlistSelect.value.startsWith("custom:");
  playlistRemove.hidden = !inCustomPlaylist;
  const hasCustomPlaylists = Boolean(playlistTarget.options.length);
  playlistAddOptions.hidden = false;
  playlistTarget.disabled = !hasCustomPlaylists;
  playlistEmptyHint.hidden = hasCustomPlaylists;
}

load.addEventListener("click", loadChart);
yearStart.addEventListener("change", loadChart);
yearEnd.addEventListener("change", loadChart);
filter.addEventListener("input", render);
favoritesOnly.addEventListener("change", render);
favoriteStatsOpen.addEventListener("click", () => favoriteStatsDialog.showModal());
favoriteStatsClose.addEventListener("click", () => favoriteStatsDialog.close());
document.addEventListener("click", (event) => {
  if (openMenuButton && !songOptions.contains(event.target) && !openMenuButton.contains(event.target)) closeSongOptions();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openMenuButton) {
    closeSongOptions(true);
    event.preventDefault();
  }
});

playlistSelect.addEventListener("change", () => {
  const count = selectedSource().length;
  status.textContent = `${count} song${count === 1 ? "" : "s"} in this playlist.`;
  render();
});

shuffleVisibleButton.addEventListener("click", () => {
  if (!visibleSongs.length) return;
  playbackQueue = shuffledCopy(visibleSongs);
  status.textContent = `Shuffling ${playbackQueue.length} visible songs…`;
  playSong(playbackQueue[0]);
});

playlistNew.addEventListener("click", async () => {
  const name = playlistName.value.trim();
  if (!name) {
    status.textContent = "Enter a name for the new playlist.";
    playlistName.focus();
    return;
  }
  const id = globalThis.crypto?.randomUUID?.() || String(Date.now());
  try {
    await performLibraryAction({ type: "createPlaylist", id, name });
    playlistName.value = "";
    renderPlaylists(`custom:${id}`);
    status.textContent = `Created ${name}.`;
    render();
  } catch (error) { status.textContent = error.message; }
});
playlistName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") playlistNew.click();
});

playlistDelete.addEventListener("click", async () => {
  if (!playlistSelect.value.startsWith("custom:")) return;
  const id = playlistSelect.value.slice(7);
  if (!confirm(`Delete the playlist “${playlists[id].name}”?`)) return;
  try {
    await performLibraryAction({ type: "deletePlaylist", id });
    renderPlaylists("chart");
    render();
  } catch (error) { status.textContent = error.message; }
});

playlistSave.addEventListener("click", async () => {
  const target = playlists[playlistTarget.value];
  if (!target || !pendingPlaylistSong) return;
  const song = pendingPlaylistSong;
  const id = playlistTarget.value;
  try {
    await performLibraryAction({ type: "addToPlaylist", id, song });
    status.textContent = `Added ${song.title} to ${target.name}.`;
    closeSongOptions();
    render();
  } catch (error) { status.textContent = error.message; }
});

async function toggleSongFavorite(song) {
  const key = songKey(song);
  try {
    await performLibraryAction({ type: "toggleFavorite", song });
    status.textContent = favorites[key] ? `Added ${song.title} to Favorites.` : `Removed ${song.title} from Favorites.`;
    render();
  } catch (error) { status.textContent = error.message; }
}

playlistRemove.addEventListener("click", async () => {
  if (!pendingPlaylistSong || !playlistSelect.value.startsWith("custom:")) return;
  const id = playlistSelect.value.slice(7);
  const name = playlists[id].name;
  const song = pendingPlaylistSong;
  try {
    await performLibraryAction({ type: "removeFromPlaylist", id, song });
    status.textContent = `Removed ${song.title} from ${name}.`;
    closeSongOptions();
    render();
  } catch (error) { status.textContent = error.message; }
});

songs.addEventListener("click", (event) => {
  const song = findVisibleSong(event.target.closest("[data-song-key]")?.dataset.songKey);
  if (!song) return;

  if (event.target.closest(".song-menu")) {
    const button = event.target.closest(".song-menu");
    if (button === openMenuButton) closeSongOptions();
    else openSongOptions(button, song);
    return;
  }

  if (event.target.closest(".song-favorite")) {
    toggleSongFavorite(song);
    return;
  }

  if (event.target.closest(".play")) {
    const key = songKey(song);
    if (key === activeSongKey && player.src) {
      if (player.paused) player.play();
      else player.pause();
      return;
    }
    playbackQueue = [...visibleSongs];
    playSong(song);
  }
});

repeatButton.addEventListener("click", async () => {
  const nextRepeat = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
  try {
    await performLibraryAction({ type: "setRepeat", repeat: nextRepeat });
    renderPlaybackControls();
  } catch (error) { status.textContent = error.message; }
});
previousButton.addEventListener("click", () => moveInQueue(-1));
nextButton.addEventListener("click", () => moveInQueue(1));
player.addEventListener("play", render);
player.addEventListener("pause", render);
player.addEventListener("ended", () => moveInQueue(1, true));
player.addEventListener("error", () => { status.textContent = "This source could not be played. Try skipping to the next song."; });

async function startApp() {
  try { await refreshSharedLibrary({ quiet: true }); }
  catch (error) { status.textContent = `${error.message} Using this browser's last saved copy.`; }
  renderPlaylists("chart");
  renderPlaybackControls();
  await loadChart();
}

window.addEventListener("focus", () => refreshSharedLibrary({ quiet: true }).catch(() => {}));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshSharedLibrary({ quiet: true }).catch(() => {});
});
setInterval(() => {
  if (!document.hidden) refreshSharedLibrary({ quiet: true }).catch(() => {});
}, 30_000);

startApp();
