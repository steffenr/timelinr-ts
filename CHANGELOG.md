# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-08-25

### Added

- **`--tl-list-max-height` custom property** (`list`, `list-alternating`) — replaces the whole
  computed scroll window (`calc(var(--tl-visible) * var(--tl-row))` by default). Setting
  `--tl-list-max-height: none` auto-sizes the timeline root to its content: every entry stays
  permanently visible and nothing scrolls internally (the page takes over when entries fall
  outside the viewport). Accepts any length. `stack` is deliberately excluded — its fixed height
  (`--tl-height`) is load-bearing for the slide transform.
- **`examples/auto-size/`** — the `list` timeline with `--tl-list-max-height: none` and a
  checkbox toggling against the default windowed max-height.

### Fixed

- README bundle-size figures: the ESM bundle actually measures ~10.5 kB (~3.6 kB gzipped),
  not the previously claimed ~8.6 kB / ~2.8 kB.

## [1.0.5] — 2026-08-24

### Added

- **`examples/fixed-header/`** — a `list` timeline under a fixed site header, demonstrating how
  the active entry stays fully in view via the root's `scroll-padding-top`.

### Fixed

- **Active-entry scrolling is internal-first, page-last.** Internal containers (the timeline root
  on the list variants) align the active entry to their on-screen band, inset by their computed
  `scroll-padding-*`; only user-initiated navigation may scroll the page, by the least amount that
  fits the entry into the viewport band. Autoplay and the initial `startAt` selection never move
  the page.

## [1.0.4] — 2026-08-24

### Changed — BREAKING

- **Date icons are inline `<svg>`s inside the date `<a>`, not `--tl-icon` data URIs.** The
  stylesheet pins the SVG to the medallion disc's grid cell and tints it via
  `color: var(--tl-bg)` (`stroke`/`fill="currentColor"`). Consumers carrying a `--tl-icon`
  override must move their icon markup into the date link; an `<a>` without an `<svg>` renders
  no glyph. No icon set ships with the library.

### Changed

- `dist/timelinr.js` is now fully minified: Vite's ES lib builds keep whitespace/comments, so a
  `closeBundle` plugin runs esbuild over the written chunk (sourcemap still points at `src/*.ts`).
- Examples' list icon medallions converted from data-URI masks to the inline SVGs.

## [1.0.3] — 2026-08-24

### Changed

- The npm package ships only `dist/` — the unminified source stylesheet no longer publishes;
  `styles/timelinr.css` stays in the repo for development.

## [1.0.2] — 2026-08-24

### Changed

- Package renamed to drop the user scope from its name.
- Removed the obsolete jQuery Timelinr migration section from the README.

## [1.0.1] — 2026-08-23

### Changed

- npm publishing switched to trusted publishing (OIDC); LICENSE and package metadata prepared.

## [1.0.0] — 2026-08-23

### Added

- Initial release: framework-agnostic TypeScript timeline slider — zero runtime dependencies,
  a single `Timelinr` class, CSS-driven animation, five variants (`rail`, `stack`, `tabs`,
  `list`, `list-alternating`), five themes, autoplay with hover pause, keyboard navigation,
  ARIA carousel/list semantics and `prefers-reduced-motion` support.

[1.1.0]: https://github.com/steffenr/timelinr-ts/compare/v1.0.5...v1.1.0
[1.0.5]: https://github.com/steffenr/timelinr-ts/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/steffenr/timelinr-ts/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/steffenr/timelinr-ts/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/steffenr/timelinr-ts/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/steffenr/timelinr-ts/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/steffenr/timelinr-ts/releases/tag/v1.0.0
