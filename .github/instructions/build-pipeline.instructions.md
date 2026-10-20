---
description: "Use when changing vite.config.ts, manifest.json, package.json, tsconfig.json, vitest.config.ts, eslint.config.js, or GitHub workflows. Preserves the custom ESM/dynamic-import build contract and release versioning."
applyTo: ["vite.config.ts", "manifest.json", "package.json", "tsconfig.json", "vitest.config.ts", "eslint.config.js", ".github/workflows/**"]
---

# Build Pipeline Rules

This extension uses `vite-plugin-web-extension`, which bundles every script
referenced by the manifest as **IIFE**. That strips `export`, so any module loaded at
runtime with dynamic `import()` must be emitted separately as **ESM**.

## Do not break these invariants

1. **Source `manifest.json` must not contain `web_accessible_resources`.**
   `transformManifest` injects it. If WAR is in the source manifest, the plugin treats
   those paths as Rollup inputs, bundles them as IIFE, and named exports disappear.
2. **Runtime ESM modules must be registered in two places:**
   - a `viteStaticCopy` target in `vite.config.ts` (esbuild, `format: 'esm'`)
   - a `scripts/<name>.js` entry in `transformManifest` →
     `web_accessible_resources.resources`
3. **Source imports use `.js` specifiers** (`import { x } from './utils.js'`).
   `transformWithEsbuild` compiles each file independently and does not rewrite
   import paths.
4. **Do not add runtime-imported modules to `content_scripts`, `background`, or other
   manifest entry points.** The plugin would bundle them as IIFE.
5. **Top-level content scripts must not rely on ESM exports.** Put shared code in
   runtime-loaded modules and call them through `chrome.runtime.getURL()`.

## Output layout

```text
dist/
  manifest.json              # paths rewritten, WAR injected, version from package.json
  scripts/utils.js           # ESM, produced by viteStaticCopy
  scripts/duration-playing.js
  scripts/duration-playlist.js
  src/scripts/content.js     # IIFE entry
  src/scripts/background.js
  src/html/popup.html
  src/html/popup.js
```

Each build empties `dist/` (`emptyOutDir: true`), so Chrome and Firefox builds
overwrite each other. Inspect the manifest after each build before switching targets.

## Versioning and releases

- `package.json` and `manifest.json` both say `0.0.0` in the repository.
- `transformManifest` sets the output manifest version from `package.json`.
- `.github/workflows/release.yml` runs `npm version <tag> --no-git-tag-version`
  before building, so the git tag is the source of truth.
- **Do not bump `manifest.json` by hand**; the value is overwritten at build time.
- Add a `## [x.y.z] - YYYY-MM-DD` section to `CHANGELOG.md` before tagging; the
  workflow extracts it as the GitHub Release body.

## Firefox transform

`TARGET=firefox` (set by `npm run build:firefox`) makes `transformManifest`:

- replace `background.service_worker` with `background.scripts`
- add `browser_specific_settings.gecko.id`

Both browsers share one source manifest. Put Firefox-only fields in
`transformManifest`, not in a second manifest file.

## Known config issues (see `AUDIT.md`)

- `build.sourcemap` uses `process.env['NODE_ENV']`, which is unreliable at config
  evaluation time; prefer `defineConfig(({ mode }) => ...)`.
- The Firefox fallback path is `'src/scripts/background.js'`, but the source file is
  `background.ts`.
- `viteStaticCopy` copies `icons/*`, including `.xcf` source files, into `dist/`.
- `eslint.config.js` and the `lint` script still reference a legacy `scripts/` folder
  that no longer exists (`--no-error-on-unmatched-pattern` hides it).

## Verify

```bash
npm run build:chrome
cat dist/manifest.json        # WAR present, paths rewritten, version correct
npm run build:firefox
cat dist/manifest.json        # background.scripts + gecko id present
```
