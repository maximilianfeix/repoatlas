# Changelog

## [2.36.0] - 2026-09-28

### Improved

- Add large-image sharing metadata that reuses the designed social preview and gives the architecture image descriptive alternative text.

### Quality

- Check that Open Graph and X card image metadata stay aligned with the live preview asset.

## [2.35.0] - 2026-09-28

### Improved

- Add direct links to the existing Zustand and Ky architecture maps on the README and project site, alongside Hono.
- Label each example by project type and module count so visitors can choose a map that matches their codebase.

### Quality

- Verify the Zustand and Ky snapshots, source revisions, and live maps before presenting them as examples.

## [2.34.0] - 2026-09-28

### Improved

- Make the README's animated Hono demo open the exact import it shows, with the source inspector already on line 3.

### Quality

- Verify the commit-pinned direct route in the live browser map before linking it from the README.

## [2.33.0] - 2026-09-28

### Improved

- Replace the README process graphic with a compact recording of the real Hono map, from overview to a selected import and exact source line.
- Keep the static source-evidence screenshots directly below the demo as a still alternative.

### Quality

- Capture and inspect both product states from the pinned Hono example; keep the optimized README animation below 300 KB.

## [2.32.0] - 2026-09-28

### Improved

- Make “Map your repository” the green primary hero action, with the Hono example directly beside it.
- Lead the README action row with “Paste a repo” and keep the live map as the second path.

### Quality

- Verify both site and README put the user's repository analysis first.

## [2.31.0] - 2026-09-28

### Improved

- Make the repository-star action explicit in the landing-page header and use a compact star mark on narrow screens.
- Add a live GitHub stars badge in the README, linked to the stargazers page.

### Quality

- Verify the star action and badge link to the correct repository.

## [2.30.0] - 2026-09-28

### Improved

- Add a restrained staggered hero entrance and one-time scroll reveals for the showcase and feature sections.
- Keep every section visible without JavaScript support and disable entrance/reveal motion when reduced motion is requested.

### Quality

- Verify the landing page motion remains gated by `prefers-reduced-motion` and progressive enhancement.

## [2.29.0] - 2026-09-28

### Added

- Copy a share link for a browser map that pins the repository to its exact analyzed commit and preserves whether tests were included.
- Open shared links directly into the browser analysis flow; reject malformed commit IDs and keep local-folder maps unshareable.

### Quality

- Verify the commit pin travels through the worker to the GitHub analyzer and that shared snapshots read source only from the requested commit.

## [2.28.0] - 2026-09-28

### Improved

- Make the repository URL form build the interactive browser map directly, including on Enter; keep local-folder and CLI workflows as clear alternatives.
- Hide the generated CLI command until requested, so the primary path stays focused on understanding the repository.

### Quality

- Verify the homepage exposes browser analysis as its primary submit action and retains a distinct CLI option.

## [2.27.0] - 2026-09-28

### Added

- Add opt-in `repoatlas init --with-workflow` to create a minimal read-only pull-request workflow that compares to the PR base and enforces the generated rules.
- Validate generated config/workflow paths remain within the selected repository and protect all generated files from accidental overwrite.

### Quality

- Verify generated workflow triggers, read-only permissions, pinned checkout, versioned RepoAtlas Action, rule config, artifact, and path safety.

## [2.26.0] - 2026-09-28

### Added

- Add `repoatlas init` to create a conservative rule config and initial architecture snapshot in one command, with explicit output paths and overwrite protection.
- Start with zero newly introduced cycle groups or unreachable modules while leaving forbidden boundaries unset for project-specific review.

### Quality

- Verify initialized output through the CLI's own baseline check and test overwrite protection and mixed TypeScript/JavaScript projects.

## [2.25.0] - 2026-09-28

### Improved

- Pin cycle violations to the detected internal import lines and newly unreachable findings to their affected files in GitHub Actions annotations.
- Bound source annotations to 19 findings and report the number omitted, with full details remaining in the JSON result and architecture artifact.

### Quality

- Verify source locations, hostile path escaping, deterministic ordering, and annotation truncation.

## [2.24.0] - 2026-09-28

