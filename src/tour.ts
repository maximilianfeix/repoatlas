import type { Edge } from './types.js';
import type { EntryPath } from './insights.js';

export interface EntryTourStep {
  index: number;
  module: string;
  edge?: Edge;
}

/** Build one evidence-backed tour stop for each module on a detected entry path. */
export function buildEntryTour(path: EntryPath): EntryTourStep[] {
  if (path.modules.length !== path.edges.length + 1 || path.modules[0] !== path.entry) {
    throw new Error('Entry path must contain its entry module and one module per import edge.');
  }
  return path.modules.map((module, index) => {
    const incoming = index ? path.edges[index - 1] : undefined;
    if (incoming && (incoming.target !== module || incoming.source !== path.modules[index - 1])) {
      throw new Error('Entry path import edges must connect adjacent tour modules.');
    }
    return incoming ? { index, module, edge: incoming } : { index, module };
  });
}

/** Keep the current walkthrough stop valid when the selected path changes. */
export function clampEntryTourStep(step: number, path: EntryPath): number {
  const last = Math.max(0, path.modules.length - 1);
  return Number.isFinite(step) ? Math.max(0, Math.min(last, Math.trunc(step))) : 0;
}
