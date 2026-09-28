<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/banner-dark.svg">
    <img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/banner-light.svg" alt="RepoAtlas — trace imports and verify every edge in a clickable TypeScript architecture map" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/maximilianfeix/repoatlas/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/maximilianfeix/repoatlas?style=for-the-badge&label=release&color=92EDC7&labelColor=0B0E14"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/maximilianfeix/repoatlas?style=for-the-badge&color=F4D36B&labelColor=0B0E14"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/actions/workflows/ci.yml"><img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/maximilianfeix/repoatlas/ci.yml?branch=main&label=tests&style=for-the-badge&color=92EDC7&labelColor=0B0E14"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://img.shields.io/github/actions/workflow/status/maximilianfeix/repoatlas/codeql.yml?branch=main&label=CodeQL&style=for-the-badge&color=B4A0FF&labelColor=0B0E14"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/blob/main/LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/maximilianfeix/repoatlas?style=for-the-badge&color=92EDC7&labelColor=0B0E14"></a>
  <a href="https://skills.sh/maximilianfeix/repoatlas"><img alt="RepoAtlas agent skill installs" src="https://skills.sh/b/maximilianfeix/repoatlas"></a>
</p>

<p align="center">
  <a href="https://maximilianfeix.github.io/repoatlas/#make-a-map"><img src="https://img.shields.io/badge/PASTE%20A%20REPO-92EDC7?style=for-the-badge&logo=typescript&logoColor=0B0E14&labelColor=0B0E14" alt="Analyze a repository in your browser"></a>
  <a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="https://img.shields.io/badge/OPEN%20LIVE%20MAP-B4A0FF?style=for-the-badge&logo=github&logoColor=0B0E14&labelColor=0B0E14" alt="Open the interactive Hono map"></a>
  <a href="#github-actions"><img src="https://img.shields.io/badge/ADD%20TO%20CI-92EDC7?style=for-the-badge&logo=githubactions&logoColor=0B0E14&labelColor=0B0E14" alt="Jump to GitHub Actions"></a>
</p>

<p align="center"><a href="https://maximilianfeix.github.io/repoatlas/#make-a-map">Browser map</a> &nbsp;·&nbsp; <a href="#quickstart">CLI</a> &nbsp;·&nbsp; <a href="#what-the-map-shows">What you can explore</a> &nbsp;·&nbsp; <a href="#mcp-server">Coding agents</a> &nbsp;·&nbsp; <a href="#scope-and-privacy">Scope &amp; privacy</a></p>

<details>
  <summary><strong>Contents</strong></summary>