### Improved

- Update the live-site MCP and GitHub Action quick starts to v2.24. Show the optional baseline-aware `check-config` input and explain that the visual artifact remains available when rules fail.

### Quality

- Tie the published homepage install examples to the package release version in tests.

## [2.23.0] - 2026-09-28

### Added

- Add optional `check-config` support to the GitHub Action. Pull-request checks reuse the visual diff's exact base/head snapshots and emit annotations only for newly introduced architecture violations.
- Upload the architecture artifact before rule enforcement so it remains available when a check fails.

### Quality

- Exercise the baseline-aware Action path in the GitHub Actions smoke workflow.

## [2.22.0] - 2026-09-28

### Added

- Add baseline-aware architecture checks so CI can report only newly introduced forbidden imports, dependency cycles, and unreachable modules while keeping existing debt visible.
- Explain baseline counts in text and JSON results, with unknown entry reachability preserved instead of guessed.

### Quality

- Verify unchanged debt, new violations, and unknown baseline reachability through the check API and CLI.

## [2.21.0] - 2026-09-28

### Improved

- Draw the detected-entry path as a semantic route rail with distinct entry/change nodes and one exact source link per import hop.
- Keep long-path omissions visible in sequence, preserve native disclosure and ordered-list navigation, and animate only when reduced motion is not requested.

### Quality

- Verify route order, base/head commit links, omitted-hop labels, responsive layout, and reduced-motion styling.

## [2.20.0] - 2026-09-28

### Added

- Trace changed modules back to detected entry points in base and head snapshots using deterministic shortest resolved-import paths.
- Include exact evidence links for every path hop in JSON, CLI text, offline HTML, and GitHub Actions summaries.
- Mark entry reachability unknown when no entry point was detected, list changed modules outside detected paths, and cap large reports.

### Quality

- Reuse a single breadth-first graph walk for all changed modules per snapshot; cover cycles, path tie-breaking, unknown entry sets, and report bounds.

## [2.19.0] - 2026-09-28

### Added

- Compare explicit named/default import and re-export bindings when a dependency edge remains stable, including alias changes and exact source links.
- Report legacy snapshots without import-binding index metadata as unavailable rather than inferring no changes.
- Include binding changes in JSON, text, standalone HTML, and GitHub Actions summaries.

### Quality

- Verify stable line-shift behavior, alias changes, legacy snapshots, schema validation, and escaped offline HTML.

## [2.18.0] - 2026-09-28

### Added

- Search interactive maps by statically imported TypeScript names and local aliases, and show the exact import line beside matching modules.
- Add bounded MCP `search_imports` results for direct named/default imports and re-exports with resolved target modules.
- Keep namespace access, computed imports, and function call sites outside the symbol-search claim.

### Quality

- Test imported names, aliases, exact source records, external-edge exclusion, and MCP truncation.

## [2.17.0] - 2026-09-28

### Improved

- Paginate long export import-site lists in accessible 20-item pages instead of hiding sites after the first 20.
- Announce the visible range and page position; disable previous/next controls at either boundary.

### Quality

- Test empty, short, multi-page, clamped, and invalid pagination windows.

## [2.16.0] - 2026-09-28

### Added

- Show direct named/default import and re-export sites for each public TypeScript export, with exact source lines.
- Record imported/exported symbol bindings in snapshots and expose them in the interactive module inspector.
- Limit claims to explicit static bindings; namespace access and computed dynamic imports remain outside this evidence.

### Fixed

- Make the release workflow safely upload or replace its package asset when a tagged release already exists.

### Quality

- Test import aliases, default and type imports, re-export aliases, and source-backed consumer navigation.

## [2.15.0] - 2026-09-28

### Added

- Search the interactive architecture map by module path or exported TypeScript name, alias, re-export source, and kind.
- Show matching export names and exact lines inline with filtered modules so selecting a result opens its existing source-backed export list.
- Keep path search available for older snapshots without export metadata.

### Quality

- Test case-insensitive export search, aliases, re-export sources, and legacy snapshot behavior.

## [2.14.0] - 2026-09-28

### Added

