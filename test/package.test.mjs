import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('package and lockfile release versions stay aligned',async()=>{
  const pkg=JSON.parse(await readFile('package.json','utf8'));
  const lock=JSON.parse(await readFile('package-lock.json','utf8'));
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[''].version,pkg.version);
});

test('composite action keeps its node setup structure and JavaScript input wired',async()=>{
  const action=(await readFile('action.yml','utf8')).replace(/\r\n/g,'\n');
  assert.match(action,/      with:\n        node-version: 22/);
  assert.match(action,/  include-js:\n    description: Include JavaScript and JSX modules/);
  assert.match(action,/REPOATLAS_INCLUDE_JS: \$\{\{ inputs\.include-js \}\}/);
  assert.match(action,/args\+=\(--include-js\)/);
});
