---
description: "Use when editing src/scripts content scripts or feature modules: YouTube DOM injection, playlist parsing, MutationObservers, SPA navigation, theming, and duration calculations."
applyTo: "src/scripts/**"
---

# YouTube Content Script Rules

## Runtime model

- `content.ts` is the only top-level content script. It starts observers and loads
  feature modules with:
  ```ts
  const { updateDurationPlaying: update } = await import(
      chrome.runtime.getURL('scripts/duration-playing.js')
  );
  ```
- `duration-playing.ts`, `duration-playlist.ts`, and `utils.ts` are ESM modules copied
  to `dist/scripts/` by `viteStaticCopy`. A new runtime module needs entries in both
  `viteStaticCopy` and `web_accessible_resources` — see
  [build-pipeline.instructions.md](build-pipeline.instructions.md).
- Top-level scripts with no exports start with `export {}`.

## SPA lifecycle

- YouTube never reloads the page; use `MutationObserver`, not `load`.
- `content.ts` observes `#page-manager` for the playlist containers, then starts
  page-specific observers.
- Initial calls plus `setTimeout` retries (1000 ms / 3000 ms) cover slow layout.
  Cancel pending retries when the observer fires.
- `playingObserverStarted` / `playlistObserverStarted` currently never reset on SPA
  navigation (`AUDIT.md` B-04). If you touch lifecycle code, reset state on navigation
  and disconnect observers for the page that is no longer active.
- `duration-playlist.ts` keeps a module-level `resizeObserver` for layout switches
  (side panel ↔ top header) and never disconnects it (B-08). Add cleanup if you
  modify it.

## DOM selection

- Guard every query; no `!` non-null assertions (ESLint errors).
- Header anchors on the standalone playlist page can have hidden duplicate copies.
  Use `findRendered()` (first node with a non-zero `getBoundingClientRect()`), not
  bare `querySelector()`.
- Standalone playlist anchor order:
  1. `yt-description-preview-view-model` → `afterend`
  2. `ytd-playlist-sidebar-primary-info-renderer #play-buttons` → `afterend`
  3. `#page-manager [page-subtype="playlist"] .metadata-action-bar` → `afterend`
  4. `ytd-browse[page-subtype="playlist"] yt-page-header-view-model` → `afterend`
- Standalone playlist list: `findPlaylistList()` tries, in order:
  1. `ytd-browse[page-subtype="playlist"] ytd-two-column-browse-results-renderer #primary #contents`
  2. `#page-manager [page-subtype="playlist"] #contents #contents #contents`

  The nested `#contents #contents #contents` chain no longer exists on current
  playlist pages — do not reintroduce it as the only selector.
- Playlist rows have two shapes. Current pages use `yt-lockup-view-model` with the
  duration inside `yt-thumbnail-badge-view-model`; older layouts use
  `ytd-playlist-video-renderer` (or `.metadata-action-bar` layouts) with `#text`.
  `getDurationText()` checks `#text` first, then the badge, and validates against
  `^\d{1,2}:\d{2}(:\d{2})?$` so labels like "LIVE" or "4K" are ignored.
- Watch panel on the watch page: `#page-manager > ytd-watch-flexy #playlist #items`.
- Video runtime is `#text` (legacy) or the time-formatted thumbnail badge
  (current); missing/unparseable → `00:00`.
- The current video is marked by `#index` text `▶`. The current implementation puts
  it in `remainingList` (`AUDIT.md` B-05); preserve or fix deliberately.
- Inject the UI once: check `document.getElementById('duration-block-*')` first.
- Keep selectors in sync between `content.ts` and the feature module that uses them.

## Theming

- `checkTheme()` returns `'dark' | 'light'` by testing
  `document.querySelector('[dark]')`.
- Set the theme as an empty attribute: `el.setAttribute(theme, '')`.
- On updates, remove the opposite attribute and set the current one for every styled
  element (the code keeps an ID list).
- The standalone playlist header is always on dark artwork; its text spans are
  hard-coded to `dark` regardless of page theme.
- CSS uses `[dark]` / `[light]` attribute selectors; do not switch to CSS custom
  properties without updating all injection code.

## Calculations and tests

- Keep pure logic in `utils.ts`: `timeListToSeconds`, `secondsToTs`,
  `calculateTotalTime`.
- `tests/utils.test.ts` covers these (25 tests, Node environment). DOM code has no
  test harness yet.
- Add tests for any new pure helper and run `npm run test`.
- Timestamp formats accepted: `MM:SS` and `HH:MM:SS`.

## Manual verification

```bash
npm run lint && npm run type-check && npm run test
npm run build:chrome
```

Reload the unpacked extension, then check:

- watch page with playlist panel (stats and bar update while playing/skipping)
- standalone playlist page (total + video count)
- dark and light themes
- SPA navigation: playlist → watch → another playlist
- window resize across the side-panel/top-header breakpoint
- Watch Later and Liked Videos layouts
