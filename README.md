<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner-dark.svg">
    <img src="docs/assets/banner-light.svg" alt="RepoAtlas — trace imports and verify every edge in a clickable TypeScript architecture map" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/maximilianfeix/repoatlas/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/maximilianfeix/repoatlas?style=for-the-badge&label=release&color=92EDC7&labelColor=0B0E14"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/actions/workflows/ci.yml"><img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/maximilianfeix/repoatlas/ci.yml?branch=main&label=tests&style=for-the-badge&color=92EDC7&labelColor=0B0E14"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://img.shields.io/github/actions/workflow/status/maximilianfeix/repoatlas/codeql.yml?branch=main&label=CodeQL&style=for-the-badge&color=B4A0FF&labelColor=0B0E14"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/blob/main/LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/maximilianfeix/repoatlas?style=for-the-badge&color=92EDC7&labelColor=0B0E14"></a>
</p>

<p align="center">
  <a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="https://img.shields.io/badge/OPEN%20LIVE%20MAP-92EDC7?style=for-the-badge&logo=github&logoColor=0B0E14&labelColor=0B0E14" alt="Open the interactive Hono map"></a>
  <a href="#quickstart"><img src="https://img.shields.io/badge/BUILD%20YOUR%20MAP-B4A0FF?style=for-the-badge&logo=typescript&logoColor=0B0E14&labelColor=0B0E14" alt="Jump to quickstart"></a>
  <a href="#github-actions"><img src="https://img.shields.io/badge/ADD%20TO%20CI-92EDC7?style=for-the-badge&logo=githubactions&logoColor=0B0E14&labelColor=0B0E14" alt="Jump to GitHub Actions"></a>
</p>

<p align="center"><a href="#quickstart">Quickstart</a> &nbsp;·&nbsp; <a href="#what-the-map-shows">What you can explore</a> &nbsp;·&nbsp; <a href="#features">Features</a> &nbsp;·&nbsp; <a href="#scope-and-privacy">Scope &amp; privacy</a></p>

<details>
  <summary><strong>Contents</strong></summary>