- Compare public TypeScript exports across snapshots and report added or removed names, aliases, and re-export targets with exact line links.
- Include export-surface changes in JSON, text, and offline HTML reports, including CI-generated comparison artifacts.
- Mark modules whose snapshots do not contain export metadata instead of inferring that no exports changed.

### Quality

- Ignore source line shifts when export identity is unchanged and test pinned base/head links, re-export changes, legacy snapshots, and safe HTML.

## [2.13.0] - 2026-09-28

### Added

- Show each module's static TypeScript export surface with exact line links, including aliases and re-exports.
- Add bounded MCP `search_exports` and include export evidence in focused module context.
- Preserve compatibility with snapshots created before export metadata was recorded.

### Quality

- Test TypeScript declarations, destructured variables, aliases, default exports, namespace re-exports, bounded search, and line evidence.

## [2.12.0] - 2026-09-28

### Added

- Add the bounded `module_context` MCP tool to return module metadata, direct import evidence, and its detected-entry path in one call.
- Report complete edge totals and explicit truncation while preserving exact source lines and commit-pinned links.
- Teach the installable agent skill to select the smallest MCP query for each task instead of always loading a repository summary.

### Quality

- Cover tool discovery, bounded import evidence, exact path lines, unreachable modules, and missing module errors in the MCP protocol test.

## [2.11.0] - 2026-09-28

### Added

- Turn shortest detected-entry paths into a guided, keyboard-friendly walkthrough, one module and import at a time.
- Highlight the current connection, show its exact source line, and link to the pinned GitHub line when available.
- Animate the active path edge while respecting reduced-motion preferences.

### Quality

- Validate walkthrough stops against the resolved path so inconsistent evidence is rejected.
- Test progress clamping, adjacent source edges, and entry-only paths.

## [2.10.0] - 2026-09-28

### Added

- Package RepoAtlas as an installable coding-agent skill for Codex and other supported agents.
- Guide agents to use existing MCP tools or the local CLI to map real TypeScript projects, inspect workspace imports, and cite exact source lines.
- Keep a no-write default and separate static import evidence from runtime behavior.

### Quality

- Validate skill frontmatter and verify installation in an isolated directory with the `skills` CLI.
- Document the one-command install path and add the skills.sh discovery badge.

## [2.9.0] - 2026-09-28

### Added

- Add an opt-in `--activity-days` lens for local Git history and CLI-cloned public repositories.
- Color modules by committed file-change frequency, show each module's last changed date, and keep the history window visible in the standalone map.
- Bound the scan to 2,000 commits and 365 days, omit author identities, and label shallow or capped history.

### Quality

- Test time-window filtering, filenames with spaces, shallow-history metadata, commit caps, and invalid/non-Git inputs.
- Keep activity metadata additive and optional in snapshots; animate the lens with reduced-motion support.

## [2.8.0] - 2026-09-28

### Added

- Run public-repository and private-folder browser analysis in a dedicated Web Worker so the map page remains responsive.
- Keep progress updates flowing while analysis runs and stop CPU and network work immediately when canceled.
- Preserve relative paths when local `File` objects cross the worker boundary.

### Quality

- Verify the pinned TypeScript compiler's SHA-384 digest inside the worker before loading it.
- Test worker progress, successful results, errors, cancellation, and local path transfer; exercise both browser input modes against real projects.

## [2.7.0] - 2026-09-28

### Added

- Resolve declared npm/Yarn and pnpm workspace package imports to included TypeScript source in browser maps.
- Honor package export roots, wildcard subpaths, and compiler conditions; add workspace metadata so package-boundary views group files correctly.
- Leave duplicate workspace names unresolved with a warning and ignore undeclared nested packages.

### Quality

- Fetch nested package manifests and `pnpm-workspace.yaml` within browser byte and manifest limits.
- Test public and local workspace resolution, source evidence, exclusions, wildcard exports, and ambiguity handling.


## [2.6.0] - 2026-09-28

### Added

