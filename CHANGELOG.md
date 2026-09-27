# Changelog

## [0.3.0] - 2026-09-27

### Added

- Resolve TypeScript imports across declared npm, Yarn, and pnpm workspace packages, including common glob and exclusion patterns.
- Follow package export roots, subpaths, wildcard entries, TypeScript custom conditions, and declaration/build targets back to included source files.
- Warn on duplicate workspace package names and keep ambiguous links external.
- Updated the Zustand live example to demonstrate a source-inspectable import across its workspace boundary.

### Quality

- Added fixtures for npm, pnpm, and Yarn workspaces, inherited TypeScript conditions, export encapsulation, path traversal, exclusions, and ambiguous package names.
- Verified Node 22 and 24 on Linux, macOS, and Windows, plus CodeQL, architecture analysis, and action smoke tests.

## [0.2.0] - 2026-09-27

### Added

- Impact maps that follow resolved internal imports backwards and count direct and transitive dependents.
- Circular dependency analysis with cycle-group selection, a focused circular layout, and highlighted, source-inspectable edges.
- Architecture signals for circular groups and the most depended-on modules.
- Fresh Hono, Ky, and Zustand maps plus an updated interactive README preview.

### Fixed

- Cycle detection now uses an explicit traversal stack, so a 5,000-module import chain does not overflow the JavaScript call stack.

### Quality

- Expanded automated coverage for transitive impact, circular groups, self-imports, excluded external/unresolved imports, and maximum-length dependency chains.
- Verified generated examples, desktop and mobile layouts, cross-platform CI, CodeQL, and the published Pages site.
