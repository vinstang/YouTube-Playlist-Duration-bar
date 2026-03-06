# AGENTS.md — YouTube Playlist Duration bar

This file is for agentic coding agents operating in this repository. It captures
project context, commands, and code style guidelines needed to work effectively.

---

## Project Overview

A Chrome/Firefox browser extension (Manifest V3) that injects a progress bar and
duration stats into YouTube playlist pages. Published on the Chrome Web Store and
Firefox Add-ons at v0.6.5. The project is being revamped into a proper open-source
extension with a TypeScript build pipeline, tests, CI/CD, and structured releases.

**Extension entry points:**
- `scripts/content.js` — injected into every YouTube page; sets up MutationObservers
- `scripts/background.js` — service worker; re-injects scripts on install
- `scripts/duration-playing.js` — ES module; handles the "now playing" playlist view
- `scripts/duration-playlist.js` — ES module; handles the standalone playlist page view
- `html/popup.html` + `scripts/popup.js` — browser action popup UI

---

## Repository Structure

```
scripts/              # CURRENT source JS (root-level, pre-revamp)
css/                  # CURRENT source CSS (root-level, pre-revamp)
html/                 # CURRENT source HTML (root-level, pre-revamp)
src/                  # FUTURE home of TypeScript source (currently empty skeleton)
  scripts/            #   → TS equivalents of scripts/
  css/                #   → CSS/SCSS source
  html/               #   → HTML templates
dist/                 # Build output — never commit (currently empty)
tests/                # Test files — Vitest (currently empty, to be populated)
icons/                # Extension icons (PNG + GIMP .xcf originals)
manifest.json         # Active manifest (Chrome, MV3)
manifest-chrome.json  # Chrome-specific copy
manifest-firefox.json # Firefox variant (no "scripting" permission)
Release/              # Zip archives of prior releases
.github/workflows/    # CI/CD pipelines (currently empty, to be populated)
```

**IMPORTANT:** Until the build pipeline is established, `scripts/`, `css/`, and
`html/` at the repository root are the authoritative source files. Once migration
to `src/` is complete, the root-level directories become obsolete and should be
removed. Do not add new features to the root-level `scripts/` directory — new work
goes into `src/`.

---

## Build / Lint / Test Commands

> `package.json` does not yet exist. Vite, Vitest, and ESLint are installed in
> `node_modules` but are not yet configured. The commands below reflect the
> intended setup once bootstrapped.

| Command                      | Purpose                                        |
|------------------------------|------------------------------------------------|
| `npm run dev`                | Build in watch mode for local development      |
| `npm run build`              | Production build to `dist/`                    |
| `npm run build:chrome`       | Chrome-specific production build               |
| `npm run build:firefox`      | Firefox-specific production build              |
| `npm run lint`               | Run ESLint across `src/`                       |
| `npm run lint:fix`           | Auto-fix ESLint violations                     |
| `npm run test`               | Run all tests via Vitest                       |
| `npm run test -- <file>`     | Run a single test file                         |
| `npm run test -- --watch`    | Run tests in watch mode                        |
| `npm run type-check`         | Run `tsc --noEmit` without building            |

**Loading the extension locally (current no-build workflow):**
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the repository root (where `manifest.json` lives)

**Loading after build pipeline is set up:**
1. Run `npm run build:chrome`
2. Load unpacked from `dist/`

---

## Language: TypeScript Migration

The project is migrating from Vanilla JavaScript to TypeScript. Follow these rules:

- **New code goes in `src/` as `.ts` files** — do not add `.js` files to `src/`
- **Existing `scripts/*.js` files** are legacy — migrate them to `src/scripts/*.ts`
  when touching them as part of a feature or fix
- Use **`strict: true`** in `tsconfig.json` (no implicit `any`, strict null checks)
- Prefer explicit return types on exported functions
- Use `interface` for object shapes (DOM element groups, return value types)
- Use `type` for unions, aliases, and utility types
- Avoid `any`; use `unknown` and narrow the type instead
- Use `as` type assertions only when the DOM guarantees the type (e.g.,
  `document.getElementById('x') as HTMLDivElement`)

---

## Code Style

### Variables and Functions
- Use `const` for all function declarations: `const myFunc = () => { ... }`
- Use `let` for mutable variables; **never use `var`**
- Use arrow functions for all function expressions
- Use destructuring for multi-value returns: `return { watchedList, remainingList }`

### Formatting
- **4-space indentation** (no tabs)
- Single quotes for strings; double quotes only inside JSX/HTML attribute strings
- Ternary operators acceptable for short single-line conditionals
- Opening braces on the same line as the statement
- One blank line between top-level declarations

### Naming Conventions
- **Files:** `kebab-case` — `duration-playing.ts`, `duration-playlist.css`
- **Functions / variables:** `camelCase` — `updateDurationPlaying`, `totalSeconds`
- **Interfaces:** `PascalCase` prefixed with `I` only if needed for disambiguation
  — prefer plain `PascalCase`: `VideoTimeResult`, `DurationState`
