import type { Edge, Module } from './types.js';

/** Return a selected module and its direct, resolved importers and dependencies. */
export function focusNeighborhood(modules: Module[], edges: Edge[], selected: string | undefined): Module[] {
  if (!selected) return modules;
  const ids = new Set([selected]);
  for (const edge of edges) {
    if (edge.source === selected) ids.add(edge.target);
    if (edge.target === selected) ids.add(edge.source);
  }
  return modules.filter(module => ids.has(module.id));
}
