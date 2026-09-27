export interface Module {
  id: string; group: string; lines: number; entry: string[]; url?: string;
}
export interface Edge {
  source: string; target: string; specifier: string;
  kind: 'import' | 'type' | 'export' | 'dynamic' | 'require';
  line: number; code: string; url?: string;
  resolution: 'internal' | 'external' | 'unresolved';
}
export interface Atlas {
  schemaVersion: 1; name: string; repository?: string; commit?: string;
  modules: Module[]; edges: Edge[]; warnings: string[];
}
