export interface Module {
  id: string; group: string; lines: number; entry: string[]; url?: string; workspace?: string;
  exports?: import('./exports.js').ExportedSymbol[];
  activity?: { commits: number; lastChanged: string };
}
export interface Edge {
  source: string; target: string; specifier: string;
  kind: 'import' | 'type' | 'export' | 'dynamic' | 'require';
  line: number; code: string; url?: string;
  resolution: 'internal' | 'external' | 'unresolved';
  computed?: true;
  externalKind?: 'package' | 'builtin' | 'url' | 'other';
  externalName?: string;
  /** Syntax-level named/default imports or re-exports from this edge's target. */
  imports?: { name: string; localName: string }[];
}
export interface Atlas {
  schemaVersion: 1; name: string; repository?: string; commit?: string;
  activity?: { days: number; commitsScanned: number; truncated: boolean; shallow: boolean };
  modules: Module[]; edges: Edge[]; warnings: string[];
}
