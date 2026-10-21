# AGENTS.md — YouTube Playlist Duration bar

Agent guidance for this repository. Always edit this file directly; do not create a
`CLAUDE.md` alongside it.

---

## Rules for generative AI

1. **Do not** commit, push, or create release tags without human approval. Always ask.
2. **Never edit `dist/`** — it is generated output. Change `src/` or configs and rebuild.
3. Preserve the build-pipeline invariants below; they are required for the extension
   to load and for runtime `import()` to work.

---

## Project Overview

A Chrome/Firefox Manifest V3 extension that injects a progress bar and duration stats
into YouTube playlist pages. The codebase is fully TypeScript, bundled with Vite, and
tested with Vitest. Latest changelog entry: **v0.8.1**.

**Docs:**
- [`README.md`](README.md) — user-facing features, screenshots, install links
- [`CHANGELOG.md`](CHANGELOG.md) — release notes; the release workflow extracts from here
- [`AUDIT.md`](AUDIT.md) — pre-release audit snapshot (2026-03-12); re-verify items before acting

**Entry points:**

| File | Role |
|------|------|
| `src/scripts/content.ts` | Content script on every YouTube page; owns MutationObservers, init retries, SPA lifecycle |
| `src/scripts/background.ts` | Service worker; install/update badge and popup state |
| `src/scripts/duration-playing.ts` | ESM module; "now playing" playlist panel UI and stats |
| `src/scripts/duration-playlist.ts` | ESM module; standalone playlist page UI and stats |
| `src/scripts/utils.ts` | Pure time helpers: `timeListToSeconds`, `secondsToTs`, `calculateTotalTime` |
| `src/scripts/popup.ts` + `src/html/popup.html` | Toolbar popup |

---

## Repository Structure

```
src/scripts/           TypeScript entry points and ESM feature modules
src/css/               common.css + one stylesheet per feature
src/html/              popup.html
tests/                 Vitest tests (tests/utils.test.ts — 25 tests)
icons/                 Shipped icons + GIMP .xcf originals
manifest.json          Source manifest; paths point at src/*.ts and are rewritten at build
vite.config.ts         Build pipeline: manifest transform + ESM static copy
dist/                  Generated output — gitignored, loaded as unpacked extension
.github/workflows/     ci.yml, build.yml, release.yml
```

---

## Build / Lint / Test Commands

> **Node:** CI uses Node 24. If `node`/`npm` are missing in a non-interactive shell,
> load nvm first:
> `export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" &&`

| Command | Purpose |
|---------|---------|
| `npm run dev` | Build in watch mode |
| `npm run build` | Production build (defaults to Chrome) |
| `npm run build:chrome` | Chrome production build |
| `npm run build:firefox` | Firefox production build |
| `npm run lint` | ESLint over `src/` |
| `npm run lint:fix` | Auto-fix ESLint violations |
| `npm run test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test -- tests/utils.test.ts` | Run one test file |
| `npm run type-check` | `tsc --noEmit` |

**Verify before finishing any change:**

```bash
npm run lint && npm run type-check && npm run test
```

For UI or build changes, also run `npm run build:chrome` (and `npm run build:firefox`
when touching the manifest transform) and confirm `dist/manifest.json` is correct.

**Load locally:** `npm run build:chrome` → `chrome://extensions` → enable Developer
mode → "Load unpacked" → select `dist/`. After rebuilding, reload the extension and
refresh open YouTube tabs.

> There is no Playwright/e2e suite yet. `@playwright/test` and `playwright` are
> installed but only `tests/utils.test.ts` exists.

---

## Build Pipeline Invariants

The build is non-standard because `vite-plugin-web-extension` bundles every
manifest-referenced script as IIFE, which strips `export`. Modules imported at
runtime via dynamic `import()` must instead be emitted as ESM.

- `manifest.json` intentionally **omits** `web_accessible_resources`. It is injected
  by `transformManifest` in `vite.config.ts`. Do not add WAR to the source manifest —
  the plugin would treat those paths as Rollup inputs and bundle them as IIFE.
- `utils.ts`, `duration-playing.ts`, and `duration-playlist.ts` are compiled
  individually to ESM by `viteStaticCopy` → `dist/scripts/*.js`.
- Source imports use `.js` specifiers (`import { ... } from './utils.js'`) because the
  esbuild transform does not rewrite import paths.
- Source manifest paths look like `src/scripts/content.ts`; the plugin rewrites them
  to `src/scripts/content.js` in `dist/manifest.json`.
- `manifest.json` and `package.json` both carry version `0.0.0`. `transformManifest`
  sets the output version from `package.json`, and `release.yml` runs
  `npm version <tag>` before building. Do not bump `manifest.json` by hand.
- Firefox (`TARGET=firefox`) replaces `background.service_worker` with
  `background.scripts` and adds `browser_specific_settings.gecko.id`. There is no
  separate Firefox manifest.
- `viteStaticCopy` copies `icons/*` as-is, including `.xcf` source files.

