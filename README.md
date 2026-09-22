# Year-End Radio

Year-End Radio is a small local web app for exploring Billboard year-end Hot 100 charts and playing a selected track through your own `yt-dlp` installation.

Start with 1999 or 2000, or enter any year from 1958 through the current year. Starred songs, custom playlists, and repeat mode are saved by the server, so they follow you to every device that opens the same app.

## Features

- Load up to 100 songs from a Billboard year-end Hot 100 chart.
- Filter the current chart by title or artist.
- Use a compact far-left play/pause control; the active song displays a pause icon.
- Play a selected public audio source with local `yt-dlp`.
- See the current song’s artwork, title, and artist together in the fixed player, with a fallback when no thumbnail is available.
- Scrub within a track: the app redirects the browser to yt-dlp’s resolved media URL instead of piping a one-way stream.
- Prepare the next queue item in the background so skips and continuous playback start faster.
- Save shared favorites and narrow the current year with **Favorites only**.
- Play continuously through the visible songs by default.
- Start a no-duplicates shuffled queue from every song in the current view, then skip forward or back through that order.
- Cycle repeat through off, all, and one.
- Use the automatic **Favorites** playlist or create custom playlists that can contain songs from different chart years.
- Browse the automatic **Favorites** playlist by chart rank, from the lowest number upward.
- Browse roomier song cards in a three-column desktop grid; each card has a direct ☆ favorite button and a nearby **•••** playlist menu.
- Open **Your stats** to see your favorite year, calculated from all favorites in the shared library.

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
3. Select **Play** next to a song for chart order, or **Shuffle visible** to randomize and start every currently visible song.
4. Select ☆ to save a favorite; it changes to ★.
5. Choose **Favorites** from the Playlist menu to see every favorite across all chart years.
6. Name and create a custom playlist, then open a song’s **•••** menu to add or remove it from a playlist. Click **•••** again, press Escape, or click elsewhere to close the menu.
7. See the selected song’s artwork, title, and artist in the fixed player, then use its controls to go back, skip, or change repeat mode. Playback always continues automatically.

Favorites, custom playlists, and playback settings are stored in `data/library.json` on the server. Browsers keep a last-known local copy only as a fallback if the server cannot be reached. The app refreshes shared data whenever its window regains focus and every 30 seconds while visible.

Every browser using one Year-End Radio server shares the same library. The grow-server deployment is limited by Tailscale access rules; there is no separate account system inside the app.

The queue is a snapshot of the visible songs when playback begins. The selected playlist supplies the songs, then the search and **Favorites only** filters can narrow that temporary queue. **Shuffle visible** randomizes that snapshot once, so each song appears exactly once in the shuffled order. Changing playlists or filters after playback starts does not replace the active queue. Repeat has three modes: **off** stops at the end, **all** wraps to the beginning, and **one** replays the current track when it ends.

## Commands

```sh
npm start      # Start the local app at http://localhost:4173
npm run check  # Syntax-check the app and run storage, playback, and queue tests
```

Refresh the browser after changing client files in `public/`. Restart `npm start` after changing `server.mjs`.

To check the song controls after a client change, start the app, load a chart, and try ☆ and **•••** on the same row. The star should change immediately after the server saves it; the playlist menu should appear beside that row and close with Escape. Run `npm run check` for the project’s automated syntax and logic checks.

## Deployment

Pushes to `main` are deployed to grow-server after the syntax checks, tests, and production image build pass. The deployed app is private to the Tailscale network:

```text
https://year-end-radio.civet-nessie.ts.net
```

See [docs/deployment.md](docs/deployment.md) for the deployment flow, health checks, and grow-server maintenance commands.

## Project map

```text
year-end-radio/
├── server.mjs          # Local HTTP server, chart reader, and yt-dlp playback redirect
├── library-store.mjs   # Validated, atomic shared-library persistence
├── playback-source.mjs # Tested selection of the first playable media URL
├── package.json        # Start and syntax-check commands
├── Dockerfile          # Node 22 image with yt-dlp
├── compose.production.yml # Loopback-only grow-server service
├── docs/
│   └── deployment.md # CI/CD and server operations guide
├── deploy/
│   └── github-runner-year-end-radio.service # Dedicated CI runner service
├── public/
│   ├── index.html      # Page structure and controls
│   ├── app.js          # Chart loading, filtering, favorites, and player interaction
│   ├── player-state.js # Tested next/back/shuffle/repeat queue logic
│   ├── styles.css      # Responsive visual styling
│   └── favicon.svg     # App icon
├── test/
│   ├── library-store.test.js   # Shared storage and multi-device action tests
│   ├── playback-source.test.js # Playback URL selection tests
│   └── player-state.test.js    # Queue behavior tests
└── README.md
```

## How data and playback work

Chart data comes from Wikipedia pages named `Billboard Year-End Hot 100 singles of <year>`. This is a convenient public reference, not the official Billboard API; if Wikipedia changes a table layout, the parser in `server.mjs` may need an update.

When you choose Play, the local server asks yt-dlp for several matching public sources and uses the first one that produces a media URL. It separately asks yt-dlp for a thumbnail, so missing artwork cannot block audio. Searching a small fallback set prevents one restricted search result from blocking an otherwise playable song. After playback begins, the app resolves the next queue item in the background and caches that URL for 15 minutes. This removes most of the lookup delay without downloading the next song’s audio bytes.

Your browser plays the resolved URL directly, which enables pause and seeking. The app does not download or store music files. Availability varies by source; use yt-dlp and any selected source only for material you are allowed to access.

## Troubleshooting

### Play says yt-dlp is not installed

```sh
brew install yt-dlp
```

Restart the app after installing it.

### A song will not play

The app automatically tries a small set of search results, because an individual result can be restricted. If none are playable, retry later or update yt-dlp:

```sh
brew upgrade yt-dlp
```

### A chart will not load

Confirm the year is between 1958 and the current year, check your internet connection, and try again. A missing page or changed Wikipedia table layout will display an error in the app.

### Shared favorites will not update

Check `/api/library` on the same address as the app. If it is unavailable, the page uses that browser’s last-known copy and cannot save changes. On grow-server, confirm the Compose volume is mounted and inspect the app logs using the commands in `docs/deployment.md`.

## Small exercise

Run `curl -s http://localhost:4173/api/library` while the local server is running, favorite one song, and run it again. Look for the revision number increasing by one; this demonstrates how the browser and server coordinate each small library action.
