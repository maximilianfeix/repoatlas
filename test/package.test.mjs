import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('package and lockfile release versions stay aligned',async()=>{
  const pkg=JSON.parse(await readFile('package.json','utf8'));
  const lock=JSON.parse(await readFile('package-lock.json','utf8'));
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[''].version,pkg.version);
  assert.equal(pkg.bin.repoatlas,'dist/cli.js');
  assert.equal(pkg.bin['repoatlas-cli'],'dist/cli.js');
  assert.equal(pkg.scripts.prepare,'npm run build');
});

test('composite action keeps its node setup structure and JavaScript input wired',async()=>{
  const action=(await readFile('action.yml','utf8')).replace(/\r\n/g,'\n');
  assert.match(action,/      with:\n        node-version: 22/);
  assert.match(action,/  include-js:\n    description: Include JavaScript and JSX modules/);
  assert.match(action,/REPOATLAS_INCLUDE_JS: \$\{\{ inputs\.include-js \}\}/);
  assert.match(action,/args\+=\(--include-js\)/);
  assert.match(action,/  compare-to:\n    description: Optional base commit SHA/);
  assert.match(action,/  check-config:\n    description: Optional RepoAtlas JSON rule config/);
  assert.match(action,/REPOATLAS_COMPARE_TO: \$\{\{ inputs\.compare-to \}\}/);
  assert.match(action,/REPOATLAS_CHECK_CONFIG: \$\{\{ inputs\.check-config \}\}/);
  assert.match(action,/compare-to must be a full Git commit SHA/);
  assert.match(action,/git worktree add --quiet --detach/);
  assert.match(action,/--format html --output/);
  assert.match(action,/args\+=\(--baseline "\$REPOATLAS_BASELINE_SNAPSHOT"\)/);
  assert.match(action,/--format github/);
  assert.ok(action.indexOf('name: Upload architecture map') < action.indexOf('name: Check architecture rules'));
});

test('live-site install examples stay aligned with the current package release',async()=>{
  const version=JSON.parse(await readFile('package.json','utf8')).version;
  const page=(await readFile('docs/index.html','utf8')).replace(/\r\n/g,'\n');
  assert.match(page,new RegExp(`github:maximilianfeix/repoatlas#v${version.replaceAll('.','\\.')}`));
  assert.match(page,new RegExp(`maximilianfeix/repoatlas@v${version.replaceAll('.','\\.')}`));
  assert.match(page,/check-config: repoatlas\.config\.json/);
  assert.match(page,/artifact stays available if a rule fails/);
});
