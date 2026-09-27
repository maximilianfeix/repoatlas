import test from 'node:test';
import assert from 'node:assert/strict';
import { focusNeighborhood } from '../dist/focus.js';

const modules = ['entry.ts', 'store.ts', 'hook.ts', 'ui.ts', 'distant.ts'].map(id => ({ id }));
const edges = [
  { source: 'entry.ts', target: 'store.ts', resolution: 'internal' },
  { source: 'hook.ts', target: 'store.ts', resolution: 'internal' },
  { source: 'store.ts', target: 'ui.ts', resolution: 'internal' },
  { source: 'distant.ts', target: 'entry.ts', resolution: 'external' },
];

test('focus keeps the selected module and its direct resolved neighbors only', () => {
  assert.deepEqual(focusNeighborhood(modules, edges.filter(edge => edge.resolution === 'internal'), 'store.ts').map(module => module.id), ['entry.ts', 'store.ts', 'hook.ts', 'ui.ts']);
});

test('focus without a selection leaves the full module list intact', () => {
  assert.equal(focusNeighborhood(modules, edges, undefined), modules);
});
