# Code Audit — Current Open Items

> Reviewed 2026-10-29 against the `v1.0.0` release candidate.
> Browser checks: Chrome and Firefox, light and dark themes; 20/20 e2e checks passed in each matrix run.

## Open runtime items

No confirmed runtime bugs are currently tracked.

## Playback-time behavior

- **Implemented:** the current `▶` video is split at `video.currentTime`; elapsed time counts as watched and the unplayed portion remains remaining. Counters refresh once per second and on seek, pause, end, and video/observer changes. Seeking forward counts skipped time as watched; seeking backward reduces watched time. Tracking only ranges actually played is out of scope. Unit tests and the four-way browser/theme matrix pass (20/20 each); Firefox watch checks explicitly start muted playback and verify the playhead advances.

### Deferred Part 2 — Playback-speed changes

Ensure counters follow `video.playbackRate`: faster playback advances watched time
faster in wall-clock time; slower playback advances it more slowly. Handle
`ratechange` promptly and verify at normal, faster, and slower speeds.

## Data caveat

- YouTube may hide unavailable videos or lazily load long playlists. The extension counts rendered rows, so its count can differ from YouTube's header count.

## Verified resolved

- **B-01 (reload YouTube tabs):** the missing `tabs` permission is not a defect for the current target URLs. In a live Chrome test, `chrome.tabs.query({ url: '*://www.youtube.com/*' })` returned the open YouTube tab with `tabs` permission absent and the required YouTube host permission present.
- **B-02 / D-01:** YouTube is a required host permission, so no grant prompt is needed; the unreachable popup control has been removed.
- **B-03:** watch-panel theme is read per update from `document.documentElement.hasAttribute('dark')`.
- **B-04:** `content.ts` now reconciles page-specific observers against current DOM targets and disconnects observers/retries for replaced or removed targets. Verified direct navigation between owned playlists through YouTube's SPA hub without reloading, plus switching to the second and third watch-panel rows, in Chrome and Firefox, light and dark themes.
- **B-06:** video count derives from actual row list length.
- **B-08:** the playlist resize observer disconnects when the playlist observer stops or changes target, and restarts when the playlist view becomes active.
- **D-01:** removed the dead popup permission grant control; the required YouTube host permission already grants access.
- **Playlist row discovery (fixed in v0.8.3):** standalone pages collect top-level lockup/legacy video rows and exclude wrapper/continuation nodes. In both browsers, Watch Later showed 7/7 loaded rows (`16:48:56`), the six-video owned playlist showed 6/6 (`1:37:08`), the empty playlist showed 0, and the 826-video playlist counted 100/100 loaded rows (YouTube loads only a subset). The 100-video and 15-video public controls also matched their rendered rows.
- **Light-theme SPA text (fixed in v0.8.3):** watch-panel theme detection no longer matches arbitrary dark descendants. Verified in light and dark modes in Chrome and Firefox.
- **C-02:** repository package and source manifest stay at `0.0.0`; release workflow injects the tag version.
- **C-05:** Vite sourcemap selection now uses the config `mode` instead of `NODE_ENV`.
- **C-06:** Vitest globals are disabled; tests use explicit imports.
- **C-07:** Firefox output uses `background.scripts: ['src/scripts/background.js']`; this is the generated JavaScript path and was verified in the Firefox build manifest.
- **C-08:** Firefox declares `data_collection_permissions.required: ['none']`.
- **C-09:** lint targets only existing source/test paths, and the obsolete `scripts/**/*.js` ESLint block is removed.

## Historical cleanup

- R-02, R-04, R-05, D-03, and G-02 from the 2026-03 audit are resolved; their original reports are not repeated here.
- The standalone playlist header block and its text are intentionally hard-coded `dark` because they sit on dark artwork in either YouTube theme.
