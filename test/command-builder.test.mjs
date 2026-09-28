import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommand, parseRepository } from '../docs/command-builder.js';

test('repository input accepts canonical GitHub URLs, short names, and .git URLs', () => {
  assert.deepEqual(parseRepository('https://github.com/pmndrs/zustand'), { owner: 'pmndrs', name: 'zustand' });
  assert.deepEqual(parseRepository('honojs/hono'), { owner: 'honojs', name: 'hono' });
  assert.deepEqual(parseRepository('github.com/sindresorhus/ky.git/'), { owner: 'sindresorhus', name: 'ky' });
});

test('command output only contains validated owner and repository names', () => {
  assert.equal(createCommand('https://github.com/honojs/hono'), "npx --yes --package=github:maximilianfeix/repoatlas#v2.26.0 -- repoatlas-cli 'https://github.com/honojs/hono' -o 'hono-architecture.html'");
});

test('repository input rejects non-GitHub hosts, credentials, extra paths, and shell syntax', () => {
  for (const value of [
    'https://github.com.attacker/alice/repo',
    'https://alice@github.com/alice/repo',
    'https://github.com/alice/repo/tree/main',
    'https://github.com/alice/repo?download=1',
    'alice/repo; touch pwned',
    '--help/repo',
  ]) assert.throws(() => createCommand(value));
});
