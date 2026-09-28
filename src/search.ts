import type { Module } from './types.js';
import type { ExportedSymbol } from './exports.js';

type SearchableModule = Pick<Module, 'id' | 'exports'>;
const normalized = (value: string) => value.trim().toLocaleLowerCase();
const exportText = (item: ExportedSymbol) => `${item.name} ${item.localName ?? ''} ${item.source ?? ''} ${item.kind}`.toLocaleLowerCase();

/** Return export records matching a map search string; missing legacy metadata stays empty. */
export function matchingExports(module: SearchableModule, query: string): ExportedSymbol[] {
  const needle = normalized(query);
  return needle ? (module.exports ?? []).filter(item => exportText(item).includes(needle)) : [];
}

/** Search a module's path and syntax-recorded export names, aliases, sources, or kinds. */
export function matchesModuleSearch(module: SearchableModule, query: string): boolean {
  const needle = normalized(query);
  return !needle || module.id.toLocaleLowerCase().includes(needle) || matchingExports(module, needle).length > 0;
}
