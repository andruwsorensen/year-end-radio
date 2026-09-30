// Keep spreadsheet cells as text when a song title or artist starts like a formula.
function csvCell(value) {
  const text = String(value);
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

// Export the whole saved library, in the same order as the Favorites playlist.
export function favoritesCsv(favorites) {
  const songs = Object.values(favorites).sort((first, second) => first.rank - second.rank || first.title.localeCompare(second.title));
  const rows = songs.map(({ year, rank, title, artist }) => [year, rank, title, artist].map(csvCell).join(","));
  return ["year,rank,title,artist", ...rows].join("\r\n") + "\r\n";
}
