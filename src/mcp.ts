import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { analyze } from './analyze.js';
import { analyzeReachability, findCycles, findEntryPath } from './insights.js';
import type { Edge } from './types.js';

function result(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function edgeEvidence(edge: Edge) {
  return {
    source: edge.source,
    target: edge.target,
    kind: edge.kind,
    resolution: edge.resolution,
    specifier: edge.specifier,
    line: edge.line,
    code: edge.code,
    ...(edge.url ? { url: edge.url } : {}),
  };
}

export async function runMcpServer(root: string, version: string, options: { includeTests?: boolean; includeJS?: boolean }) {
  let atlas = await analyze(root, options);
  const server = new McpServer({
    name: 'repoatlas',
    version,
  }, {
    instructions: 'Use architecture_summary first. Results are deterministic static file-dependency evidence for the configured repository root. Import edges are not runtime calls; unknown or computed targets are not inferred. Call refresh_analysis after files change.',
  });

  server.registerTool('architecture_summary', {
    title: 'Architecture summary',
    description: 'Summarize the analyzed TypeScript repository, detected entries, dependency edges, reachability, and import cycles.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: z.object({}),
  }, async () => {
    const reachability = analyzeReachability(atlas.modules, atlas.edges);
    const allCycles = findCycles(atlas.modules, atlas.edges).map(group => group.map(module => module.id));
    const entries = atlas.modules.filter(module => module.entry.length);
    const internalEdges = atlas.edges.filter(edge => edge.resolution === 'internal');
    return result({
      repository: atlas.repository,
      commit: atlas.commit,
      modules: atlas.modules.length,
      internalImportSites: internalEdges.length,
      externalImports: atlas.edges.filter(edge => edge.resolution === 'external').length,
      unresolvedImports: atlas.edges.filter(edge => edge.resolution === 'unresolved').length,
      entries: { total: entries.length, items: entries.slice(0, 50).map(module => ({ id: module.id, detectedBy: module.entry })), truncated: entries.length > 50 },
      reachability: reachability.known ? { reachable: reachability.reachable.size, notReachedFromDetectedEntries: reachability.unreachable.size } : 'unknown: no entry points were detected',
      cycles: { total: allCycles.length, items: allCycles.slice(0, 20), truncated: allCycles.length > 20 },
      warnings: atlas.warnings.slice(0, 20),
      warningsTruncated: atlas.warnings.length > 20,
    });
  });

  server.registerTool('search_modules', {
    title: 'Search modules',
    description: 'Find module IDs, workspace packages, and entry points by a case-insensitive substring.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: z.object({ query: z.string().trim().min(1).max(200), limit: z.number().int().min(1).max(100).default(20) }),
  }, async ({ query, limit }) => {
    const needle = query.toLocaleLowerCase();
    const matches = atlas.modules.filter(module => `${module.id} ${module.group} ${module.workspace ?? ''}`.toLocaleLowerCase().includes(needle));
    return result({ query, total: matches.length, modules: matches.slice(0, limit).map(module => ({ id: module.id, group: module.group, lines: module.lines, entry: module.entry, workspace: module.workspace })) });
  });

  server.registerTool('inspect_module', {
    title: 'Inspect module imports',
    description: 'Return a module and its direct incoming and outgoing import evidence, including exact source lines and pinned source URLs when available.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: z.object({ moduleId: z.string().min(1).max(1000), limit: z.number().int().min(1).max(100).default(40) }),
  }, async ({ moduleId, limit }) => {
    const module = atlas.modules.find(item => item.id === moduleId);
    if (!module) return { ...result({ error: `Module not found: ${moduleId}` }), isError: true };
    const outgoing = atlas.edges.filter(edge => edge.source === moduleId).sort((a, b) => a.line - b.line || a.target.localeCompare(b.target));
    const incoming = atlas.edges.filter(edge => edge.resolution === 'internal' && edge.target === moduleId).sort((a, b) => a.source.localeCompare(b.source) || a.line - b.line);
    return result({
      module: { id: module.id, group: module.group, lines: module.lines, entry: module.entry, workspace: module.workspace, url: module.url },
      outgoing: { total: outgoing.length, evidence: outgoing.slice(0, limit).map(edgeEvidence) },
      incoming: { total: incoming.length, evidence: incoming.slice(0, limit).map(edgeEvidence) },
      truncated: outgoing.length > limit || incoming.length > limit,
    });
  });

  server.registerTool('module_context', {
    title: 'Get focused module context',
    description: 'In one bounded call, return a known module, nearby exact import evidence, and its shortest path from a detected entry point. Use this instead of combining module inspection and entry tracing when a focused answer is needed.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: z.object({ moduleId: z.string().min(1).max(1000), limit: z.number().int().min(1).max(40).default(8) }),
  }, async ({ moduleId, limit }) => {
    const module = atlas.modules.find(item => item.id === moduleId);
    if (!module) return { ...result({ error: `Module not found: ${moduleId}` }), isError: true };
    const outgoing = atlas.edges.filter(edge => edge.source === moduleId).sort((a, b) => a.line - b.line || a.target.localeCompare(b.target));
    const incoming = atlas.edges.filter(edge => edge.resolution === 'internal' && edge.target === moduleId).sort((a, b) => a.source.localeCompare(b.source) || a.line - b.line);
    const path = findEntryPath(atlas.modules, atlas.edges, moduleId);
    const hasEntries = atlas.modules.some(item => item.entry.length > 0);
    return result({
      module: { id: module.id, group: module.group, lines: module.lines, entry: module.entry, workspace: module.workspace, url: module.url },
      imports: { total: outgoing.length, evidence: outgoing.slice(0, limit).map(edgeEvidence), truncated: outgoing.length > limit },
      importedBy: { total: incoming.length, evidence: incoming.slice(0, limit).map(edgeEvidence), truncated: incoming.length > limit },
      entryPath: path ? {
        found: true,
        entry: path.entry,
        totalEdges: path.edges.length,
        modules: path.modules.slice(0, limit + 1),
        evidence: path.edges.slice(0, limit).map(edgeEvidence),
        truncated: path.edges.length > limit,
      } : {
        found: false,
        status: hasEntries ? 'unreachable' : 'unknown',
        reason: hasEntries ? 'No resolved import path from detected entries reaches this module.' : 'No entry points were detected, so reachability is unknown.',
        totalEdges: 0,
        modules: [],
        evidence: [],
        truncated: false,
      },
      limit,
      evidenceTruncated: outgoing.length > limit || incoming.length > limit || Boolean(path && path.edges.length > limit),
    });
  });

  server.registerTool('trace_entry_path', {
    title: 'Trace from an entry point',
    description: 'Find a shortest resolved-import path from a detected entry point to a module, with source evidence for each edge.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: z.object({ target: z.string().min(1).max(1000) }),
  }, async ({ target }) => {
    const path = findEntryPath(atlas.modules, atlas.edges, target);
    if (!path) return result({ target, found: false, reason: atlas.modules.some(module => module.id === target) ? 'No path from detected entries, or no entry points were detected.' : 'Module not found.' });
    return result({ found: true, entry: path.entry, modules: path.modules, evidence: path.edges.map(edgeEvidence) });
  });

  server.registerTool('refresh_analysis', {
    title: 'Refresh architecture analysis',
    description: 'Re-analyze the configured repository after source files change. Reads files only; it does not write to the repository or use the network.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: z.object({}),
  }, async () => {
    atlas = await analyze(root, options);
    return result({ refreshedAt: new Date().toISOString(), modules: atlas.modules.length, dependencies: atlas.edges.length, warnings: atlas.warnings });
  });

  serveStdio(() => server);
  process.stderr.write(`RepoAtlas MCP server ready for ${atlas.name} (${atlas.modules.length} modules).\n`);
}
