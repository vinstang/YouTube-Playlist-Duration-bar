# Changelog

## [0.8.1] - 2026-03-14

### Fixed
- Duration bar text style in light mode on playlist pages

---

## [0.8.0] - 2026-03-14

### Fixed
- Removed unused `scripting` and `storage` permissions

### Changed
- Update notification state is now held in memory instead of `chrome.storage.local`
- Extension version is now injected from the git tag at build time — `manifest.json` no longer needs manual version bumps

---

## [0.7.0] - 2026-03-12

### Added
- Toolbar badge and popup notification when the extension updates
- "Reload YouTube tabs" button in the popup to apply updates without restarting the browser
- Redesigned popup with extension icon, version, and dark/light theme support

### Fixed
- Duration bar not showing on Watch Later and some playlist page layouts
- Duration bar disappearing when resizing the browser window
- Duration bar sometimes missing on slow-loading playlist pages

### Changed
- Migrated codebase to TypeScript
- Chrome and Firefox now share a single manifest file

---
