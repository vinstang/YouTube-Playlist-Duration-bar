# AGENTS.md — YouTube Playlist Duration Bar

Agent guidance for this repository. Edit this file directly; do not create a
`CLAUDE.md` alongside it.

Detailed area rules (read on demand):
- [Build pipeline](.github/instructions/build-pipeline.instructions.md)
- [YouTube content scripts](.github/instructions/youtube-content-scripts.instructions.md)

These are Copilot instruction files; OpenCode does not auto-load them, so read the
relevant one before changing `vite.config.ts`, the manifest, or content scripts.

## Hard rules

1. **Never commit, push, or create release tags without human approval.** Always ask.
2. **Never edit `dist/`** — generated output. Change `src/` or configs and rebuild.
3. Preserve the build-pipeline invariants below; breaking them produces an
   extension that loads but whose runtime `import()` fails.

## What this is

A Chrome/Firefox Manifest V3 extension that injects a duration/progress UI into
YouTube playlist pages (watch-page playlist panel and standalone playlist pages).
TypeScript + Vite + Vitest, one shared source manifest.

| Path | Role |
|------|------|
| `src/scripts/content.ts` | Only top-level content script; MutationObservers, init retries, SPA lifecycle |
| `src/scripts/duration-playing.ts` | ESM module; watch-page playlist panel UI |
| `src/scripts/duration-playlist.ts` | ESM module; standalone playlist page UI |
| `src/scripts/utils.ts` | Pure time math: `timeListToSeconds`, `secondsToTs`, `calculateTotalTime` |
| `src/scripts/background.ts` | Service worker; install/update badge + popup state |
| `src/scripts/popup.ts` + `src/html/popup.html` | Toolbar popup |

`tests/utils.test.ts` covers pure time math (25 tests, Node environment).
`tests/e2e/` is a local-only Playwright/Selenium browser harness; it is not run by
Vitest or CI.

## Commands

CI uses Node 24. If `node`/`npm` are missing in a non-interactive shell:
`export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"`.

| Command | Purpose |
|---------|---------|
| `npm ci` | Install (CI path) |
| `npm run dev` | `vite build --watch`; **does not** auto-launch a browser |
| `npm run build` | Production build, defaults to Chrome |
| `npm run build:chrome` / `build:firefox` | Explicit target |
| `npm run lint` | ESLint over `src/`, `tests/e2e/` (configs are ignored) |
| `npm run type-check` | `tsc --noEmit` over `src/`, `tests/`, configs |
| `npm run test` | All tests once |
| `npm run test -- tests/utils.test.ts` | One test file |
| `npm run e2e:chrome` / `e2e:firefox` | Local browser audit; builds the target first |
| `npm run e2e:login:chrome` / `e2e:login:firefox` | One-time YouTube login for the harness |
| `npm run lint:fix` / `npm run test:watch` | Auto-fix / watch |

Verify before finishing: `npm run lint && npm run type-check && npm run test`.
Add `npm run build:chrome` (and `build:firefox` if you touched manifest
transforms), then inspect `dist/manifest.json`.

**Load locally:** build → `chrome://extensions` → Developer mode → "Load unpacked"
→ select `dist/` → reload the extension and refresh open YouTube tabs. Each build
empties `dist/`, so a Firefox build replaces the Chrome build — rebuild the target
you want last.

## Browser verification (Chrome + Firefox)

Local only; requires real browsers and a one-time YouTube login. Not part of CI.

- Chrome: `npm run e2e:login:chrome`, then `npm run e2e:chrome`.
- Firefox: `npm run e2e:login:firefox` (normal Firefox; close it after signing in),
  then `npm run e2e:firefox`.
- Profiles, the Firefox build, and screenshots live in `.e2e/` (gitignored).
- Firefox login **must** happen outside Selenium — Google rejects automated sign-in.
- Test both themes with `--theme=light` and `--theme=dark`; the previous profile
  theme is restored unless `--keep-theme` is passed.
- Flags are `COUNT`, `TOTAL`, `THEME`, `COLOR`, `PROGRESS`; open failure screenshots
  under `.e2e/artifacts/<engine>/`.

Details: [`tests/e2e/README.md`](tests/e2e/README.md). The
`browser-extension-testing` skill wraps the workflow for agents.

## Build pipeline invariants

`vite-plugin-web-extension` bundles every manifest entry as **IIFE**, which strips
`export`. Runtime-imported modules must be emitted separately as **ESM**.

- Source `manifest.json` must **not** contain `web_accessible_resources`.
  `transformManifest` in `vite.config.ts` injects it; if present in the source, the
  plugin treats those paths as Rollup inputs and bundles them as IIFE.
- `utils.ts`, `duration-playing.ts`, `duration-playlist.ts` are each compiled to ESM
  by `viteStaticCopy` (`transformWithEsbuild`, `format: 'esm'`) into
  `dist/scripts/*.js`.
- A new runtime module needs **three** registrations: a `viteStaticCopy` target, a
  `scripts/<name>.js` entry in `transformManifest`'s WAR resources, and a load via
  `chrome.runtime.getURL('scripts/<name>.js')`. Never add it to manifest entry
  points.
- Source imports use `.js` specifiers (`from './utils.js'`); esbuild compiles files
  individually and does not rewrite import paths.
- Manifest source paths are `src/scripts/*.ts`; the plugin rewrites them to `.js`.
  Top-level scripts (`content.ts`, `background.ts`, `popup.ts`) get no ESM exports —
  start them with `export {}`.