- [See the map](#a-real-map-not-a-mockup)
- [Quickstart](#quickstart)
- [GitHub Actions](#github-actions)
- [What the map shows](#what-the-map-shows)
- [Features](#features)
- [Compare snapshots](#compare-snapshots)
- [Enforce boundaries in CI](#enforce-boundaries-in-ci)
- [Scope and privacy](#scope-and-privacy)
- [Contribute](#contribute)
</details>

RepoAtlas turns a TypeScript repository into a map you can investigate. Follow an import across modules, click the connection, and inspect the exact source line that created it. Export the result as one offline HTML file and share the architecture with your team.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme-flow.svg">
    <img src="docs/assets/readme-flow.svg" alt="Four steps: give RepoAtlas a GitHub repository or folder, resolve imports with static analysis, explore the interactive module map, and verify an edge against its exact source evidence" width="100%">
  </picture>
</p>

## A real map, not a mockup

<p align="center">
  <a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="docs/assets/bundled-import-evidence.png" alt="Interactive architecture map generated from Hono: a selected bundled connection exposes four clickable import locations in the source inspector" width="100%"></a>
</p>

<p align="center"><sub>In this Hono snapshot, one bundled edge represents four imports. Select it to inspect each location.</sub></p>

<p align="center">
  <img alt="Modules" src="https://img.shields.io/badge/247-MODULES-92EDC7?style=flat-square&labelColor=151B25">
  <img alt="Connections" src="https://img.shields.io/badge/676-CONNECTIONS-B4A0FF?style=flat-square&labelColor=151B25">
  <img alt="Entry points" src="https://img.shields.io/badge/65-ENTRY%20POINTS-92EDC7?style=flat-square&labelColor=151B25">
</p>

<p align="center"><sub>Counts from <a href="https://github.com/honojs/hono/tree/52f6c7ec865b31001a14eed9b323a0235f0a3156">Hono commit 52f6c7e</a>; regenerate with the pinned revision in <a href="docs/examples/manifest.json">the demo manifest</a>.</sub></p>

## Quickstart

Requires **Node.js 22 or later** and **Git**. Point RepoAtlas at a public GitHub repository:

```sh
npx --yes --package=github:maximilianfeix/repoatlas#v1.10.0 -- \
  repoatlas https://github.com/pmndrs/zustand --out zustand-map.html
```

Open `zustand-map.html` in your browser. RepoAtlas also analyzes a local checkout:

```sh
npx --yes --package=github:maximilianfeix/repoatlas#v1.10.0 -- \
  repoatlas ./my-project --out architecture.html
```

It downloads the versioned CLI from GitHub. No global install, API key, or token for a public repository is needed.

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
      - uses: maximilianfeix/repoatlas@v1.10.0
        with:
          output: repoatlas-map.html
```

The action accepts `path`, `artifact-name`, `retention-days`, `include-tests`, and `include-js`. It needs read-only repository access and no token input. Maps include project paths and source snippets, so restrict artifacts from private repositories.

## What the map shows

Each example below was generated from a pinned upstream commit. The counts and evidence can be reproduced from the source revision.

| Project snapshot | Modules | Connections | Useful views |
| --- | ---: | ---: | --- |
| [honojs/hono](https://github.com/honojs/hono/tree/52f6c7ec865b31001a14eed9b323a0235f0a3156) | 247 | 676 | [Open map](https://maximilianfeix.github.io/repoatlas/examples/hono.html) · entry paths, cycles, bundled imports |
| [sindresorhus/ky](https://github.com/sindresorhus/ky/tree/0d59458a0a58e1c3d7c6db0ab17ed5c7cd671e47) | 51 | 93 | [Open map](https://maximilianfeix.github.io/repoatlas/examples/ky.html) · external packages, import sites |
| [pmndrs/zustand](https://github.com/pmndrs/zustand/tree/b57db4f86ef179285da216eeb291266da82c361c) | 18 | 24 | [Open map](https://maximilianfeix.github.io/repoatlas/examples/zustand.html) · workspace boundaries |

<table>
  <tr>
    <td width="50%" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="docs/assets/entry-path-trace.png" alt="A highlighted shortest import path from a detected Hono entry point to a selected module" width="100%"></a><sub>Follow the shortest path from an entry point.</sub></td>
    <td width="50%" valign="top"><a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="docs/assets/boundary-matrix-preview.png" alt="A directory boundary matrix showing source-backed imports between parts of Hono" width="100%"></a><sub>See which package and directory boundaries imports cross.</sub></td>
  </tr>
</table>

The analyzed revisions and upstream license notices are recorded in [`docs/examples/manifest.json`](docs/examples/manifest.json) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Features

<table>
  <tr>
    <td width="50%" valign="top"><strong>Trace every connection</strong><br>Open the import statement and exact line behind an edge. Bundled imports keep every individual location; clean checkouts link to the pinned source on GitHub.</td>
    <td width="50%" valign="top"><strong>Get oriented quickly</strong><br>See detected entries, reachability, cycles, impact, external packages, and shortest entry paths. Share a focused view with a deep link.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><strong>Read workspace boundaries</strong><br>Resolve declared npm, Yarn, and pnpm workspace packages through export maps. Compare package or directory boundaries and inspect the imports behind each cell.</td>
    <td width="50%" valign="top"><strong>Catch architecture drift</strong><br>Compare JSON snapshots to find changed modules, dependencies, and import specifiers. Formatting and line shifts alone do not count as drift.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><strong>Set rules for CI</strong><br>Fail builds on forbidden boundaries, dependency cycles, or unreachable-module limits. Reports include the source file and line.</td>
    <td width="50%" valign="top"><strong>Share a portable map</strong><br>Export one offline HTML file, the full JSON snapshot, a boundary SVG, or a concise CI report. The viewer makes no network requests.</td>
  </tr>
</table>

### Compare snapshots

```sh
repoatlas ./my-project --json > before.json
# Update the checkout, then save the next snapshot.
repoatlas ./my-project --json > after.json
repoatlas compare before.json after.json
```

### Enforce boundaries in CI

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

Then generate and check a snapshot:

```sh
repoatlas ./my-project --json > atlas.json
repoatlas check atlas.json --config repoatlas.config.json --format github
```

Boundary IDs use `package:<workspace path>` for declared workspace packages and `directory:<top-level source folder>` otherwise. If no entry point is detected, reachability remains unknown and does not fail the unreachable-module limit. Run `repoatlas check --help` for output formats; snapshot compatibility is documented in [`SCHEMA.md`](SCHEMA.md).

## Scope and privacy

RepoAtlas describes **static file dependencies**. It does not claim to show runtime calls, route registrations, or test coverage. It detects entries from package metadata and file conventions; “unreachable” means no path was found from detected entries, not that a file is dead. If entries are unknown, reachability remains unknown. Computed imports stay visible as unresolved evidence rather than receiving guessed targets.

Analysis is limited to 5,000 source files and 2 MB per file. Tests, generated directories, declarations, and hidden files are excluded by default; use `--include-tests` or `--include-js` to opt in. Local edits disable commit-pinned GitHub links. The viewer makes no network requests and does not copy repository credentials. Maps include source snippets; share private-project maps only with people authorized to read that source.

## Contribute

```sh
git clone https://github.com/maximilianfeix/repoatlas.git
cd repoatlas
npm ci
npm test
npm run check
npm run check:ts7
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development notes. Report bugs or suggest improvements in [GitHub Issues](https://github.com/maximilianfeix/repoatlas/issues). RepoAtlas is MIT licensed.
