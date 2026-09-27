# Changelog

## [0.6.0] - 2026-09-27

### Added

- Add a package/directory boundary matrix showing resolved internal imports by direction and count.
- Open any populated matrix cell to inspect the individual source files, lines, and import statements behind it.
- Include an optional repository-relative `workspace` path on modules in declared workspaces in JSON and HTML data.
- Refresh the Hono, Ky, and Zustand examples with the current boundary viewer.

### Quality

- Test same- and cross-boundary imports, workspace grouping, isolated directories, and exclusion of external, unresolved, or missing endpoints.
- Manually inspect the matrix and exact source evidence in a browser; verify 29 tests, TypeScript checks, and npm packaging.

## [0.5.0] - 2026-09-27

### Added

- Trace static reachability from recognized TypeScript entry points, highlight modules outside those paths, and filter the map to inspect them.
- Report reachability as unknown when no entry points are detected, avoiding false orphan claims.
- Explain the heuristic entry-point basis in the inspector, module status, and README.
- Refresh the Zustand, Ky, and Hono maps with the current viewer.

### Quality

- Added coverage for multiple entries, cycles, disconnected modules, unknown entry sets, and a 5,000-module traversal.
- Browser-checked reachable and no-entry projects; verified 27 tests, TypeScript checks, cross-platform CI, and CodeQL.

## [0.4.0] - 2026-09-27

### Added

- Paginate large graph results in accessible groups of 100 modules, with synchronized module explorer and first, previous, next, and final page behavior.
- Distribute each page into compact columns capped at 20 modules for faster visual scanning.
- Expand edge hit targets and support Space-key activation while preserving exact source evidence.

### Quality

- Reviewed a 260-module generated project in a real browser, including page boundaries, edge selection, and the source inspector.
- Verified 24 automated tests, TypeScript checks, npm packaging, cross-platform CI, action maps, and CodeQL.

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