- `package.json` and `manifest.json` both say version `0.0.0`. The build injects
  `package.json`'s version; `release.yml` syncs it from the git tag. Never bump
  `manifest.json` by hand.
- Firefox (`TARGET=firefox`) rewrites `background.service_worker` to
  `background.scripts` and adds `browser_specific_settings.gecko`. Keep
  `data_collection_permissions.required: ['none']` — AMO requires it and the
  extension transmits nothing.
- `viteStaticCopy` ships only `icons/icon-{16,32,48,128}.{png,xcf}`.
  `icons/icon-1024.png` is a ~4 MB store asset; do not add it to the build.

## Adding code

1. Pure calculations → `src/scripts/utils.ts` + a Vitest case in `tests/`.
2. New runtime ESM module → follow the three-registration rule above.
3. New top-level content script → add to `manifest.json` `content_scripts[].js`
   with no ESM exports.
4. New permission → edit `manifest.json`; optional ones must go in
   `optional_host_permissions` to be requestable.
5. UI change → use `[dark]`/`[light]` attribute theming, unique IDs, and verify
   both playlist views in both themes plus SPA navigation and resize.

## YouTube DOM realities

- YouTube is an SPA: use `MutationObserver`, never `load`. `content.ts` watches
  `#page-manager`, then starts page-specific observers. Initial calls plus 1 s / 3 s
  retries cover slow layout; retries are cancelled when the observer fires.
- The current video in the watch panel is marked by `#index` text `▶`.
- Watch panel: `#page-manager > ytd-watch-flexy #playlist #items`;
  header anchor: `#page-manager > ytd-watch-flexy #playlist #header-contents`.
- Standalone playlist list (`findPlaylistList()` tries in order):
  1. `ytd-browse[page-subtype="playlist"] ytd-two-column-browse-results-renderer #primary #contents`
  2. `#page-manager [page-subtype="playlist"] #contents #contents #contents`
- Standalone header anchors (`appendUiElement()` order): `yt-description-preview-view-model`
  → `ytd-playlist-sidebar-primary-info-renderer #play-buttons` →
  `#page-manager [page-subtype="playlist"] .metadata-action-bar` →
  `ytd-browse[page-subtype="playlist"] yt-page-header-view-model` (all `afterend`).
- YouTube renders hidden duplicate header copies. Use `findRendered()` (first node
  with a non-zero bounding rect), never bare `querySelector()`, for these anchors.
- Playlist rows have two shapes: current `yt-lockup-view-model` with the runtime in
  `yt-thumbnail-badge-view-model`; legacy `ytd-playlist-video-renderer` with `#text`.
  `getDurationText()` checks `#text`, then the badge, validates `MM:SS`/`HH:MM:SS`,
  and falls back to `00:00` so "LIVE"/"4K" are ignored. Keep both paths.
- Selectors are duplicated across `content.ts` and the feature modules; update all
  copies together.
- Theme: `checkTheme()` tests `document.querySelector('[dark]')`; apply theme as an
  empty attribute (`el.setAttribute(theme, '')`) and remove the opposite one on each
  update. The standalone playlist header sits on artwork, so its text spans are
  hard-coded `dark`.

## Conventions that differ from defaults

- 4-space indent, single quotes, `const` arrow functions, no `var`.
- `any` and `!` non-null assertions are ESLint errors; use `unknown` + narrowing and
  guard every DOM query.
- Logs are gated behind `DEBUG = import.meta.env.DEV` (stripped from production
  builds) and use `START :: ...` / `END :: ...` prefixes.
- Pure logic belongs in `utils.ts` so it stays unit-testable.

## Known issues (verified 2026-10-22)

`AUDIT.md` is a 2026-03-12 snapshot; re-verify in a browser before acting on it.

- **SPA lifecycle:** `playingObserverStarted` / `playlistObserverStarted` in
  `content.ts` never reset, and the `#page-manager` observer disconnects once both
  are true — later playlist views can stop updating (B-04).
- **Popup grant UI is dead:** `*://www.youtube.com/*` is in `host_permissions`, so
  `chrome.permissions.contains()` is always true and the button is always disabled
  (B-02/D-01).
- **Current-video accounting:** the `▶` row goes into `remainingList` (B-05).
- **Resize observer leak:** `duration-playlist.ts` observes `document.documentElement`
  and never disconnects (B-08).
- **Config cruft:** `lint` still passes a nonexistent `scripts` path, `eslint.config.js`
  keeps a `scripts/**/*.js` block, and Vitest sets `globals: true` while tests import
  its APIs explicitly (C-06).

## Git and releases

- Branches: `main` (releases), `dev` (active work), `feature/<slug>` / `fix/<slug>`
  off `dev`.
- Commits: `<TYPE>: <imperative summary>` with `FIX`, `ADD`, `UPDATE`, `REMOVE`,
  `REFACTOR`, `DOCS`, `CI`, `TEST`. Keep them atomic.
- Never commit `node_modules/`, `dist/`, `*.zip`, `*.crx`, or `*.xpi`.
- Release: add the `## [x.y.z] - YYYY-MM-DD` section to `CHANGELOG.md` first (the
  workflow extracts it as the release body), then push a `vX.Y.Z` tag. `release.yml`
  runs lint/type-check/tests, syncs the version, builds and zips both browsers.
  **Ask the human before tagging.**
