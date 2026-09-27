import test from 'node:test';
import assert from 'node:assert/strict';
import { focusNeighborhood, impactNeighborhood } from '../dist/focus.js';

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

test('impact follows transitive internal importers in breadth-first order', () => {
  const chain = ['entry.ts', 'barrel.ts', 'hook.ts', 'store.ts', 'outside.ts'].map(id => ({ id }));
  const dependencies = [
    { source: 'entry.ts', target: 'barrel.ts', resolution: 'internal' },
    { source: 'barrel.ts', target: 'store.ts', resolution: 'internal' },
    { source: 'hook.ts', target: 'store.ts', resolution: 'internal' },
    { source: 'outside.ts', target: 'elsewhere.ts', resolution: 'internal' },
    { source: 'external.ts', target: 'store.ts', resolution: 'external' },
    { source: 'missing.ts', target: 'store.ts', resolution: 'unresolved' },
  ];
  assert.deepEqual(impactNeighborhood(chain, dependencies, 'store.ts').map(module => module.id), ['store.ts', 'barrel.ts', 'hook.ts', 'entry.ts']);
});

test('impact handles cycles, missing selections, and empty selection', () => {
  const cycle = [
    { source: 'entry.ts', target: 'store.ts', resolution: 'internal' },
    { source: 'store.ts', target: 'entry.ts', resolution: 'internal' },
  ];
  assert.deepEqual(impactNeighborhood(modules, cycle, 'store.ts').map(module => module.id), ['store.ts', 'entry.ts']);
  assert.deepEqual(impactNeighborhood(modules, cycle, 'missing.ts'), []);
  assert.equal(impactNeighborhood(modules, cycle, undefined), modules);
});