Detailed rules: [`.github/instructions/build-pipeline.instructions.md`](.github/instructions/build-pipeline.instructions.md).

---

## Adding a New Feature

1. **Pure logic** → put it in `src/scripts/utils.ts` (or a new pure module) and add
   Vitest coverage in `tests/`.
2. **New ESM runtime module** → create `src/scripts/<name>.ts`, import it with `.js`
   specifiers, add it to `viteStaticCopy` targets **and** the WAR resources list in
   `transformManifest`, then load it from `content.ts` via
   `chrome.runtime.getURL('scripts/<name>.js')`.
3. **New top-level content script** → add it to `manifest.json`
   `content_scripts[].js`; do not use ESM exports in it (it will be bundled as IIFE).
4. **New permission or manifest field** → edit `manifest.json`; both browsers share
   it unless `transformManifest` says otherwise. Optional permissions must go in
   `optional_host_permissions` to be requestable (see AUDIT B-02).
5. **UI change** → use the existing `[dark]`/`[light]` attribute theming and unique
   IDs; verify on both playlist views in both themes.
6. **Before completing** → run lint, type-check, tests; build and manually verify SPA
   navigation, theme switching, and window resize.

---

## Language: TypeScript

- **All code lives in `src/` as `.ts`** — do not add `.js` files to `src/`
- `tsconfig.json` uses `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`
- Prefer explicit return types on exported functions
- Use `interface` for object shapes; `type` for unions/aliases/utility types
- Avoid `any` (ESLint errors) — use `unknown` and narrow
- Use `as` only when the DOM guarantees the type, e.g.
  `document.getElementById('x') as HTMLDivElement`
- Top-level scripts with no exports start with `export {}` so TypeScript treats them
  as modules
- Runtime-imported modules use `.js` import specifiers (`./utils.js`)

---

## Code Style

### Variables and Functions
- `const` arrow functions for declarations: `const myFunc = () => { ... }`
- `let` for mutable values; **never `var`**
- Destructure multi-value returns: `return { watchedList, remainingList }`

### Formatting
- **4-space indentation** (no tabs)
- Single quotes; double quotes only inside HTML attribute strings
- Opening braces on the same line
- One blank line between top-level declarations

### Naming
- **Files:** `kebab-case` — `duration-playing.ts`
- **Functions/variables:** `camelCase` — `updateDurationPlaying`, `totalSeconds`
- **Interfaces:** plain `PascalCase` — `VideoTimeResult`, `DurationState`
- **CSS classes/IDs:** `kebab-case` — `.duration-block`, `#duration-block-playing`
- **Boolean flags:** verb-prefixed — `playingObserverStarted`, `isWatched`
- Avoid abbreviations except established ones: `ts` (timestamp), `el` (element)

### Imports
- Static `import` at the top of modules
- Group: browser APIs → third-party → internal (blank line between groups)
- Content scripts load feature modules with dynamic `import()` via
  `chrome.runtime.getURL()` — preserve this pattern in compiled output

---

## Error Handling

DOM code is defensive but not uniform: many queries are guarded, while some assume
YouTube markup exists. When adding or changing code:

- Guard every DOM query before using it:
  ```ts
  const el = document.querySelector<HTMLElement>('#some-selector');
  if (!el) return;
  ```
- Never use `!` non-null assertions (ESLint errors)
- Prefer early returns over deep nesting
- Reserve `try/catch` for async/browser-API calls (e.g. `chrome.action.openPopup()`),
  where graceful degradation is expected

---

## DOM and Browser Extension Patterns

- React to YouTube's SPA navigation with `MutationObserver`, never `load` events
- Disconnect observers when done. Keep long-lived observers only while their target
  page is active.
- Use `chrome.runtime.getURL()` for resource paths from content scripts
- Any module loaded via runtime `import()` must be in `web_accessible_resources` and
  emitted as ESM (see Build Pipeline Invariants)
- Theme detection (preserve this):
  ```ts
  const checkTheme = (): 'dark' | 'light' =>
      document.querySelector('[dark]') ? 'dark' : 'light';
  ```
- Apply theme as an empty attribute for CSS targeting:
  ```ts
  element.setAttribute(theme, '');  // 'dark' or 'light'
  ```
- Keep theme attributes in sync on every update; YouTube can change theme mid-session
- `[dark]` / `[light]` attribute selectors are the theming mechanism. Do not replace
  them with CSS custom properties without updating all injection code.
- The playlist page header sits on artwork and stays dark even in light mode: the
  total/count spans are hard-coded to `dark`.
- YouTube renders duplicate hidden copies of header elements. For playlist header
  anchors, use `findRendered()` in `duration-playlist.ts` (first element with a
  non-zero bounding rect), not bare `querySelector()`.
