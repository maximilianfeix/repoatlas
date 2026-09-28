import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCommand, parseRepository } from '../docs/command-builder.js';

test('repository input accepts canonical GitHub URLs, short names, and .git URLs', () => {
  assert.deepEqual(parseRepository('https://github.com/pmndrs/zustand'), { owner: 'pmndrs', name: 'zustand' });
  assert.deepEqual(parseRepository('honojs/hono'), { owner: 'honojs', name: 'hono' });
  assert.deepEqual(parseRepository('github.com/sindresorhus/ky.git/'), { owner: 'sindresorhus', name: 'ky' });
});

test('command output only contains validated owner and repository names', () => {
  assert.equal(createCommand('https://github.com/honojs/hono'), "npx --yes --package=github:maximilianfeix/repoatlas#v2.29.0 -- repoatlas-cli 'https://github.com/honojs/hono' -o 'hono-architecture.html'");
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

test('homepage makes browser analysis the URL form action and keeps CLI generation secondary', async () => {
  const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
  assert.match(html, /<form id="repo-command-form">[\s\S]*?<button id="browser-analyze" class="button primary" type="submit">Build interactive map/);
  assert.match(html, /id="build-cli-command" class="button" type="button">Need a CLI command instead\?/);
  assert.match(html, /id="command-preview"[^>]*hidden/);
  assert.doesNotMatch(html, /id="browser-analyze"[^>]*type="button"/);
});
