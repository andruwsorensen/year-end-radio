# Year-End Radio

Year-End Radio is a small local web app for exploring Billboard year-end Hot 100 charts and playing a selected track through your own `yt-dlp` installation.

Start with 1999 or 2000, or enter any year from 1958 through the current year. Starred songs stay saved in your browser with their chart year and rank.

## Features

- Load up to 100 songs from a Billboard year-end Hot 100 chart.
- Filter the current chart by title or artist.
- Play a selected public audio source with local `yt-dlp`.
- Scrub within a track: the app redirects the browser to yt-dlp’s resolved media URL instead of piping a one-way stream.
- Save favorites locally and narrow the current year with **Favorites only**.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer. This project has no npm dependencies, so there is no `npm install` step.
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) available in your terminal path.
- Internet access for chart lookup and playback.

On macOS with Homebrew:

```sh
brew install yt-dlp
yt-dlp --version
```

## Run it

From this folder:

```sh
npm start
```

Open [http://localhost:4173](http://localhost:4173). To stop the server, press `Control-C` in the terminal where it is running.

## Use it

1. Enter a year and select **Load top 100**.
2. Filter by title or artist if needed.
3. Select **Play** next to a song.
4. Select ☆ to save a favorite; it changes to ★.
5. Turn on **Favorites only** to see saved songs from the loaded year.

Favorites are stored in this browser’s local storage. They survive refreshes and server restarts, but will not transfer to another browser profile, computer, or after clearing browser site data.

## Commands

```sh
npm start      # Start the local app at http://localhost:4173
npm run check  # Syntax-check server.mjs and public/app.js
```

Refresh the browser after changing client files in `public/`. Restart `npm start` after changing `server.mjs`.

## Project map

```text
year-end-radio/
├── server.mjs          # Local HTTP server, chart reader, and yt-dlp playback redirect
├── package.json        # Start and syntax-check commands
├── public/
│   ├── index.html      # Page structure and controls
│   ├── app.js          # Chart loading, filtering, favorites, and player interaction
│   ├── styles.css      # Responsive visual styling
│   └── favicon.svg     # App icon
└── README.md
```

## How data and playback work

Chart data comes from Wikipedia pages named `Billboard Year-End Hot 100 singles of <year>`. This is a convenient public reference, not the official Billboard API; if Wikipedia changes a table layout, the parser in `server.mjs` may need an update.

When you choose Play, the local server asks yt-dlp to find a matching public audio source and resolve a current media URL. Your browser then plays that URL directly, which enables pause and seeking. The app does not download or store music files. Availability varies by source; use yt-dlp and any selected source only for material you are allowed to access.

## Troubleshooting

### Play says yt-dlp is not installed

```sh
brew install yt-dlp
```

Restart the app after installing it.

### A song will not play

The source search may not find a playable match. Try another song, retry later, or update yt-dlp:

```sh
brew upgrade yt-dlp
```

### A chart will not load

Confirm the year is between 1958 and the current year, check your internet connection, and try again. A missing page or changed Wikipedia table layout will display an error in the app.

### Favorites disappeared

They are stored in browser-local storage. Clearing site data or using another browser profile creates a separate favorites collection.

## Small exercise

Open `public/app.js` and find `favoriteKey`. It currently creates an ID such as `1999:1` from the year and Billboard rank. Add the song title to that key, then star a song and inspect the saved data in your browser’s developer tools.
