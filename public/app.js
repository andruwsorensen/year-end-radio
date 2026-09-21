import { nextPreparationIndex, nextQueueIndex, shuffledCopy } from "./player-state.js";

const year = document.querySelector("#year");
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
const playlistDialog = document.querySelector("#playlist-dialog");
const playlistDialogClose = document.querySelector("#playlist-dialog-close");
const playlistSongName = document.querySelector("#playlist-song-name");
const songFavorite = document.querySelector("#song-favorite");
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
let visibleSongs = [];
let playbackQueue = [];
let activeSongKey = null;
let pendingPlaylistSong = null;
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
  playlistSelect.innerHTML = `<option value="chart">Current chart</option><option value="favorites">Favorites (${Object.keys(favorites).length})</option>${customOptions}`;
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
    const isPlaying = key === activeSongKey && !player.paused;
    return `<article class="song"><div class="track-control"><button class="play" data-song-key="${key}" aria-label="${isPlaying ? "Pause" : "Play"} ${escapeHtml(song.title)} by ${escapeHtml(song.artist)}"><span aria-hidden="true">${isPlaying ? "❚❚" : "▶"}</span></button><span class="rank">#${song.rank} · ${song.year}</span></div><div class="track-details"><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(song.artist)}</span></div><button class="song-menu" data-song-key="${key}" aria-label="Options for ${escapeHtml(song.title)}" title="Song options">•••</button></article>`;
  }).join("");
  if (!visibleSongs.length) songs.innerHTML = "<p>No songs match this playlist and filter.</p>";
}

async function loadChart() {
  status.textContent = `Loading ${year.value}…`;
  songs.innerHTML = "";
  try {
    const response = await fetch(`/api/chart?year=${encodeURIComponent(year.value)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    chart = data.songs.map((song) => ({ ...song, year: Number(year.value) }));
    playlistSelect.value = "chart";
    status.textContent = `${chart.length} songs from ${year.value}`;
    render();
  } catch (error) { status.textContent = error.message; }
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

function savePlaybackSettings() {
  saveStoredValue(playbackStorageKey, { repeat: repeatMode });
  renderPlaybackControls();
}

function updateSongOptions() {
  if (!pendingPlaylistSong) return;
  const starred = Boolean(favorites[songKey(pendingPlaylistSong)]);
  songFavorite.textContent = starred ? "★ Remove from favorites" : "☆ Add to favorites";
  songFavorite.setAttribute("aria-pressed", String(starred));
  const inCustomPlaylist = playlistSelect.value.startsWith("custom:");
  playlistRemove.hidden = !inCustomPlaylist;
  const hasCustomPlaylists = Boolean(playlistTarget.options.length);
  playlistAddOptions.hidden = false;
  playlistTarget.disabled = !hasCustomPlaylists;
  playlistEmptyHint.hidden = hasCustomPlaylists;
}

load.addEventListener("click", loadChart);
year.addEventListener("change", loadChart);
filter.addEventListener("input", render);
favoritesOnly.addEventListener("change", render);
favoriteStatsOpen.addEventListener("click", () => favoriteStatsDialog.showModal());
favoriteStatsClose.addEventListener("click", () => favoriteStatsDialog.close());
playlistDialogClose.addEventListener("click", () => playlistDialog.close());

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

playlistNew.addEventListener("click", () => {
  const name = playlistName.value.trim();
  if (!name) {
    status.textContent = "Enter a name for the new playlist.";
    playlistName.focus();
    return;
  }
  const id = globalThis.crypto?.randomUUID?.() || String(Date.now());
  playlists[id] = { name, songs: [] };
  saveStoredValue(playlistsStorageKey, playlists);
  playlistName.value = "";
  renderPlaylists(`custom:${id}`);
  status.textContent = `Created ${name}.`;
  render();
});
playlistName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") playlistNew.click();
});

playlistDelete.addEventListener("click", () => {
  if (!playlistSelect.value.startsWith("custom:")) return;
  const id = playlistSelect.value.slice(7);
  if (!confirm(`Delete the playlist “${playlists[id].name}”?`)) return;
  delete playlists[id];
  saveStoredValue(playlistsStorageKey, playlists);
  renderPlaylists("chart");
  render();
});

playlistSave.addEventListener("click", () => {
  const target = playlists[playlistTarget.value];
  if (!target || !pendingPlaylistSong) return;
  if (!target.songs.some((song) => songKey(song) === songKey(pendingPlaylistSong))) target.songs.push(pendingPlaylistSong);
  saveStoredValue(playlistsStorageKey, playlists);
  status.textContent = `Added ${pendingPlaylistSong.title} to ${target.name}.`;
  playlistDialog.close();
  render();
});

songFavorite.addEventListener("click", () => {
  if (!pendingPlaylistSong) return;
  const key = songKey(pendingPlaylistSong);
  if (favorites[key]) delete favorites[key];
  else favorites[key] = pendingPlaylistSong;
  saveStoredValue(favoritesStorageKey, favorites);
  status.textContent = favorites[key] ? `Added ${pendingPlaylistSong.title} to Favorites.` : `Removed ${pendingPlaylistSong.title} from Favorites.`;
  updateSongOptions();
  render();
});

playlistRemove.addEventListener("click", () => {
  if (!pendingPlaylistSong || !playlistSelect.value.startsWith("custom:")) return;
  const id = playlistSelect.value.slice(7);
  playlists[id].songs = playlists[id].songs.filter((song) => songKey(song) !== songKey(pendingPlaylistSong));
  saveStoredValue(playlistsStorageKey, playlists);
  status.textContent = `Removed ${pendingPlaylistSong.title} from ${playlists[id].name}.`;
  playlistDialog.close();
  render();
});

songs.addEventListener("click", (event) => {
  const song = findVisibleSong(event.target.closest("[data-song-key]")?.dataset.songKey);
  if (!song) return;

  if (event.target.closest(".song-menu")) {
    pendingPlaylistSong = song;
    playlistSongName.textContent = `${song.title} — ${song.artist}`;
    renderPlaylists();
    updateSongOptions();
    playlistDialog.showModal();
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

repeatButton.addEventListener("click", () => {
  repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
  savePlaybackSettings();
});
previousButton.addEventListener("click", () => moveInQueue(-1));
nextButton.addEventListener("click", () => moveInQueue(1));
player.addEventListener("play", render);
player.addEventListener("pause", render);
player.addEventListener("ended", () => moveInQueue(1, true));
player.addEventListener("error", () => { status.textContent = "This source could not be played. Try skipping to the next song."; });

renderPlaylists("chart");
renderPlaybackControls();
loadChart();