- Analyze a private or unpushed TypeScript project by selecting its local folder in the browser; no repository files are uploaded.
- Reuse the same TypeScript compiler settings, path-alias resolver, dependency visitor, interactive map, and standalone HTML export for local folders.
- Set browser limits before reading files, skip oversized files and declarations, and keep tests excluded unless requested.

### Quality

- Test local source evidence, path aliases, private-source URL omission, test/declaration filtering, and file/byte limits.
- Exercise folder selection, map rendering, and offline export in a real browser.


## [2.5.0] - 2026-09-28

### Added

- Analyze a public TypeScript GitHub repository in the browser and open the same interactive, commit-pinned source map without installing RepoAtlas.
- Reuse the TypeScript AST syntax visitor across CLI and browser analysis; keep repository source in the browser and download the result as a standalone HTML file.
- Show progress, cancellation, test-file opt-in, API rate-limit guidance, and explicit browser size limits.

### Quality

- Test public URL validation, TypeScript path aliases, exact source evidence, GitHub commit pinning, rate limits, truncated trees, and cancellation.
- Bundle the shared map UI and syntax visitor into deterministic GitHub Pages assets.

## [2.4.0] - 2026-09-28

### Added

- Add an evidence-count summary and direct HTML artifact link to GitHub Actions job summaries for pull-request architecture comparisons.
- Keep summary generation read-only and omit arbitrary repository/source text from Markdown output.

### Quality

- Test count rendering, commit labels, artifact URL validation, and job-summary file integration.
- Verify the composite action writes a summary when running its pull-request smoke test.

## [2.3.0] - 2026-09-28

### Added

- Export a compact, accessible README SVG card with module, entry-point, resolved-import, and dependency-cycle counts.
- Add a pinned GitHub Actions workflow that refreshes the card through a reviewable pull request.

### Quality

- Test deterministic SVG output, escaped repository names, static-analysis caveats, CLI validation, and overwrite protection.

## [2.2.0] - 2026-09-28

### Added

- Expose the local architecture graph through MCP stdio tools for summaries, module search, direct import evidence, entry paths, and refresh.
- Keep agent context read-only and repository-scoped; include exact source lines and commit-pinned URLs when available.
- Document an MCP client setup and add a dedicated agent-context section to the project site.
- Build the CLI when installing directly from a GitHub tag and add a distinct `repoatlas-cli` binary for version-selected `npx` runs.

### Quality

- Exercise MCP initialization, tool discovery, analysis, evidence, refresh-after-edit behavior, and protocol-only stdout in an integration test.
- Pin the official MCP server SDK and Zod runtime versions.

## [2.1.0] - 2026-09-28

### Added

- Generate a standalone architecture diff in GitHub Actions by comparing a pull request with its base commit.
- Keep source links pinned to the exact revision and upload the report as a workflow artifact with read-only repository access.
- Add a reduced-motion-aware hover cue to architecture diff rows.

### Quality

- Smoke-test both the released map action and the pull request diff mode.
- Verify generated diffs name the base and head commits; test motion preferences in the offline renderer.

## [2.0.0] - 2026-09-27

### Added

- Add a package and top-level directory overview ranked by dependency connections, with drill-down into each module graph.
- Trace every cross-package count to its contributing import statements and exact source lines.
- Export snapshot comparisons as a searchable, filterable standalone HTML report with commit-pinned source links.
- Ship the first-party RepoAtlas 1.10 → 2.0 comparison as a live, reproducible example.
- Publish a versioned GitHub release workflow that runs tests and compiler checks and attaches the installable package tarball.

### Compatibility

- Preserve the v1 snapshot format and all existing CLI defaults. The compare HTML format is opt-in with `--format html --output <file>`.
- Keep TypeScript 6 as the runtime compiler until TypeScript 7.1 exposes a stable programmatic API.

### Quality

- Test group ranking, import-site counts, snapshot diff rendering, safe source links, and no-overwrite behavior.
- Browser-check package drill-down, line-level evidence, search, and diff filters.
- Run tests on Node.js 22 and 24 across Linux, macOS, and Windows, plus stable TypeScript 7 CLI validation.
- Make `npm run examples` fetch the exact commits from the example manifest, keeping screenshots, counts, and source links reproducible.

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
