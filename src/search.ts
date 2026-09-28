import type { Module } from './types.js';
import type { Edge } from './types.js';
import type { ExportedSymbol } from './exports.js';

type SearchableModule = Pick<Module, 'id' | 'exports'>;
export interface ImportMatch { edge: Edge; importedName: string; localName: string; }
const normalized = (value: string) => value.trim().toLocaleLowerCase();
const exportText = (item: ExportedSymbol) => `${item.name} ${item.localName ?? ''} ${item.source ?? ''} ${item.kind}`.toLocaleLowerCase();

/** Return export records matching a map search string; missing legacy metadata stays empty. */
export function matchingExports(module: SearchableModule, query: string): ExportedSymbol[] {
  const needle = normalized(query);
  return needle ? (module.exports ?? []).filter(item => exportText(item).includes(needle)) : [];
}

/** Return explicit named/default static bindings imported by one module. */
export function matchingImports(edges: readonly Edge[], moduleId: string, query: string): ImportMatch[] {
  const needle = normalized(query);
  if (!needle) return [];
  return edges.filter(edge => edge.source === moduleId && edge.resolution === 'internal').flatMap(edge =>
    (edge.imports ?? []).filter(binding => `${binding.name} ${binding.localName}`.toLocaleLowerCase().includes(needle))
      .map(binding => ({ edge, importedName: binding.name, localName: binding.localName })));
}

/** Search import declarations by imported name or local alias; namespace/computed uses are absent. */
export function searchImports(edges: readonly Edge[], query: string): ImportMatch[] {
  const needle = normalized(query);
  if (!needle) return [];
  return edges.filter(edge => edge.resolution === 'internal').flatMap(edge =>
    (edge.imports ?? []).filter(binding => `${binding.name} ${binding.localName}`.toLocaleLowerCase().includes(needle))
      .map(binding => ({ edge, importedName: binding.name, localName: binding.localName })));
}

/** Search a module's path, exported names, and explicit imported names or aliases. */
export function matchesModuleSearch(module: SearchableModule, query: string, edges: readonly Edge[] = []): boolean {
  const needle = normalized(query);
  return !needle || module.id.toLocaleLowerCase().includes(needle) || matchingExports(module, needle).length > 0 || matchingImports(edges,module.id,needle).length > 0;
}
