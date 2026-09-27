# Changelog

## [1.10.0] - 2026-09-27

### Added

- Give SVG module controls keyboard activation with both Enter and Space, matching the connection controls and preventing accidental page scroll.
- Show a high-contrast focus ring on keyboard-focused graph modules.
- Check the source with both the TypeScript 6.0.3 compiler API toolchain and stable TypeScript 7.0.2 CLI in CI.

### Quality

- Add regression tests for activation keys and unrelated key input.
- Run both compiler checks across the existing Node 22/24 and Linux/macOS/Windows CI matrix.

## [1.9.0] - 2026-09-27

### Added

- Bundle parallel imports into one countable connector per internal module pair; keep every original import edge and its exact source evidence.
- Open a keyboard-accessible, paged source-site list from a bundled connector and share a direct link to that bundle or any exact edge.

### Fixed

- Replace zero-area SVG edge hit paths with accessible map-sized hit targets, restoring reliable pointer and keyboard activation for straight and curved connections.
- Highlight the connector on hover and keyboard focus without leaving a visible hit-box over the map.

### Quality

- Test deterministic grouping, retained line/specifier evidence, stale and paged deep links, and direction-specific separation.
- Browser-check a 51-import fixture and real Hono maps on desktop and mobile.

## [1.8.0] - 2026-09-27

### Added

- Add shareable URL-hash routes for selected modules, external packages, and exact import evidence.
- Restore routes from the same offline HTML file and support browser Back/Forward navigation.
- Add an accessible copy-link control with a selectable-URL fallback when clipboard access is unavailable.

### Quality

- Test encoded source paths and specifiers, stale and malformed routes, and external-package pagination bounds.
- Browser-check real Hono source links, direct routes, navigation history, and responsive layouts.

## [1.7.0] - 2026-09-27

### Fixed

- Stop treating calls to locally shadowed `require` parameters, imports, variables, catch bindings, or named function/class bindings as CommonJS dependencies.
- Respect block scopes, function-scoped `var`, destructuring, and type-only imports while preserving the actual global CommonJS `require` signal.

### Quality

- Cover nested and unrelated scopes, hoisted variables, ambient/type-only declarations, exact internal resolution, and computed global `require` evidence.

## [1.6.0] - 2026-09-27

### Added

- Add a source-backed external dependency inventory grouped into npm packages, Node built-ins, URL imports, and other specifiers.
- Group scoped package subpaths by package name and report import-site and distinct-module counts without fetching registry metadata.
- Let users open every exact external import site from the offline viewer, with keyboard-accessible browsing and 50-site paging.
- Advertise optional computed-import and external-dependency classification fields in the additive v1 snapshot schema.

### Quality

- Test scoped package grouping, Node built-ins, URLs, repeat imports, deterministic ordering, older snapshots, and evidence-site preservation.
- Regenerate the real Hono, Zustand, and Ky maps with categorized dependency evidence.

## [1.5.0] - 2026-09-27

### Added

- Show computed `import()` and `require()` calls as unresolved edges with the original expression and exact source line.
- Explain that computed targets are not inferred, keeping the map useful without overstating what static analysis can prove.

### Quality

- Cover identifier and interpolated-template expressions, CommonJS and dynamic-import kinds, exact lines, evidence, warning text, and continued resolution of literal imports.

## [1.4.0] - 2026-09-27

### Added

- Add a per-module trace of the deterministic shortest resolved-import path from any detected entry point.
- Isolate the ordered path in a vertical map, highlight only its source-backed edges, and keep each import clickable for exact line evidence.
- Explain the distinct cases: the selected module is an entry, a path is available, no detected entry points exist, or a module is outside the detected paths.
- Add an interactive Hono path screenshot and update the feature page and README.

### Quality

- Cover shortest-path choice across multiple entries, already-entered modules, cycles, disconnected modules, and missing entry detection.
- Browser-verify the path layout on a real Hono snapshot and inspect a highlighted import through to its commit-pinned source line.

## [1.3.0] - 2026-09-27

### Added

