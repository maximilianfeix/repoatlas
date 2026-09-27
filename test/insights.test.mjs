import test from 'node:test';
import assert from 'node:assert/strict';
import { findCycles } from '../dist/insights.js';

const modules = ['entry.ts', 'a.ts', 'b.ts', 'self.ts', 'free.ts', 'outside.ts'].map(id => ({ id }));

test('finds and groups circular internal imports in stable project order', () => {
  const edges = [
    { source: 'entry.ts', target: 'a.ts', resolution: 'internal' },
    { source: 'a.ts', target: 'b.ts', resolution: 'internal' },
    { source: 'b.ts', target: 'a.ts', resolution: 'internal' },
    { source: 'b.ts', target: 'entry.ts', resolution: 'internal' },
    { source: 'self.ts', target: 'self.ts', resolution: 'internal' },
    { source: 'free.ts', target: 'a.ts', resolution: 'external' },
    { source: 'outside.ts', target: 'free.ts', resolution: 'unresolved' },
  ];

  assert.deepEqual(findCycles(modules, edges).map(group => group.map(module => module.id)), [
    ['entry.ts', 'a.ts', 'b.ts'],
    ['self.ts'],
  ]);
});

test('returns no cycle groups for an acyclic graph or unknown endpoints', () => {
  assert.deepEqual(findCycles(modules, [
    { source: 'entry.ts', target: 'a.ts', resolution: 'internal' },
    { source: 'missing.ts', target: 'entry.ts', resolution: 'internal' },
  ]), []);
});

test('handles an import chain at the analysis file limit without using the call stack', () => {
  const longChain = Array.from({ length: 5000 }, (_, index) => ({ id: `${index}.ts` }));
  const edges = longChain.slice(0, -1).map((module, index) => ({ source: module.id, target: longChain[index + 1].id, resolution: 'internal' }));
  assert.deepEqual(findCycles(longChain, edges), []);
});