- **CSS classes:** `kebab-case` — `.duration-block`, `.played-content`
- **CSS IDs:** `kebab-case` — `#duration-block-playing`, `#progress-bar-playing`
- **Boolean flags:** prefix with verb — `playingObserverStarted`, `isWatched`
- Avoid abbreviations except established ones: `ts` (timestamp), `el` (element)

### Known Typo — Fix on Sight
- `createUiELement` (capital L) exists in both `duration-playing.js` and
  `duration-playlist.js`. Rename to `createUiElement` whenever these files are touched.

### Imports
- Use static `import` at the top of `.ts` files
- In content scripts, dynamic `import()` via `chrome.runtime.getURL()` is required
  by MV3 sandbox rules — this pattern must be preserved in the compiled output
- Group imports: browser APIs → third-party → internal modules (blank line between groups)

---

## Error Handling

The current codebase has **no error handling** — all DOM queries assume elements exist.
Follow these rules when writing new code or modifying existing code:

- Guard every DOM query result before accessing its properties:
  ```ts
  const el = document.querySelector<HTMLElement>('#some-selector');
  if (!el) return;
  ```
- Never use `!` non-null assertion (`el!.innerText`) — use a null guard instead
- Use early returns to reduce nesting rather than wrapping in `try/catch`
- Reserve `try/catch` for async operations (e.g., `chrome.scripting.executeScript`)
  and re-log or silently swallow only extension lifecycle errors that are expected

---

## DOM and Browser Extension Patterns

- Use `MutationObserver` to react to YouTube's SPA navigation — no `load` events
- **Disconnect observers** when no longer needed to prevent memory leaks
- Use `chrome.runtime.getURL()` for all resource paths from content scripts
- Theme detection pattern (preserve this):
  ```ts
  const checkTheme = (): 'dark' | 'light' =>
      document.querySelector('[dark]') ? 'dark' : 'light';
  ```
- Theme is applied to injected elements as an empty attribute for CSS targeting:
  ```ts
  element.setAttribute(theme, '');  // theme is 'dark' or 'light'
  ```
- CSS attribute selectors `[dark]` and `[light]` are the theming mechanism — do not
  replace with CSS custom properties without updating all injection code

---

## CSS

- Attribute selectors for theming: `[dark] { ... }` / `[light] { ... }`
- Use `rgba()` for all colors to preserve overlay compatibility with YouTube's UI
- `common.css` for shared styles across features; one CSS file per feature module
- `kebab-case` for all class names and IDs
- Avoid CSS custom properties unless adding full theme system support

---

## Logging

- `console.log()` is used for development debugging with structured prefixes:
  - `"START :: <description>"` — when an observer or process begins
  - `"END :: <description>"` — when an observer disconnects
- Gate all `console.log` calls behind a `DEBUG` flag in production builds:
  ```ts
  const DEBUG = process.env.NODE_ENV !== 'production';
  if (DEBUG) console.log('START :: observer started');
  ```

---

## Git and Commit Conventions

- **Branches:** `main` for releases, `dev` for active development; feature branches
  off `dev` named `feature/<short-description>` or `fix/<short-description>`
- **Commit message format:** `<TYPE>: <short imperative description>`
  - Types: `FIX`, `ADD`, `UPDATE`, `REMOVE`, `REFACTOR`, `DOCS`, `CI`, `TEST`
  - Examples:
    - `FIX: handle missing playlist element on initial page load`
    - `ADD: unit tests for secondsToTs utility function`
    - `CI: add GitHub Actions workflow for lint and test on PR`
- Keep commits atomic — one logical change per commit
- Do not commit `node_modules/`, `dist/`, or `.zip` release archives (add to `.gitignore`)

---

## Revamp Priorities

Work in this order when contributing to the modernisation effort:

1. **Bootstrap tooling** — add `package.json`, configure Vite (bundler), ESLint
   (linter), Vitest (test runner), and `tsconfig.json` with `strict: true`
2. **Fix `.gitignore`** — exclude `node_modules/`, `dist/`, `*.zip`
3. **Migrate source to `src/`** — convert `scripts/*.js` → `src/scripts/*.ts`,
   move `css/` and `html/` into `src/`
4. **Write unit tests** — start with pure functions: `timeListToSeconds`,
   `secondsToTs`, `calculateTotalTime`; target `tests/` directory with Vitest
5. **CI pipeline** — add GitHub Actions: lint + type-check + test on every PR;
   build on push to `main`
6. **Release automation** — zip packaging, `CHANGELOG.md`, GitHub Releases triggered
   by version tags; separate Chrome and Firefox artifacts
7. **Cross-browser parity** — align `manifest-firefox.json` version with Chrome
   and resolve the missing `"scripting"` permission difference

---

## Browser Compatibility Notes

| Feature                          | Chrome (MV3) | Firefox (MV3)        |
|----------------------------------|--------------|----------------------|
| `chrome.scripting` API           | Supported    | Not used (see manifest-firefox.json) |
| Dynamic `import()` in content scripts | Supported | Supported (MV3)  |
| Service worker background        | Required     | Supported            |
| `web_accessible_resources`       | Required for dynamic imports | Required |