- Add opt-in `--include-js` analysis for `.js`, `.jsx`, `.mjs`, and `.cjs` modules in mixed TypeScript repositories.
- Resolve static TS↔JS, ESM, JSX, and CommonJS imports to included source modules while retaining TypeScript-only defaults.
- Add `include-js` to the GitHub Action and exercise it in the action smoke workflow.
- Clarify that source-file count limits apply across included languages.

### Quality

- Test mixed-language imports, default exclusions, test-file opt-in, and the CLI flag.

## [1.2.0] - 2026-09-27

### Added

- Add `repoatlas check --format github` to emit native `::error` annotations in GitHub Actions.
- Pin forbidden-import annotations to the exact source file and line; summarize aggregate cycle/reachability violations without inventing a source location.
- Escape workflow-command property delimiters and untrusted newlines/percent signs while preserving normal source messages.
- Retain `--json` and add `--format json`; reject contradictory output options.

### Quality

- Test GitHub command escaping for commas, colons, percent signs, CR/LF, aggregate messages, and successful checks without violations.
- Add a release regression that keeps package.json and package-lock.json versions synchronized.

## [1.1.0] - 2026-09-27

### Added

- Add optional directory/workspace clustering that groups visible modules while retaining import edges and line-level inspection.
- Add a mini overview for maps with more than 50 visible modules; click any area to navigate, inspect the current viewport, or center it with a keyboard-accessible button.
- Label the overview with the current page and visible module count so paged maps are not mistaken for the full graph.

### Quality

- Browser-checked navigation and cluster readability on a generated 260-module repository; the overview remains anchored during both horizontal and vertical scrolling.
- Retain exact edge click/keyboard behavior and source evidence in clustered mode.

## [1.0.0] - 2026-09-27

### Added

- Publish draft 2020-12 JSON Schemas for RepoAtlas snapshots and architecture-rule configuration; expose them with `repoatlas schema snapshot|config`.
- Define v1 snapshot compatibility: required graph fields retain their meaning, additive metadata is allowed, and breaking changes require a new schema version.
- Document Node.js and CI platform support plus snapshot migration guidance.

### Quality

- Tighten snapshot integer validation to match the published schema and add CLI/schema compatibility tests.
- Verified package includes schema files and the CLI can read them from the packed layout.

## [0.9.0] - 2026-09-27

### Added

- Add `repoatlas check` for forbidden workspace/directory import boundaries and configurable cycle-group and unreachable-module limits.
- Return exact source-file, line, and import-code evidence for each forbidden dependency; provide deterministic text and JSON results with a failing exit code for CI.
- Treat reachability as unknown when there are no detected entry points, so the orphan limit cannot create a false failure.
- Document a GitHub Actions check workflow and the stable boundary ID format.

### Quality

- Validate configuration strictly, reject unknown properties and invalid thresholds, and test successful/failing CLI exit behavior.
- Verified 42 tests, TypeScript checks, package contents, cross-platform CI, and CodeQL.

## [0.8.0] - 2026-09-27

### Added

- Export a script-free, standalone SVG of the workspace/directory boundary matrix.
- Add a concise text report for CI logs summarizing modules, entries, import resolutions, reachability, cycle groups, warnings, and cross-boundary imports.
- Keep XML labels escaped and apply the same 80-group limit to SVG as the interactive matrix, with a clear text-report fallback.
- Protect report files from accidental overwrite unless `--overwrite` is supplied.

### Quality

- Added tests for injected markup, deterministic exports, empty and no-entry snapshots, matrix caps, CLI formats, and overwrite protection.
- Validated an SVG export of the real Hono snapshot as XML; verified 38 tests, TypeScript checks, npm packaging, cross-platform CI, and CodeQL.

## [0.7.0] - 2026-09-27

### Added

- Compare two RepoAtlas JSON snapshots with concise text or machine-readable output.
- Report added and removed modules and dependency relationships, and call out changed import specifiers.
- Ignore source line and formatting shifts when measuring architecture drift; retain before/after line evidence on actual edge changes.
- Validate snapshot schema before comparing and read the CLI version from package.json.

### Quality

- Added tests for identical graphs with shifted line numbers, workspace-compatible snapshots, added/removed internal and external edges, unresolved imports, specifier changes, malformed inputs, and CLI text/JSON modes.
- Verified 33 tests, TypeScript checks, package dry-run, cross-platform CI, action map, and CodeQL.

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
