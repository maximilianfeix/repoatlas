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

/** Return a module and every internal importer that could depend on it transitively. */
export function impactNeighborhood(modules: Module[], edges: Edge[], selected: string | undefined): Module[] {
  if (!selected) return modules;
  const importers = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.resolution !== 'internal') continue;
    const targets = importers.get(edge.target) ?? [];
    targets.push(edge.source);
    importers.set(edge.target, targets);
  }

  const visited = new Set([selected]);
  const ordered = [selected];
  for (let index = 0; index < ordered.length; index++) {
    for (const importer of importers.get(ordered[index]!) ?? []) {
      if (visited.has(importer)) continue;
      visited.add(importer);
      ordered.push(importer);
    }
  }

  const byId = new Map(modules.map(module => [module.id, module]));
  return ordered.map(id => byId.get(id)).filter((module): module is Module => module !== undefined);
}
