# Browser end-to-end checks

Local regression harness for the extension's playlist UI. It loads the built
extension in a real Chrome/Chromium and Firefox, visits the account's playlists,
and checks the injected UI against the DOM that is actually rendered.

These checks are **not** part of CI: they need a logged-in YouTube account, a
real browser, network access, and (for Firefox) a one-time manual login.

## Setup

- Node 24 (`npm ci`)
- Playwright Chromium: `npx playwright install chromium`
- Firefox installed (or `FIREFOX_BIN=/path/to/firefox`)
- `zip` and `sqlite3` on `PATH`
- `selenium-webdriver` (already a dev dependency; Selenium Manager downloads
  geckodriver on first use)

## One-time login

Profiles are stored under `.e2e/` and are gitignored. Never commit them.

### Chrome

```sh
npm run e2e:login:chrome
```

Sign in to the opened Chrome window. The login is detected automatically and the
profile is saved to `.e2e/chrome-profile`.

### Firefox

```sh
npm run e2e:login:firefox
```

This opens a **normal, non-automated Firefox** with `.e2e/firefox-profile`.
Sign in, then close Firefox. Google rejects sign-in inside a Selenium-controlled
browser, which is why this step cannot be automated.

## Running the checks

```sh
npm run e2e:chrome
```

Development verification uses Chrome in dark theme by default and exits non-zero
on any failure. Run Firefox and light-theme checks when preparing a release or
investigating a browser/theme-specific issue. Each command builds its target first;
`e2e:firefox` rebuilds the Chrome `dist/` at the end because both targets share it.

Useful flags:

```sh
npm run e2e:chrome -- --public-only     # no login required
npm run e2e:chrome -- --url=PLMOZDTW7ZvXM
npm run e2e:chrome -- --screenshots     # capture every checked page
npm run e2e:chrome -- --json
npm run e2e:chrome -- --no-build        # use current dist/ (must match target)
npm run e2e:chrome -- --theme=light     # optional single light-theme run
npm run e2e:chrome -- --keep-theme      # leave the default dark theme applied
```

`--theme` drives YouTube's real Appearance menu (avatar → Appearance → Dark/Light)
and verifies the page root actually changed. It supports the English and Chinese
labels used by this account. The previous theme is restored at the end; add
`--keep-theme` to leave the requested theme applied.

When preparing a release, run the full four-way browser/theme matrix:

```sh
npm run e2e:chrome  -- --theme=light
npm run e2e:chrome  -- --theme=dark
npm run e2e:firefox -- --theme=light
npm run e2e:firefox -- --theme=dark
```

## What is checked

For every standalone playlist:

- extension UI injected and non-zero size
- `Videos counted` equals the number of top-level rendered rows
- total equals the sum of the rendered row durations
- block/theme attributes and computed text colors are valid for the layout
- screenshot on failure (full page + extension block)

For Watch Later, the public control, and the first owned playlist, the harness
also clicks into a video (SPA navigation, no reload), checks the watch-page panel
and progress bar, selects the second and third video rows in turn, verifies each
current-row marker and watched/remaining/total counters against the panel rows,
then returns to the playlist and re-checks it. With at least two non-empty owned
playlists, it also navigates through YouTube's Playlists hub from one owned
playlist to another and asserts the document was not reloaded and the target
playlist UI reflects its current rows.

For playlists whose header advertises more than 100 videos while at most 100 rows
are loaded, the harness scrolls to the bottom and waits for additional rows (up to
12 scroll attempts, stopping after five attempts with no growth). It then checks
the count and duration against the newly rendered rows. Failure to load past 100
is reported as `LOAD_MORE_NOT_REACHED`.

The standalone block is expected to be dark in both themes because it sits on the
playlist header artwork. The watch panel is expected to follow the page root
theme. Violations show up as `THEME`, `COLOR`, `COUNT`, or `TOTAL` flags.

## Artifacts

```text
.e2e/
  chrome-profile/
  firefox-profile/
  firefox-dist/
  firefox-temp.xpi
  artifacts/chrome|firefox/*.png
```

Open failure screenshots with the agent's image-reading tool. A flag in the table
identifies which screenshot to inspect.

## Notes

- Header counts can legitimately exceed rendered rows (hidden/unavailable videos,
  YouTube's lazy loading). Header mismatch is reported as information only.
- Firefox currently exposes no content-script console logs through Selenium; the
  Chrome runner captures extension console and failed requests.
- Delete `.e2e/` to reset both profiles and force a fresh login.
