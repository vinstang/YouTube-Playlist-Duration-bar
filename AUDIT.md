# Code Audit — Pre-release Review

> Generated: 2026-03-12. Re-verified against `main` on 2026-10-21.
> Struck-through items are resolved and kept for traceability; do not act on them.

---

## Bugs

| ID | Severity | File(s) | Issue |
|----|----------|---------|-------|
| B-01 | High | `manifest.json`, `src/scripts/popup.ts:52` | `"tabs"` permission missing — `chrome.tabs.query` silently returns empty array; reload button does nothing |
| B-02 | High | `manifest.json`, `src/scripts/popup.ts:65–73` | Grant button permanently disabled; `*://www.youtube.com/*` is in `host_permissions` (always granted), not `optional_host_permissions` — `chrome.permissions.contains()` always returns `true` |
| B-04 | High | `src/scripts/content.ts:19–75` | `playingObserverStarted` / `playlistObserverStarted` flags never reset on SPA navigation — extension stops working after the first playlist visit |
| ~~B-03~~ | ~~Medium~~ | ~~`src/scripts/duration-playing.ts:21`, `src/scripts/duration-playlist.ts:16`~~ | ~~`theme` variable cached at module load time~~ — **DONE** (`checkTheme()` is now called inside each update function, so mid-session theme changes apply) |
| B-05 | Medium | `src/scripts/duration-playing.ts:105–124` | Currently-playing video (`▶`) miscounted as "remaining" instead of "watched" — flag is flipped before pushing the current item |
| B-08 | Medium | `src/scripts/duration-playlist.ts:131–143` | `resizeObserver` is attached to `document.documentElement` and never disconnected; fires on every layout change for the entire browser session |
| ~~B-06~~ | ~~Low~~ | ~~`src/scripts/duration-playlist.ts:103–115`~~ | ~~Redundant `count` variable always equals `fullList.length`~~ — **DONE** (counter removed; `count` is now derived from `fullList.length`) |

---

## Redundant / Duplicate Files

| ID | File | Issue |
|----|------|-------|
| ~~R-02~~ | ~~`playground.html`~~ | ~~Stale scratch HTML file committed to git~~ — **DONE** (deleted) |
| ~~R-04~~ | ~~`AGENTS.md` lines 21–55~~ | ~~Entry points and repo structure described old layout~~ — **DONE** (updated) |
| ~~R-05~~ | ~~`AGENTS.md` lines 45–46~~ | ~~Referenced deleted `manifest-chrome.json` / `manifest-firefox.json`~~ — **DONE** (updated) |

---

## Dead Code

| ID | File | Issue |
|----|------|-------|
| D-01 | `src/scripts/popup.ts:3–5, 61–73` | Entire permission grant UI (button + JS handler) is permanently unreachable — consequence of B-02; consider removing the UI or moving the origin to `optional_host_permissions` |
| ~~D-03~~ | ~~`src/scripts/content.ts:46–47, 67–68`~~ | ~~Retry timeouts fire redundantly after observer fires~~ — **DONE** (IDs stored; cancelled on first observer callback) |

---

## Config Issues

| ID | File | Issue |
|----|------|-------|
| ~~C-02~~ | ~~`package.json:3`~~ | ~~Version is `0.0.0` while `manifest.json` is `0.7.0`~~ — **DONE** (both are `0.0.0`; `transformManifest` injects the version from `package.json`, and `release.yml` syncs it from the git tag) |
| C-05 | `vite.config.ts:11` | `process.env['NODE_ENV']` for sourcemap control is unreliable at config-eval time; idiomatic fix: `export default defineConfig(({ mode }) => ({ build: { sourcemap: mode !== 'production' } }))` |
| C-06 | `vitest.config.ts:5` + `tests/utils.test.ts:1` | `globals: true` is set but Vitest APIs (`describe`, `it`, `expect`) are still explicitly imported — redundant; either remove the imports or set `globals: false` |
| C-07 | `vite.config.ts:47` | Firefox `background.scripts` fallback path uses `.js`: `'src/scripts/background.js'`. Only reached if `background.service_worker` is absent, so impact is low — and since the plugin rewrites manifest paths to `.js`, verify which form is correct before changing it to `.ts` |
| ~~C-08~~ | ~~`vite.config.ts` `transformManifest`~~ | ~~AMO validator warns: `browser_specific_settings.gecko.data_collection_permissions` is missing~~ — **DONE** (added `required: ['none']` to the Firefox transform; the extension transmits no data) |
| ~~G-02~~ | ~~`.gitignore:8`~~ | ~~`Release/` entry is dead clutter~~ — **DONE** (removed) |

---

## Notes

- `AGENTS.md` is the single agent-instructions file; `CLAUDE.md` was removed.
- AMO (Firefox) reported only one warning on `firefox-v0.8.2.zip`: the missing
  `data_collection_permissions` key (see C-08). All other validator suites were
  clean — 0 errors, 0 warnings across security, extension, localization, and
  compatibility tests.
- GitHub Actions versions (`actions/checkout@v6`, `actions/setup-node@v6`) are confirmed valid — v6 exists for both.
- `actions/upload-artifact@v7` and `softprops/action-gh-release@v2` are also confirmed correct.
