import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { analyze, githubURL } from '../dist/analyze.js';
import { render } from '../dist/render.js';
const cli = path.resolve('dist/cli.js');
async function fixture(t,files) {
  const dir=await mkdtemp(path.join(tmpdir(),'atlas-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  for(const [name,content] of Object.entries(files)){await mkdir(path.dirname(path.join(dir,name)),{recursive:true});await writeFile(path.join(dir,name),content);}
  return dir;
}
test('AST edges retain exact lines; aliases, ESM extensions, reexports, types and dynamic imports resolve',async t=>{
  const dir=await fixture(t,{'tsconfig.json':JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@/*':['src/*']}}}),'package.json':'{"source":"src/index.ts"}','src/index.ts':`// import 'fake';\nimport { a } from '@/a';\nexport { a } from './a.js';\nimport type { A } from './a';\nconst x = import('./a');\nconst y = require('./a');\ntype Z = import('./a').A;`,'src/a.ts':'export const a = 1; export type A = number;','src/a.test.ts':"import './a'"});
  const atlas=await analyze(dir);assert.equal(atlas.modules.length,2);assert.equal(atlas.edges.length,6);
  assert.ok(atlas.edges.every(e=>e.target==='src/a.ts'&&e.resolution==='internal'));assert.deepEqual(atlas.edges.map(e=>e.line),[2,3,4,5,6,7]);assert.match(atlas.edges[0].code,/@\/a/);assert.ok(atlas.modules.find(m=>m.id==='src/index.ts').entry.includes('package.json source'));
  assert.equal((await analyze(dir,{includeTests:true})).modules.length,3);
});
test('cycles, missing imports and external packages remain explicit',async t=>{
  const dir=await fixture(t,{'a.ts':"import './b'; import './missing'; import 'node:fs';",'b.ts':"import './a'"});const atlas=await analyze(dir);
  assert.equal(atlas.edges.filter(e=>e.resolution==='internal').length,2);assert.equal(atlas.edges[1].resolution,'unresolved');assert.equal(atlas.edges[2].resolution,'external');
});
test('symlinks are not traversed and outside files are not included',async t=>{
  const outside=await fixture(t,{'secret.ts':'export const secret = 1;'}),dir=await fixture(t,{'index.ts':"import './linked/secret';"});
  await symlink(outside,path.join(dir,'linked'),process.platform==='win32'?'junction':'dir');const atlas=await analyze(dir);assert.equal(atlas.modules.length,1);assert.equal(atlas.edges[0].resolution,'unresolved');
});
test('GitHub evidence is commit-pinned and disabled for dirty working trees',async t=>{
  const dir=await fixture(t,{'a.ts':"import './b';",'b.ts':'export const b = 1;'});
  const git=(...args)=>execFileSync('git',['-C',dir,...args],{stdio:'pipe'}).toString().trim();
  git('init');git('add','.');git('-c','user.name=Test','-c','user.email=test@example.com','commit','-m','fixture');git('remote','add','origin','https://github.com/example/example.git');
  const atlas=await analyze(dir);assert.equal(atlas.edges[0].url,`https://github.com/example/example/blob/${git('rev-parse','HEAD')}/a.ts#L1`);
  await writeFile(path.join(dir,'a.ts'),"\nimport './b';");assert.equal((await analyze(dir)).edges[0].url,undefined);
});
test('GitHub evidence preserves unusual tracked paths',async t=>{
  const dir=await fixture(t,{'entry.ts':'import "./space dir/雪";','space dir/雪.ts':'export const snow = true;'});
  const git=(...args)=>execFileSync('git',['-C',dir,...args],{stdio:'pipe'}).toString().trim();
  git('init');git('add','-A');git('-c','user.name=Test','-c','user.email=test@example.com','commit','-m','fixture');git('remote','add','origin','https://github.com/example/example.git');
  const atlas=await analyze(dir);assert.equal(atlas.edges[0].resolution,'internal');assert.equal(atlas.modules.find(m=>m.id==='space dir/雪.ts').url,`https://github.com/example/example/blob/${git('rev-parse','HEAD')}/space%20dir/%E9%9B%AA.ts#L1`);
});
test('HTML embeds untrusted repository text without script breakout',async t=>{
  const dir=await fixture(t,{'a.ts':"import '</script><script>alert(1)</script>';"});const atlas=await analyze(dir);atlas.name='</script><script>alert(1)</script>';
  const html=render(atlas);assert.ok(!html.includes(atlas.name));assert.ok(html.includes('\\u003c/script>'));assert.match(html,/Content-Security-Policy/);assert.doesNotMatch(html,/script-src 'unsafe-inline'/);assert.doesNotMatch(html,/style-src 'unsafe-inline'/);assert.match(html,/object-src 'none'/);assert.doesNotMatch(html,/frame-ancestors/);assert.ok(!html.includes('/*ATLAS_'));
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1],style=html.match(/<style>([\s\S]*?)<\/style>/)[1],csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  const hash=value=>`'sha256-${createHash('sha256').update(value).digest('base64')}'`;
  assert.ok(csp.includes(`script-src ${hash(script)}`));assert.ok(csp.includes(`style-src ${hash(style)}`));
});
test('GitHub URL validation rejects credentials, flags, other hosts and extra paths',()=>{
  assert.equal(githubURL('https://github.com/a/b.git'),'https://github.com/a/b');
  for(const url of ['https://evil.com/a/b','https://user:pass@github.com/a/b','https://github.com/a/b/tree/main','file:///tmp/a','https://github.com/a/b?x=1'])assert.throws(()=>githubURL(url));
});
test('CLI runs outside project, returns JSON, and refuses accidental overwrite',async t=>{
  const dir=await fixture(t,{'index.ts':'export const value=1;'});
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8'});
  assert.equal(JSON.parse(run('--json','doctor').stdout).offline,true);
  assert.equal(JSON.parse(run('.', '--json').stdout).modules.length,1);
  assert.equal(run('.').status,0);assert.equal(run('.').status,1);assert.equal(run('.','--force').status,0);
  assert.match(await readFile(path.join(dir,'repoatlas.html'),'utf8'),/RepoAtlas/);
  const bad=run('--bad','--json');assert.equal(bad.status,1);assert.ok(JSON.parse(bad.stderr).error);
});
test('empty projects fail clearly',async t=>{await assert.rejects(()=>fixture(t,{}).then(dir=>analyze(dir)),/No TypeScript/);});
