---
name: Browser extension testing
description: Run and interpret the local Chrome and Firefox end-to-end checks for the YouTube Playlist Duration Bar extension, including one-time login, profile reuse, playlist coverage, screenshots, and expected DOM/theme assertions.
---

# Browser extension testing

Use this skill when changing playlist parsing, duration math, injected UI, theme
handling, the manifest, or the build pipeline, and the change needs verification
against real YouTube pages in Chrome and Firefox.

## Constraints

- These checks are **local only**. Never add them to CI.
- Profiles and cookies live in `.e2e/` and must stay gitignored.
- Do not attempt a Google login inside a Selenium-controlled browser. Google
  rejects it. Firefox login must happen in a normal browser first.
- `dist/` is generated. The runners build it; never hand-edit it.
- Both targets share `dist/`, and each build empties it. The Firefox runner
  rebuilds Chrome at the end.

## Workflow

1. Install dependencies if needed: `npm ci`.
2. On a fresh machine/profile, log in once:
   - `npm run e2e:login:chrome`
   - `npm run e2e:login:firefox` (normal Firefox; close it after signing in)
3. During development, run Chrome in dark mode (the default):
   - `npm run e2e:chrome`
4. When the user asks to prepare a release, run the full browser/theme matrix:
   - `npm run e2e:chrome -- --theme=light`
   - `npm run e2e:chrome -- --theme=dark`
   - `npm run e2e:firefox -- --theme=light`
   - `npm run e2e:firefox -- --theme=dark`
   Each run switches YouTube's real Appearance setting and restores it afterwards.
5. Read the printed table. Any row with a flag is a failure; the process exit code
   is non-zero.
6. On failure, open the referenced screenshot under
   `.e2e/artifacts/<engine>/` with the image-reading tool and compare it with the
   flagged assertion.
7. Re-run after fixes. Routine development uses Chrome only; Firefox and light mode
   are part of release verification unless the user asks for them sooner.

## What the flags mean

- `NOT_INJECTED` / `ZERO_SIZE`: the UI never appeared or has no layout.
- `COUNT x!=y`: `Videos counted` differs from rendered row count.
- `TOTAL x!=y`: total differs from the sum of rendered row durations.
- `THEME x!=y`: block theme attribute does not match the expected layout theme.
- `COLOR ...`: computed text color does not match the theme's CSS.
- `PROGRESS x!=y`: progress bar width differs from the displayed percentage.
- `VIDEO_ROW_*_NOT_CURRENT`: selecting a watch-panel row did not mark it current.
- `VIDEO_ROW_*_NOT_SELECTABLE`: a rendered watch-panel row had no clickable video link.
- `LOAD_MORE_NOT_REACHED`: a playlist advertises more than 100 videos but scrolling did not load additional rows.
- `HEADER ...` is informational: hidden/unavailable videos and lazy loading can
  make YouTube's header count differ from rendered rows.

## Commands and shortcuts

```sh
npm run e2e:chrome -- --public-only     # no login required
npm run e2e:chrome -- --url=PLMOZDTW7ZvXM
npm run e2e:chrome -- --screenshots
npm run e2e:chrome -- --json
npm run e2e:chrome -- --no-build
npm run e2e:chrome -- --theme=light
npm run e2e:chrome -- --theme=dark --keep-theme
```

`--theme` uses YouTube's real Appearance menu and verifies the root theme changed.
Without `--keep-theme`, the previous theme is restored after the run. Runs default
to dark mode; both themes are normally reserved for final release verification.

## Source of truth

Read `tests/e2e/README.md` from the repository root before changing the harness.
The shared page diagnostics live in `tests/e2e/lib/diagnose.mjs`; assertions and
table formatting live in `tests/e2e/lib/report.mjs`.