- The current video in the playlist panel is marked by `#index` text `▶`.
- Selectors are shared across files. If YouTube changes one, update both
  `content.ts` and the feature module that uses it:

  ```text
  #page-manager > ytd-watch-flexy #playlist #items
  #page-manager > ytd-watch-flexy #playlist #header-contents
  ytd-browse[page-subtype="playlist"] ytd-two-column-browse-results-renderer #primary #contents
  #page-manager [page-subtype="playlist"] #contents #contents #contents
  yt-description-preview-view-model
  ytd-playlist-sidebar-primary-info-renderer #play-buttons
  #page-manager [page-subtype="playlist"] .metadata-action-bar
  ytd-browse[page-subtype="playlist"] yt-page-header-view-model
  ```

- Standalone playlist rows changed shape. Current pages render items as
  `yt-lockup-view-model` with the duration in `yt-thumbnail-badge-view-model`;
  older layouts use `ytd-playlist-video-renderer` with the duration in `#text`.
  `findPlaylistList()` and `getDurationText()` handle both — keep the fallbacks.
- Video runtime comes from `#text` (legacy) or the time-formatted thumbnail badge
  (current); empty/missing/unparseable → `00:00`
- Extract pure calculations into `utils.ts` so they can be unit-tested

Detailed rules: [`.github/instructions/youtube-content-scripts.instructions.md`](.github/instructions/youtube-content-scripts.instructions.md).

---

## CSS

- Attribute selectors for theming: `[dark] { ... }` / `[light] { ... }`
- Use `rgba()` colors to stay compatible with YouTube overlays
- `common.css` holds shared styles; add feature styles to the feature stylesheet
- `kebab-case` for class names and IDs
- Avoid CSS custom properties unless adding full theme-system support
- The progress bar is an absolutely positioned child of `.duration-block`; keep its
  width driven by `updateUI()` percentage

---

## Logging

- `console.log()` uses structured prefixes:
  - `"START :: <description>"` — observer/process begins
  - `"END :: <description>"` — observer disconnects
- Gate logs behind `import.meta.env.DEV`:
  ```ts
  if (import.meta.env.DEV) console.log('START :: observer started');
  ```

---

## Git and Commit Conventions

- **Branches:** `main` for releases, `dev` for active development; feature branches
  off `dev` named `feature/<short-description>` or `fix/<short-description>`
- **Commit format:** `<TYPE>: <short imperative description>`
  - Types: `FIX`, `ADD`, `UPDATE`, `REMOVE`, `REFACTOR`, `DOCS`, `CI`, `TEST`
  - Examples:
    - `FIX: handle missing playlist element on initial page load`
    - `ADD: unit tests for secondsToTs utility function`
    - `CI: add GitHub Actions workflow for lint and test on PR`
- Keep commits atomic — one logical change per commit
- Never commit `node_modules/`, `dist/`, `*.zip`, `*.crx`, or `*.xpi`

### Releases

1. Add a `## [x.y.z] - YYYY-MM-DD` section to [`CHANGELOG.md`](CHANGELOG.md) first —
   the release workflow uses it as the GitHub Release body.
2. Create and push a tag matching `vX.Y.Z`.
3. `release.yml` runs lint/type-check/tests, syncs `package.json` from the tag,
   builds both browsers, zips them, and publishes the release.
4. **Ask the human before creating or pushing a tag.**

---

## Current State and Known Issues

The modernization backlog is complete: TypeScript migration, Vite build, Vitest,
ESLint, CI, release automation, and a single cross-browser manifest are all in place.

[`AUDIT.md`](AUDIT.md) is the standing issue list, but it is a **2026-03-12 snapshot**.
Re-verify each item against the current code before starting. Items confirmed still
present on `main` as of 2026-10-20:

- **Popup permissions are broken/unreachable:** `tabs` permission missing so the
  "Reload all YouTube tabs" button does nothing (B-01); the grant button is
  permanently disabled because the origin is always granted (B-02/D-01).
- **SPA lifecycle:** `playingObserverStarted` / `playlistObserverStarted` in
  `content.ts` are never reset after navigation, so a later playlist view may not
  initialize its observer (B-04).
- **Current-video accounting:** the `▶` item is pushed into `remainingList` (B-05).
- **Resize observer leak:** `duration-playlist.ts` observes `document.documentElement`
  and never disconnects (B-08).
- **Config cleanups:** `count` duplicates `fullList.length` (B-06); sourcemap uses
  unreliable `NODE_ENV` (C-05); Vitest `globals: true` plus explicit imports (C-06);
  Firefox fallback path uses `.js` (C-07); ESLint still has a legacy `scripts/` block
  and the lint script includes a non-existent `scripts` path.

Already fixed since the audit: theme is now read per update rather than cached at
module load (B-03), and release builds inject the version from the git tag (C-02).

---

## Browser Compatibility

| Concern | Chrome (MV3) | Firefox (MV3) |
|---------|--------------|---------------|
| Background | `background.service_worker` | `transformManifest` rewrites to `background.scripts` |
| Runtime `import()` in content scripts | Supported | Supported |
| `web_accessible_resources` | Required | Required |
| `chrome.action.openPopup()` | Chrome 127+ | Recent versions; guarded by `try/catch` |
| `chrome.tabs.query({ url })` | Requires `tabs` permission | Requires `tabs` permission |
