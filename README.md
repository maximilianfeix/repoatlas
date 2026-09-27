# RepoAtlas

**Understand any TypeScript repo in one interactive map.**

Repo URL in. Entry points, modules and dependencies out. **Every connection has a source line you can inspect.** Export one HTML file and send it to a teammate. No account, API key, server, or AI bill.

## See it in 20 seconds

1. **0–5s:** [Open the Zustand map](https://maximilianfeix.github.io/repoatlas/examples/zustand.html).
2. **5–10s:** Select `src/index.ts` to see its imports and entry-point evidence.
3. **10–15s:** Click a dependency. Read the actual import and its line number.
4. **15–20s:** Follow **Open source on GitHub** to the exact pinned commit. Share the HTML file.

Try three real projects: [Zustand](https://maximilianfeix.github.io/repoatlas/examples/zustand.html) · [Ky](https://maximilianfeix.github.io/repoatlas/examples/ky.html) · [Hono](https://maximilianfeix.github.io/repoatlas/examples/hono.html). Downloadable snapshots live in [`docs/examples`](docs/examples); commit IDs and counts are in [the manifest](docs/examples/manifest.json).

## Install and run

Requires **Node.js 22+** and **Git** for remote repositories. The CLI is distributed through this repository and GitHub Releases; it is not yet on npm.

```sh
git clone https://github.com/maximilianfeix/repoatlas.git
cd repoatlas
npm ci
npm run build
npm link

repoatlas https://github.com/pmndrs/zustand -o zustand.html
```

Open `zustand.html` in your browser. Everything needed for the map is embedded. Only following a GitHub source link needs a connection.

```sh
repoatlas ./my-project -o architecture.html  # local, offline analysis
repoatlas https://github.com/honojs/hono --ref main -o hono.html
repoatlas . --include-tests --json > graph.json
repoatlas --json doctor
repoatlas --help
```

Existing files are protected; use `--force` to replace an export. Private repositories use your existing Git credential helper. No credentials are embedded in the map. **Exports include repository paths and import snippets**, so share private-project maps only with appropriate recipients.

## What the map tells you

- **Modules:** TypeScript files grouped by directory, with search, directory filters and zoom.
- **Entry points:** Resolvable `package.json` entry fields plus explicitly labeled filename heuristics.
- **Connections:** Static imports, re-exports, type imports, literal dynamic imports and literal `require` calls, including `import = require`.
- **Evidence:** The originating statement, line number, and a GitHub permalink pinned to a commit for clean checkouts.
- **Uncertainty:** External and unresolved imports are shown in the inspector rather than fabricated as internal connections.

Select a module in the explorer or map. Select a connection or an inspector dependency to open its evidence. Keyboard users can Tab to graph nodes and connections and press Enter. Press `/` to focus search.

## How it works

```text
GitHub URL / local directory
          ↓
Read TypeScript source + nearest tsconfig + package entry fields
          ↓
TypeScript compiler AST + module resolution
          ↓
Graph with source evidence → standalone interactive HTML
```

The analyzer uses the stable **TypeScript 5.9 compiler API**, pinned deliberately. It does not install a target repo's dependencies or execute its application/build scripts. Symlinked files and directories are skipped; resolver reads are confined to the selected directory. HTML data is escaped and the viewer makes no network requests.

## Honest v1 boundaries

This is a **file dependency map**, not a runtime call graph or an AI-generated architecture explanation. Framework routing, dependency injection and computed imports cannot be inferred reliably. `require` calls are syntactic evidence and may be shadowed by local bindings. Inline `type` specifiers in mixed imports retain the enclosing import kind.

`tsconfig` aliases and locally available `extends` are supported through TypeScript. Missing dependencies or shared configs can leave imports unresolved; diagnostics appear in the export. Bare unresolved specifiers are classified as external, including aliases whose configuration is unavailable. Workspace package roots have a best-effort entry fallback; wildcard export maps and all framework aliases are not guaranteed.

Generated directories, declaration files, hidden files and tests are excluded by default. `--include-tests` includes test files and fixture directories. The input limit is 5,000 files, with a 2 MB per-source-file limit. The graph renders the first 100 matching modules; the explorer lists up to 500. Use search/directory filters to inspect large projects. All analyzed connections remain in the export and JSON.

Local modifications disable GitHub links to prevent inaccurate evidence. Embedded source snippets remain available. Entry fields pointing only at absent compiled output may not identify the original source; convention-based candidates remain labeled as heuristics.

## Development

```sh
npm ci
npm test        # build, typecheck, analyzer/CLI/security regressions
npm run check  # TypeScript check (including viewer)
npm run examples  # refresh all three demos from upstream (network)
npm pack       # distributable CLI tarball
```

JSON analysis returns the graph directly: `{schemaVersion, name, repository?, commit?, modules, edges, warnings}`. Each edge has `source`, `target`, `specifier`, `kind`, `resolution`, `line`, `code` and optional `url`. `doctor --json` returns runtime, Git and offline capability information. Errors under `--json` are `{ "error": "message" }` on stderr with a nonzero exit code. Progress also goes to stderr; stdout contains only the graph on success.

Contributions welcome: small reproducible repositories are especially helpful for module-resolution issues. See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed; example source snippets retain their upstream licenses listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
