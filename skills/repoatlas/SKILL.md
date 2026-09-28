---
name: repoatlas
description: Map or explain an unfamiliar TypeScript repository with RepoAtlas. Use when asked where code starts, how modules or workspace packages connect, what imports a file, or for a shareable source-backed architecture map. Not for hypothetical systems, non-TypeScript maps, or runtime-call claims.
license: MIT
metadata:
  author: maximilianfeix
  version: "2.10.0"
---

# RepoAtlas

Use RepoAtlas for evidence from the current TypeScript repository, not for imagined architecture.

## Workflow

1. If a RepoAtlas MCP server is already available for this repository, call `architecture_summary` first. Use `search_modules` to find files, `inspect_module` to inspect exact incoming and outgoing imports, and `trace_entry_path` to connect a detected entry point to a module. Call `refresh_analysis` only when the existing snapshot is stale; it rereads local files and does not write to the repository.
2. Otherwise, use an installed `repoatlas` CLI on the repository root. Run `repoatlas . --json` to inspect evidence, or `repoatlas . --out <temporary-path>/architecture.html` when the user asks to explore or share an HTML map. Keep generated snapshots and maps outside the project unless the user requests a repository artifact.
3. If the CLI is missing, do not install packages automatically. Offer the versioned CLI command from the project README, or point the user to the browser map for a public GitHub URL or explicitly selected local folder.
4. When a user requests a map, produce one standalone HTML file and give its path. Preserve existing files: omit `--force` unless the user explicitly asks to replace the chosen output.
5. For a question about recent change activity, use `--activity-days <days>` only when Git history is available and within the supported 365-day window. Report committed file-touch counts as activity, never as code risk or quality.

## Evidence rules

- Describe edges as static import relationships. They do not prove runtime calls, execution order, or reachability at runtime.
- Cite the exact source line and import text before explaining why two modules are connected. Treat computed or unresolved imports as unknown; do not guess their targets.
- Distinguish detected entry-point heuristics from confirmed application startup behavior.
- Mention when tests were excluded by default if the question depends on test modules. Use `--include-tests` only when tests matter to the request.
- Use workspace package boundaries from declared npm, Yarn, or pnpm workspaces; do not infer that every nested package is internal.
- Prefer concise findings and clickable source links. For local uncommitted source, do not present commit-pinned GitHub links as if they describe the current working tree.