- [See the map](#a-real-map-not-a-mockup)
- [Quickstart](#quickstart)
- [GitHub Actions](#github-actions)
- [MCP server](#mcp-server)
- [Agent skill](#install-the-repoatlas-agent-skill)
- [What the map shows](#what-the-map-shows)
- [Features](#features)
- [Compare snapshots](#compare-snapshots)
- [Enforce boundaries in CI](#enforce-boundaries-in-ci)
- [Scope and privacy](#scope-and-privacy)
- [Contribute](#contribute)
</details>

RepoAtlas turns a TypeScript repository into a map you can investigate. Follow an import across modules, click the connection, and inspect the exact source line that created it. Export the result as one offline HTML file and share the architecture with your team.

<p align="center">
  <a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html#edge-source=benchmarks%2Fjsx%2Fsrc%2Fbenchmark.ts&amp;edge-line=3&amp;edge-specifier=.%2Fhono&amp;edge-kind=import"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/readme-demo.gif" alt="RepoAtlas opens the Hono architecture map, then a selected connection reveals its exact import statement and a link to line 3 of the pinned GitHub source" width="100%"></a>
</p>

<p align="center"><sub>One real interaction, captured from the Hono map below. Select a connection; verify the import at its source line.</sub></p>

## A real map, not a mockup

<p align="center">
  <a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/bundled-import-evidence.png" alt="Interactive architecture map generated from Hono: a selected bundled connection exposes four clickable import locations in the source inspector" width="100%"></a>
</p>

<p align="center"><sub>In this Hono snapshot, one bundled edge represents four imports. Select it to inspect each location.</sub></p>

<p align="center">
  <img alt="Modules" src="https://img.shields.io/badge/247-MODULES-92EDC7?style=flat-square&labelColor=151B25">
  <img alt="Connections" src="https://img.shields.io/badge/676-CONNECTIONS-B4A0FF?style=flat-square&labelColor=151B25">
  <img alt="Entry points" src="https://img.shields.io/badge/65-ENTRY%20POINTS-92EDC7?style=flat-square&labelColor=151B25">
</p>

<p align="center"><sub>Counts from <a href="https://github.com/honojs/hono/tree/52f6c7ec865b31001a14eed9b323a0235f0a3156">Hono commit 52f6c7e</a>; regenerate with the pinned revision in <a href="docs/examples/manifest.json">the demo manifest</a>.</sub></p>

<p align="center"><sub>Try two more pinned projects: <a href="https://maximilianfeix.github.io/repoatlas/examples/zustand.html">Zustand · state management · 18 modules</a> &nbsp;·&nbsp; <a href="https://maximilianfeix.github.io/repoatlas/examples/ky.html">Ky · HTTP client · 51 modules</a></sub></p>

## Quickstart

Want to explore before installing? [Paste a public TypeScript repository or choose a local project folder](https://maximilianfeix.github.io/repoatlas/#make-a-map). A background worker analyzes the source while the page stays responsive and reports progress; cancel stops that worker immediately. Copy a link pinned to the exact public commit to share a reproducible analysis, or download one offline HTML file. Local folders work for private or unpushed projects; no account, token, Node.js, or RepoAtlas server is involved. Browser analysis supports up to 1,200 files, 25 MB total, and 1 MB per file; use the CLI for larger projects.

For a versioned command-line run, install nothing globally. The CLI requires **Node.js 22 or later** and **Git**. Point it at a public GitHub repository:

```sh
npx --yes --package=github:maximilianfeix/repoatlas#v2.39.0 -- \
  repoatlas-cli https://github.com/pmndrs/zustand --out zustand-map.html
```

Open `zustand-map.html` in your browser. Search by module path or public export, then select a result to inspect its exact source evidence. RepoAtlas also analyzes a local checkout:

```sh
npx --yes --package=github:maximilianfeix/repoatlas#v2.39.0 -- \
  repoatlas-cli ./my-project --out architecture.html
```

It downloads the versioned CLI from GitHub. The `repoatlas-cli` alias ensures `npx` uses the selected release even when another `repoatlas` is installed globally. No global install, API key, or token for a public repository is needed.
Each GitHub release also includes an installable `.tgz` package for direct downloads or private registries.

## Share an architecture card

Create a compact SVG for a README or project page from a RepoAtlas JSON snapshot:

```sh
repoatlas-cli https://github.com/pmndrs/zustand --json > architecture.json
repoatlas-cli report architecture.json --format card --output docs/architecture.svg
```

The card summarizes modules, detected entry points, resolved static imports, and dependency cycles. It is deterministic, contains no scripts or external requests, and states that it does not describe runtime behavior. Use `--overwrite` to replace an existing card. The [refresh workflow](.github/workflows/architecture-card.yml) shows how to regenerate a checked-in card through a reviewable pull request.

<p align="center"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/architecture-card.svg" alt="RepoAtlas architecture summary for its own TypeScript source: module, entry point, resolved import, and cycle counts" width="720"></p>

## GitHub Actions

Build the map on every push and keep it as a downloadable workflow artifact:

```yaml
name: Architecture map
on: [push]
permissions:
  contents: read
jobs:
  map:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: maximilianfeix/repoatlas@v2.39.0
        with:
          output: repoatlas-map.html
```

For pull requests, set `compare-to` to the base commit SHA to make the artifact a source-linked architecture diff. RepoAtlas adds module, import, named/default binding, export, and detected-entry reachability counts with a direct artifact link to the GitHub Actions job summary. Binding changes describe explicit TypeScript import syntax; entry paths describe static reachability. Neither establishes runtime calls or behavior, and export changes do not establish package entry-point accessibility or type compatibility. This uses only `contents: read`; it does not post a comment or need a write token.

```yaml
name: Architecture review
on: [pull_request]
permissions:
  contents: read
jobs:
  architecture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: maximilianfeix/repoatlas@v2.39.0
        with:
          compare-to: ${{ github.event.pull_request.base.sha }}
          check-config: repoatlas.config.json
          output: architecture-diff.html
          artifact-name: architecture-diff
```

Download `architecture-diff` from the workflow run to explore added and removed modules, imports, imported names, public exports, and shortest routes from detected entries; each link points to the exact base or head line. With `check-config`, the action applies the configured architecture rules to the same base/head snapshots and annotates only new violations. Forbidden imports and detected cycle edges link to exact source lines; newly unreachable modules link to their files. Large findings are capped with an explicit annotation omission count. The artifact uploads before the check, so it remains available when a rule fails. Without `compare-to`, the config checks the current snapshot against absolute limits. Older snapshots without binding or export indexes are marked unavailable instead of being treated as unchanged. Reports describe syntax and static reachability, not runtime calls, TypeScript assignability, or semver safety. The action accepts `path`, `compare-to`, `check-config`, `artifact-name`, `retention-days`, `include-tests`, and `include-js`. It needs read-only repository access and no token input. Maps and diffs include project paths and source snippets, so restrict artifacts from private repositories.

## MCP server

Give a coding agent a local architecture map it can query while it works. RepoAtlas exposes deterministic tools over MCP stdio; the server does not send source to a hosted service, write to the repository, or make network requests after launch. Your MCP client sends returned context to the model provider configured for that client.

Add this server entry to an MCP client configuration and replace the project path with an absolute path:

```json
{
  "mcpServers": {
    "repoatlas": {
      "command": "npx",
      "args": [
        "--yes",
        "--package=github:maximilianfeix/repoatlas#v2.39.0",
        "repoatlas-cli",
        "mcp",
        "/absolute/path/to/project"
      ]
    }
  }
}
```

The tools summarize architecture, search modules, public TypeScript exports, and direct imported names or aliases, inspect direct-import evidence, bundle a module's imports, exports, and detected-entry path through `module_context`, trace paths, and refresh analysis after edits. Results are bounded and expose totals and truncation. Exports and edges include exact source lines; neither is a claim about runtime behavior or call sites. The server requires Node.js 22 or later and analyzes TypeScript by default. Use `--include-js` or `--include-tests` after `mcp` to opt in to those files.

### Install the RepoAtlas agent skill

Give a coding agent RepoAtlas's evidence-first workflow with one command:

```sh
npx skills add maximilianfeix/repoatlas --skill repoatlas --agent codex --yes
```

The skill uses a configured RepoAtlas MCP server when available and otherwise guides the agent to the local CLI or browser map. It keeps source evidence grounded in TypeScript files, distinguishes imports from runtime behavior, and does not install packages or write into a project on its own. Replace `codex` with another supported agent name to target that agent.

## What the map shows

Each example below was generated from a pinned upstream commit. The counts and evidence can be reproduced from the source revision.

| Project snapshot | Modules | Connections | Useful views |
| --- | ---: | ---: | --- |
| [RepoAtlas 1.10 → 2.0](https://github.com/maximilianfeix/repoatlas/compare/ee977687527b806925ff2a31f2311dce65d320ad...95bded201295c1c4b4e2330263fc26060c641073) | 15 → 17 | 29 → 34 | [Open the real HTML diff](https://maximilianfeix.github.io/repoatlas/examples/repoatlas-v1-to-v2.html) · added modules and imports |
| [honojs/hono](https://github.com/honojs/hono/tree/52f6c7ec865b31001a14eed9b323a0235f0a3156) | 247 | 676 | [Open map](https://maximilianfeix.github.io/repoatlas/examples/hono.html) · entry paths, cycles, export and import-symbol search |
| [sindresorhus/ky](https://github.com/sindresorhus/ky/tree/0d59458a0a58e1c3d7c6db0ab17ed5c7cd671e47) | 51 | 93 | [Open map](https://maximilianfeix.github.io/repoatlas/examples/ky.html) · external packages, import sites |
| [pmndrs/zustand](https://github.com/pmndrs/zustand/tree/b57db4f86ef179285da216eeb291266da82c361c) | 18 | 24 | [Open map](https://maximilianfeix.github.io/repoatlas/examples/zustand.html) · workspace boundaries |

<table>
  <tr>
    <td width="50%" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/entry-path-trace.png" alt="A highlighted shortest import path from a detected Hono entry point to a selected module" width="100%"></a><sub>Find the shortest detected path to a module.</sub></td>
    <td width="50%" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/guided-entry-tour.png" alt="Guided Hono entry-path stop showing the exact import line, pinned GitHub link, and previous or next controls" width="100%"></a><sub>Walk the path one import at a time and inspect its exact source line.</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/package-overview.png" alt="The package overview for Hono ranks source directories by dependency connections and shows cross-package import counts" width="100%"></a><sub>Start broad, then drill into a package or inspect its source imports.</sub></td>
    <td width="50%" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/boundary-matrix-preview.png" alt="A directory boundary matrix showing source-backed imports between parts of Hono" width="100%"></a><sub>See which package and directory boundaries imports cross.</sub></td>
  </tr>
  <tr>
    <td colspan="2" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/repoatlas-v1-to-v2.html"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/architecture-diff.png" alt="A searchable architecture comparison between real RepoAtlas v1.10 and v2 snapshots, showing added modules and imports" width="100%"></a><sub>A real RepoAtlas 1.10 → 2.0 comparison. Expand an import to trace its source line in the pinned snapshot.</sub></td>
  </tr>
  <tr>
    <td colspan="2" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html#module=src%2Fadapter%2Faws-lambda%2Fhandler.ts"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/export-surface.png" alt="The Hono module inspector lists exported TypeScript names with links to exact lines in the pinned GitHub source" width="100%"></a><sub>Inspect a file's public API and jump straight to each export in the pinned source.</sub></td>
  </tr>
  <tr>
    <td colspan="2" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html#module=src%2Fhono.ts"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/export-import-sites.png" alt="The Hono export inspector shows 18 direct named imports of Hono, each linked to the precise importing line" width="100%"></a><sub>Open an export's direct import sites, then click any result to inspect its exact import statement and pinned source line.</sub></td>
  </tr>
  <tr>
    <td colspan="2" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html#module=src%2Fcontext.ts"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/export-import-pagination.png" alt="The Hono Context export inspector paginates 39 direct import sites and shows its current range and page controls" width="100%"></a><sub>Large symbol histories stay navigable with bounded pages and clear previous/next controls.</sub></td>
  </tr>
  <tr>
    <td colspan="2" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html#module=src%2Fadapter%2Faws-lambda%2Fconninfo.ts"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/import-search.png" alt="Searching Context in the Hono map lists modules that import it, with each exact line and the selected module's named import evidence" width="100%"></a><sub>Find importers by symbol or local alias; open a module to inspect its incoming named bindings.</sub></td>
  </tr>
  <tr>
    <td colspan="2" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/export-search.png" alt="Searching Hono in the module explorer shows matching exported symbols and their source lines, with the selected export linked in the inspector" width="100%"></a><sub>Find an exported symbol in the map, then open its source line from the selected module.</sub></td>
  </tr>
  <tr>
    <td colspan="2" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/repoatlas-v2.12-to-v2.13.html"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/public-export-diff.png" alt="A snapshot comparison showing added TypeScript exports with exact line links" width="100%"></a><sub>Review export-surface changes beside ordinary module and import drift.</sub></td>
  </tr>
</table>

The analyzed revisions and upstream license notices are recorded in [`docs/examples/manifest.json`](docs/examples/manifest.json) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

The RepoAtlas comparison uses real snapshots from [v1.10.0](https://github.com/maximilianfeix/repoatlas/tree/ee977687527b806925ff2a31f2311dce65d320ad) and [the v2 feature commit](https://github.com/maximilianfeix/repoatlas/tree/95bded201295c1c4b4e2330263fc26060c641073). Its source links are pinned to those commits.

## Features

<table>
  <tr>
    <td width="50%" valign="top"><strong>Trace every connection</strong><br>Open the import statement and exact line behind an edge. Bundled imports keep every individual location; clean checkouts link to the pinned source on GitHub.</td>
    <td width="50%" valign="top"><strong>Start in the browser</strong><br>Paste a public GitHub URL or choose a private local folder. A cancellable background worker keeps the page responsive and shows progress. Inspect the interactive map and download a standalone HTML file; project source stays on your device.</td>
    <td width="50%" valign="top"><strong>Find a module, export, or import</strong><br>Search by file path, exported name, imported name, or local alias. Matching symbol bindings and exact lines appear with each module result.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><strong>Follow an export to its import sites</strong><br>Browse each file's TypeScript exports and inspect direct named/default imports and re-exports with exact source lines. Long lists paginate; click a site to read the import statement and open the pinned GitHub line.</td>
    <td width="50%" valign="top"><strong>Read workspace boundaries</strong><br>Start with a ranked package and directory overview, then drill into a package or open any import count to inspect its exact source lines. Resolve declared npm, Yarn, and pnpm workspace packages through export maps in CLI and browser analysis.</td>
    <td width="50%" valign="top"><strong>See active hotspots</strong><br>Optionally color modules by bounded local Git history, with committed touch counts and the last changed date. No author identities, risk grades, or implicit history scan.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><strong>Catch architecture drift</strong><br>Compare JSON snapshots to find changed modules, dependencies, and import specifiers. Export the comparison as a searchable standalone HTML report with source links. Formatting and line shifts alone do not count as drift.</td>
    <td width="50%" valign="top"><strong>Gate architecture in CI</strong><br>Check forbidden boundaries, dependency cycles, and unreachable modules in the CLI or GitHub Action. Baseline mode lets you adopt rules gradually, with source-linked annotations for new drift.</td>
    <td width="50%" valign="top"><strong>Share a portable map</strong><br>Export one offline HTML file, the full JSON snapshot, a boundary SVG, or a concise CI report. The viewer makes no network requests.</td>
  </tr>
</table>

### See where development is active

An optional local Git history lens colors modules by committed file touches, shows the last changed date, and keeps the period visible in the map. It records no author names and does not turn activity into a risk or quality score. GitHub URL analysis fetches at most 2,000 recent commits and counts only changes inside the selected window; shallow or capped history is labeled when that limit could omit data. This is available for Git repositories and is off by default.

```sh
repoatlas https://github.com/owner/repo --activity-days 90 --out activity-map.html
repoatlas ./my-project --activity-days 30 --out activity-map.html
```

Select **Activity** in the map toolbar, then choose a module to see its committed-change count and last changed date. The lens reflects committed history; uncommitted file content is still analyzed as usual.

### Compare snapshots

```sh
repoatlas ./my-project --json > before.json
# Update the checkout, then save the next snapshot.
repoatlas ./my-project --json > after.json
repoatlas compare before.json after.json
repoatlas compare before.json after.json --format html --output architecture-diff.html
```

Open `architecture-diff.html` to filter added, removed, and changed relationships, search paths or imports, and expand each dependency to its source line in both snapshots. The report tracks file-level TypeScript exports and explicit named/default import bindings, including renamed aliases, with exact lines. It also shows the shortest resolved-import route from a detected entry to each changed module, separately for base and head. If no entry is found, reachability is marked unknown; a module outside all detected routes is labeled unreachable. Large reports limit route lists and show the first and last 20 hops of longer paths with the skipped middle count. These are static facts, not runtime calls or semantic type compatibility; the report is a single offline file.

<p align="center"><a href="https://maximilianfeix.github.io/repoatlas/examples/entry-impact-diff.html"><img src="https://raw.githubusercontent.com/maximilianfeix/repoatlas/main/docs/assets/entry-impact-preview.png" alt="Architecture diff showing added and removed import bindings and separate base and head routes from the detected application entry to the changed module" width="100%"></a></p>
<p align="center"><sub><a href="https://maximilianfeix.github.io/repoatlas/examples/entry-impact-diff.html">Open the interactive example.</a> It uses illustrative snapshots; real repository reports link to their pinned source commits.</sub></p>

The [v2.12 → v2.13 comparison example](https://maximilianfeix.github.io/repoatlas/examples/repoatlas-v2.12-to-v2.13.html) shows a real source change with export evidence.

In the map, choose **Packages** for a ranked overview of workspace packages and top-level source directories. The dependency rows count resolved internal import sites; selecting a package opens its modules, and selecting a count lists every contributing source line. Use **Boundaries** for the full source-by-target matrix.

### Enforce boundaries in CI

Start with a checked-in rules template and a snapshot of the current repository:

```sh
repoatlas init ./my-project --with-workflow
```

This writes `repoatlas.config.json`, `repoatlas-baseline.json`, and `.github/workflows/repoatlas.yml` in the selected project directory. The generated workflow runs only for pull requests, compares against the PR base, uses `contents: read`, and uploads the HTML diff even when a rule fails. `--with-workflow` is optional if you prefer to add the Action yourself.

The starter policy allows zero new cycle groups and unreachable modules, and deliberately does not guess forbidden boundaries; edit `forbiddenImports` after reviewing the workspace matrix. Existing files are never replaced unless you pass `--force`. Use `--config-out`, `--baseline-out`, and `--workflow-out` for custom paths; generated workflow inputs must stay inside the project. Baseline snapshots include import snippets and file paths, so review them before committing or sharing.

Save rules in `repoatlas.config.json`:

```json
{
  "forbiddenImports": [
    { "from": "package:apps/web", "to": "package:packages/database" }
  ],
  "limits": {
    "cycleGroups": 0,
    "unreachableModules": 12
  }
}
```

Then generate and check a snapshot. Without a baseline, thresholds apply to the complete snapshot:

```sh
repoatlas ./my-project --json > atlas.json
repoatlas check atlas.json --config repoatlas.config.json --format github
```

To adopt rules in a repository with existing debt, keep the generated snapshot and compare each new snapshot against it:

```sh
repoatlas ./my-project --json > baseline.json
# Later, in CI, generate the current snapshot and check only new violations.
repoatlas ./my-project --json > head.json
repoatlas check head.json --baseline baseline.json --config repoatlas.config.json --format github
```

Baseline mode ignores forbidden imports already present, cycle groups already present, and modules already outside detected entry paths. The cycle and unreachable limits cap newly added groups or modules; existing debt remains visible in the text/JSON baseline summary. If the baseline has no detected entries, the unreachable-module comparison is unknown and never claims new orphan violations. Keep the baseline under review like other architecture policy files.

Boundary IDs use `package:<workspace path>` for declared workspace packages and `directory:<top-level source folder>` otherwise. If no entry point is detected, reachability remains unknown and does not fail the unreachable-module limit. Run `repoatlas check --help` for output formats; snapshot compatibility is documented in [`SCHEMA.md`](SCHEMA.md).

## Scope and privacy

RepoAtlas describes **static file dependencies**. It does not claim to show runtime calls, route registrations, or test coverage. It detects entries from package metadata and file conventions; “unreachable” means no path was found from detected entries, not that a file is dead. If entries are unknown, reachability remains unknown. Export import-site evidence covers explicit named/default static bindings; namespace and computed accesses are not attributed to individual exports, and imported names do not imply a call site. Computed imports stay visible as unresolved evidence rather than receiving guessed targets.

The CLI is limited to 5,000 source files and 2 MB per file. Tests, generated directories, declarations, and hidden files are excluded by default; use `--include-tests` or `--include-js` to opt in. Local edits disable commit-pinned GitHub links. Exported maps make no network requests and do not copy repository credentials.

The browser can analyze a public URL or a private local folder. Analysis runs in a dedicated worker, and canceling terminates that worker. Selected local source never leaves the browser; choose a folder explicitly, and review the exported snippets before sharing. Browser mode loads the version-pinned TypeScript compiler from jsDelivr, but sends it no project data.

Browser analysis is capped at 1,200 TypeScript files, 25 MB total, and 1 MB per file. For a public URL it fetches the tree and source from GitHub; for a private or unpushed project choose a local folder. In both cases, source files are analyzed in the browser and never sent to a RepoAtlas server. The version-pinned TypeScript compiler loads from jsDelivr; it receives no project data. GitHub allows 60 unauthenticated API requests per hour per IP. Maps contain source snippets, so share them only with people authorized to read that source.

## Contribute

```sh
git clone https://github.com/maximilianfeix/repoatlas.git
cd repoatlas
npm ci
npm test
npm run check
npm run check:ts7
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development notes and the [Code of Conduct](CODE_OF_CONDUCT.md) for community standards. Report bugs or suggest improvements in [GitHub Issues](https://github.com/maximilianfeix/repoatlas/issues). RepoAtlas is MIT licensed.
