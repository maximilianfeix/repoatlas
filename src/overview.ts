import { buildBoundaryMatrix, type BoundaryCell } from './boundaries.js';
import type { Edge, Module } from './types.js';

export interface ArchitectureGroupSummary {
  id: string;
  label: string;
  modules: number;
  internalImports: number;
  incomingImports: number;
  outgoingImports: number;
  dependencies: number;
  dependents: number;
}

export interface ArchitectureOverview {
  groups: ArchitectureGroupSummary[];
  dependencies: BoundaryCell[];
}

/** Summarize resolved imports by workspace package or top-level source directory. */
export function buildArchitectureOverview(modules: Module[], edges: Edge[]): ArchitectureOverview {
  const matrix = buildBoundaryMatrix(modules, edges);
  const groups = new Map(matrix.groups.map(group => [group.id, {
    ...group,
    internalImports: 0,
    incomingImports: 0,
    outgoingImports: 0,
    dependencies: 0,
    dependents: 0,
  }]));
  const dependencies = matrix.cells.filter(cell => cell.source !== cell.target);

  for (const cell of matrix.cells) {
    const source = groups.get(cell.source)!;
    const target = groups.get(cell.target)!;
    if (cell.source === cell.target) {
      source.internalImports = cell.edges.length;
      continue;
    }
    source.outgoingImports += cell.edges.length;
    source.dependencies++;
    target.incomingImports += cell.edges.length;
    target.dependents++;
  }

  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  return {
    groups: [...groups.values()].sort((a, b) =>
      (b.dependencies + b.dependents) - (a.dependencies + a.dependents)
      || b.modules - a.modules
      || compare(a.label, b.label)
      || compare(a.id, b.id)),
    dependencies: dependencies.sort((a, b) =>
      b.edges.length - a.edges.length
      || compare(groups.get(a.source)!.label, groups.get(b.source)!.label)
      || compare(groups.get(a.target)!.label, groups.get(b.target)!.label)),
  };
}
