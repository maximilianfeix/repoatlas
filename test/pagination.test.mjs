import test from 'node:test';
import assert from 'node:assert/strict';
import { pageWindow } from '../dist/pagination.js';

test('page windows stay bounded and expose stable zero-based slices', () => {
  const values = Array.from({ length: 45 }, (_, index) => index);
  assert.deepEqual(pageWindow(values, 0), { page: 0, pageCount: 3, start: 0, end: 20, items: values.slice(0, 20) });
  assert.deepEqual(pageWindow(values, 1), { page: 1, pageCount: 3, start: 20, end: 40, items: values.slice(20, 40) });
  assert.deepEqual(pageWindow(values, 2), { page: 2, pageCount: 3, start: 40, end: 45, items: values.slice(40) });
  assert.equal(pageWindow(values, 99).page, 2);
  assert.equal(pageWindow(values, -4).page, 0);
});

test('empty and short lists omit unnecessary page controls', () => {
  assert.deepEqual(pageWindow([], 0), { page: 0, pageCount: 1, start: 0, end: 0, items: [] });
  assert.equal(pageWindow([1, 2, 3], 0).pageCount, 1);
});

test('invalid page indexes and page sizes fail clearly', () => {
  assert.throws(() => pageWindow([1], 0, 0), /positive whole number/);
  assert.throws(() => pageWindow([1], 0, 1.5), /positive whole number/);
  assert.throws(() => pageWindow([1], Number.NaN), /whole number/);
});
