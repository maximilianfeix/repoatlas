<p align="center">
  <img src="docs/assets/repoatlas-logo.svg" alt="RepoAtlas" width="250">
</p>

<h1 align="center">Understand a codebase by following its imports.</h1>

<p align="center">Generate a clickable map of a TypeScript project. Select a connection to see the exact source line behind it.</p>

<p align="center">
  <a href="https://github.com/maximilianfeix/repoatlas/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/maximilianfeix/repoatlas?style=flat-square&label=release"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/actions/workflows/ci.yml"><img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/maximilianfeix/repoatlas/ci.yml?branch=main&label=tests&style=flat-square"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://img.shields.io/github/actions/workflow/status/maximilianfeix/repoatlas/codeql.yml?branch=main&label=CodeQL&style=flat-square"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/blob/main/LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/maximilianfeix/repoatlas?style=flat-square"></a>
  <img alt="Node.js 22+" src="https://img.shields.io/badge/Node.js-22%2B-43853d?style=flat-square&logo=node.js&logoColor=white">
</p>

<p align="center">
  <a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><strong>Open the Hono map</strong></a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#github-actions">GitHub Actions</a> ·
  <a href="#features">Features</a>
</p>

<p align="center">
  <a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="docs/assets/bundled-import-evidence.png" alt="Interactive Hono dependency map: select a bundled connection to inspect all four exact import locations" width="1000"></a>
</p>

<p align="center"><sub>One connector represents four imports. The inspector keeps all four source locations clickable.</sub></p>

<table align="center">
  <tr>
    <td align="center"><strong>247</strong><br><sub>modules mapped</sub></td>
    <td align="center"><strong>676</strong><br><sub>connections</sub></td>
    <td align="center"><strong>65</strong><br><sub>detected entry points</sub></td>
  </tr>
</table>

<p align="center"><sub>Measured from the <a href="https://github.com/honojs/hono/tree/52f6c7ec865b31001a14eed9b323a0235f0a3156">pinned Hono snapshot</a>. Counts describe that example, not a benchmark.</sub></p>

RepoAtlas reads source files without running the project. It resolves static TypeScript imports into a dependency graph and exports the result as one offline HTML file. Every resolved connection can be traced back to its import line; uncertain imports stay marked unresolved instead of being guessed.

## Quickstart

Requires **Node.js 22 or later** and **Git**. Generate a map from a public GitHub repository:

```sh
npx --yes --package=github:maximilianfeix/repoatlas#v1.10.0 -- repoatlas https://github.com/pmndrs/zustand --out zustand-map.html
```

Open `zustand-map.html` in a browser. To map a local checkout instead:

```sh
repoatlas ./my-project --out architecture.html
```

The first command installs the CLI from the versioned GitHub release. It needs no global install, API key, or access token for a public repository.

## GitHub Actions

Generate a map on each push. The HTML is uploaded as a workflow artifact:

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

The action accepts `path`, `artifact-name`, `retention-days`, `include-tests`, and `include-js`. It needs read-only repository access and does not require a token input. Maps contain project paths and source snippets; limit access to artifacts built from private repositories.

## Explore real projects

Each demo is generated from a pinned source commit, so its counts and import evidence are reproducible.

| Project snapshot | Modules | Connections | What to explore |
| --- | ---: | ---: | --- |
| [honojs/hono](https://github.com/honojs/hono/tree/52f6c7ec865b31001a14eed9b323a0235f0a3156) | 247 | 676 | [Open map](https://maximilianfeix.github.io/repoatlas/examples/hono.html) · entry paths, cycles, boundaries |
| [sindresorhus/ky](https://github.com/sindresorhus/ky/tree/0d59458a0a58e1c3d7c6db0ab17ed5c7cd671e47) | 51 | 93 | [Open map](https://maximilianfeix.github.io/repoatlas/examples/ky.html) · external packages, import sites |
| [pmndrs/zustand](https://github.com/pmndrs/zustand/tree/b57db4f86ef179285da216eeb291266da82c361c) | 18 | 24 | [Open map](https://maximilianfeix.github.io/repoatlas/examples/zustand.html) · workspace boundaries |

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="docs/assets/entry-path-trace.png" alt="A four-module Hono entry path, highlighted from its detected entry point to the selected module" width="100%"></a>
      <sub>Trace a shortest import path from an entry point.</sub>
    </td>
    <td width="50%" valign="top">
      <a href="https://maximilianfeix.github.io/repoatlas/examples/hono.html"><img src="docs/assets/boundary-matrix-preview.png" alt="Hono directory boundary matrix with source-backed import counts" width="100%"></a>
      <sub>Compare imports across workspace and directory boundaries.</sub>
    </td>
  </tr>
</table>

The analyzed commits and upstream license notices are recorded in [`docs/examples/manifest.json`](docs/examples/manifest.json) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Features

| Capability | What it helps you do |
| --- | --- |
| **Follow the evidence** | Inspect the import statement and line behind a connection, with a commit-pinned source link when the checkout is clean. Bundle repeated imports without losing individual locations. |
| **Read the project shape** | Explore entry points, reachability, cycles, impact, external packages, and shortest entry paths. Share direct links to modules, packages, and import evidence. |
| **Understand monorepos** | Resolve declared npm, Yarn, and pnpm workspace packages through their export maps. Compare package or directory boundaries and inspect the imports in each cell. |
| **Track architecture change** | Compare JSON snapshots to find changed modules, dependencies, and import specifiers. Formatting and line shifts alone do not count as drift. |
| **Set architecture rules** | Fail CI on forbidden boundaries, dependency cycles, or unreachable-module limits. Reports include source files and line numbers. |
| **Navigate large projects** | Search, filter, page through modules, group by package or directory, and jump with the overview. The graph works with mouse and keyboard. |
| **Keep the result portable** | Export a single offline HTML map, the full JSON snapshot, a boundary SVG, or a concise CI report. |

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

Boundary IDs use `package:<workspace path>` for declared workspace packages and `directory:<top-level source folder>` otherwise. If no entry point is detected, reachability remains unknown and does not fail the unreachable-module limit. Run `repoatlas check --help` for output formats and options; snapshot compatibility is documented in [`SCHEMA.md`](SCHEMA.md).

## Scope and privacy

RepoAtlas reports **static file dependencies**, not runtime calls, route registrations, or test coverage. Entry-point detection uses package metadata and file conventions; an unreachable module means no path was found from detected entries, not that the file is dead. When entry points are unknown, RepoAtlas does not claim modules are unreachable. Computed imports remain visible as unresolved evidence, and their targets are never inferred.

Analysis is limited to 5,000 source files and 2 MB per file. Tests, generated directories, declarations, and hidden files are excluded by default; use `--include-tests` or `--include-js` to opt in. Local edits disable commit-pinned GitHub links. The viewer makes no network requests and does not copy repository credentials. Since maps embed source snippets, share private-project maps only with people authorized to read that source.

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
