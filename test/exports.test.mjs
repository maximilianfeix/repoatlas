import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { collectExports } from '../dist/exports.js';

test('collects public TypeScript syntax with alias, source, default and exact line evidence', () => {
  const text = [
    'export interface User { id: string }',
    'export type UserId = string;',
    'export function findUser() {}',
    'export const one = 1, { two, nested: { three } } = value;',
    'export default class Store {}',
    "export { findUser as lookup } from './users.js';",
    "export * from './types.js';",
    "export * as helpers from './helpers.js';",
    'const internal = true;',
  ].join('\n');
  const sf = ts.createSourceFile('fixture.ts', text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(collectExports(sf), [
    { name: 'User', kind: 'interface', line: 1 },
    { name: 'UserId', kind: 'type', line: 2 },
    { name: 'findUser', kind: 'function', line: 3 },
    { name: 'one', kind: 'variable', line: 4 },
    { name: 'three', kind: 'variable', line: 4 },
    { name: 'two', kind: 'variable', line: 4 },
    { name: 'default', kind: 'class', line: 5, localName: 'Store' },
    { name: 'lookup', kind: 're-export', line: 6, localName: 'findUser', source: './users.js' },
    { name: '*', kind: 're-export-all', line: 7, source: './types.js' },
    { name: 'helpers', kind: 're-export-all', line: 8, source: './helpers.js' },
  ]);
});
