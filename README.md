# Year-End Radio

This small local web app loads Billboard year-end Hot 100 lists (1999 and 2000 work through the year field) and lets you request playback through `yt-dlp`.

## Run it

1. Install the two local tools once on macOS:

   ```sh
   brew install yt-dlp ffmpeg
   ```

2. From this folder, start the app:

   ```sh
   npm start
   ```

3. Open http://localhost:4173.

`yt-dlp` stays on your machine. The app does not download or store tracks; it resolves a selected public audio source and lets your browser play it directly, so the player scrubber can seek normally. Only use playback for sources you are authorized to access, and note that individual source availability can change.

## Favorites

Select the star next to a song to save it. Each saved favorite records its year, Billboard rank, title, and artist in this browser's local storage, so it stays starred after a refresh or server restart. Use **Favorites only** to narrow the currently loaded year to its saved songs.

## Development commands

```sh
npm run check  # Checks the Node server and browser JavaScript for syntax errors.
npm start      # Runs the local server.
```

## How it works

- `server.mjs` is the tiny local API. It reads a Wikipedia year-end chart page and asks `yt-dlp` for a seekable media URL only after you click Play.
- `public/app.js` renders the list and connects a click to the local audio endpoint.
- `public/app.js` also saves favorites in the browser through `localStorage`; no account or server database is needed.
- `public/styles.css` handles the responsive layout.

### Small exercise

Change the default year in `public/index.html` from `1999` to `2000`, then restart the app and notice that the same JavaScript uses that new initial value.
