<p align="center">
  <img src="docs/assets/repoatlas-logo.svg" alt="RepoAtlas" width="286">
</p>

<h3 align="center">See how an unfamiliar TypeScript repo fits together.</h3>
<p align="center">Explore the modules. Follow a dependency. Check the exact source line behind it.</p>

<p align="center">
  <a href="https://github.com/maximilianfeix/repoatlas/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/maximilianfeix/repoatlas?style=social"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/actions/workflows/ci.yml"><img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/maximilianfeix/repoatlas/ci.yml?branch=main&label=tests"></a>
  <a href="https://github.com/maximilianfeix/repoatlas/blob/main/LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/maximilianfeix/repoatlas"></a>
  <img alt="Node.js 22+" src="https://img.shields.io/badge/Node.js-22%2B-43853d?logo=node.js&logoColor=white">
</p>

<p align="center">
  <a href="https://maximilianfeix.github.io/repoatlas/"><strong>Open the live demo</strong></a> ·
  <a href="https://maximilianfeix.github.io/repoatlas/#make-a-map">Build a command in the browser</a> ·
  <a href="#try-a-map">Try a map</a> ·
  <a href="#make-your-own-map">Make your own map</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

<p align="center"><img src="docs/assets/repoatlas-hero.svg" alt="An interactive TypeScript dependency map with a selected connection's source code evidence" width="960"></p>

RepoAtlas turns a GitHub repository or local TypeScript project into a **standalone, interactive architecture map**. Its graph is static analysis, not a guess: select an import to inspect the statement, line number, and commit-pinned GitHub source.

## Make your own map

Requires **Node.js 22+** and **Git**. Run this from a terminal:

```sh
npx --yes --package=github:maximilianfeix/repoatlas -- repoatlas https://github.com/pmndrs/zustand -o zustand-map.html
```

Open `zustand-map.html` in a browser. The CLI installs from GitHub on first use; you don't need to clone or build RepoAtlas first. It's not published to the npm registry yet.

Replace the repository URL to map another public repo. For a local checkout, pass its directory:

```sh
npx --yes --package=github:maximilianfeix/repoatlas -- repoatlas ./my-project -o architecture.html
```

## Try a map

No install needed for these pinned, shareable examples:

| Project | What to explore | Map |
| --- | --- | --- |
| **Zustand** · 18 modules, 23 internal connections | Follow a compact state library from its entry points | [Open map ↗](https://maximilianfeix.github.io/repoatlas/examples/zustand.html) |
| **Ky** · 51 modules, 93 internal connections | Trace an HTTP client through its source folders | [Open map ↗](https://maximilianfeix.github.io/repoatlas/examples/ky.html) |
| **Hono** · 247 modules, 676 internal connections | Search a larger framework, focus a module, inspect its edges | [Open map ↗](https://maximilianfeix.github.io/repoatlas/examples/hono.html) |

The source commit and analysis warnings are recorded in [`docs/examples/manifest.json`](docs/examples/manifest.json). Each map includes its upstream license notice.

## Find your way through the graph

- **See the structure:** TypeScript modules, likely entry points, imports, re-exports, and directories.
- **Follow direct relationships:** imports, type imports, literal dynamic imports, and literal `require` calls.
- **Focus on one module:** isolate it and its direct importers and dependencies, even in a large project.
- **Check the evidence:** inspect the original statement and line, then open the pinned source on GitHub.
- **Keep exploring:** search, filter by directory or entry point, zoom, and navigate with a keyboard.
- **Share a snapshot:** export one self-contained HTML file; the map works offline.
- **Use the data elsewhere:** `--json` emits the complete analysis graph for scripts and other tools.

```sh
repoatlas https://github.com/honojs/hono --ref main -o hono-map.html
repoatlas . --include-tests --json > graph.json
repoatlas --json doctor
repoatlas --help
```

Private repositories use your existing Git credential helper. Credentials are never written into the map. Exports include repository paths and source snippets, so share maps of private projects only with the right people. Existing output files are protected; add `--force` to replace one.

## What RepoAtlas can and cannot infer

RepoAtlas maps **static file dependencies**. It doesn't execute the target project's code or claim to show runtime calls. Computed imports, framework routing, and dependency injection aren't inferred. Unresolved and external dependencies stay visible as such, rather than being drawn as made-up internal edges.

Generated directories, declaration files, hidden files, and tests are excluded by default. Use `--include-tests` to add tests and fixtures. Analysis is limited to 5,000 files and 2 MB per source file; the map draws up to 100 matching modules at once. Search, filters, and **Focus map** help you inspect larger projects, and JSON retains every analyzed edge.

Local modifications disable GitHub source links because the current files may not match the remote commit. The export still embeds source evidence. Analysis reads files but does not install dependencies or run repository scripts. Symlinks are skipped, file reads stay within the selected directory, and the viewer makes no network requests.

<details>
<summary>TypeScript, security, and compatibility details</summary>

The analyzer uses the TypeScript 6.0 compiler API, pinned at 6.0.3. TypeScript 7 removes the standalone `resolveModuleName` API used here; track [TypeScript 7 compatibility](https://github.com/maximilianfeix/repoatlas/issues/5). Node and bundler module-resolution modes are covered by tests.

The generated viewer uses a hash-based Content Security Policy for its inline scripts and styles. For dependency-resolution caveats, limits, and known gaps, see [open issues](https://github.com/maximilianfeix/repoatlas/issues).

</details>

## Develop and contribute

```sh
git clone https://github.com/maximilianfeix/repoatlas.git
cd repoatlas
npm ci
npm test
npm run check
```

Bug reports, small reproduction repos, and focused improvements are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md). RepoAtlas is MIT licensed; example source notices are collected in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

---

<p align="center">If RepoAtlas helps you get oriented, <a href="https://github.com/maximilianfeix/repoatlas">give it a star</a> so more developers can find it.</p>
