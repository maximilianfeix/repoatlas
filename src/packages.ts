import type { Edge } from './types.js';

export interface ExternalUsage {
  kind: NonNullable<Edge['externalKind']>;
  name: string;
  edges: Edge[];
  moduleCount: number;
}

export function groupExternalDependencies(edges: Edge[]): ExternalUsage[] {
  const groups = new Map<string, Edge[]>();
  for (const edge of edges) {
    if (edge.resolution !== 'external') continue;
    const kind = edge.externalKind ?? 'other';
    const name = edge.externalName ?? edge.specifier;
    const key = `${kind}\0${name}`;
    const group = groups.get(key) ?? [];
    group.push(edge);
    groups.set(key, group);
  }
  return [...groups].map(([key, usageEdges]) => {
    const [kind,name] = key.split('\0') as [ExternalUsage['kind'],string];
    return {kind,name,edges:usageEdges.sort((a,b)=>a.source.localeCompare(b.source)||a.line-b.line||a.specifier.localeCompare(b.specifier)),moduleCount:new Set(usageEdges.map(edge=>edge.source)).size};
  }).sort((a,b)=>a.kind.localeCompare(b.kind)||b.edges.length-a.edges.length||a.name.localeCompare(b.name));
}
