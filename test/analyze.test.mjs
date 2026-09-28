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
  const dir=await fixture(t,{'tsconfig.json':JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@/*':['src/*']}}}),'package.json':'{"source":"src/index.ts"}','src/index.ts':`// import 'fake';\nimport DefaultThing, { a as alias, type A } from '@/a';\nexport { a as publicA } from './a.js';\nimport type { A } from './a';\nconst x = import('./a');\nconst y = require('./a');\ntype Z = import('./a').A;`,'src/a.ts':'export const a = 1; export type A = number;','src/a.test.ts':"import './a'"});
  const atlas=await analyze(dir);assert.equal(atlas.modules.length,2);assert.equal(atlas.edges.length,6);
  assert.ok(atlas.edges.every(e=>e.target==='src/a.ts'&&e.resolution==='internal'));assert.deepEqual(atlas.edges.map(e=>e.line),[2,3,4,5,6,7]);assert.match(atlas.edges[0].code,/@\/a/);assert.ok(atlas.modules.find(m=>m.id==='src/index.ts').entry.includes('package.json source'));
  assert.deepEqual(atlas.edges[0].imports,[{name:'default',localName:'DefaultThing'},{name:'a',localName:'alias'},{name:'A',localName:'A'}]);assert.deepEqual(atlas.edges[1].imports,[{name:'a',localName:'publicA'}]);assert.deepEqual(atlas.edges[2].imports,[{name:'A',localName:'A'}]);assert.equal(atlas.edges[3].imports,undefined);
  assert.equal((await analyze(dir,{includeTests:true})).modules.length,3);
});
test('computed dynamic imports and require calls remain visible as unresolved source evidence',async t=>{
  const dir=await fixture(t,{
    'src/index.ts':["const moduleName = './target';","const dynamic = import(moduleName);","const interpolated = import(`./${moduleName}`);","const loaded = require(`./${moduleName}`);","const literal = import('./target');"].join('\n'),
    'src/target.ts':'export const target = true;'
  });
  const atlas=await analyze(dir);
  assert.equal(atlas.edges.length,4);
  assert.deepEqual(atlas.edges.map(edge=>edge.line),[2,3,4,5]);
  assert.deepEqual(atlas.edges.map(edge=>edge.kind),['dynamic','dynamic','require','dynamic']);
  assert.deepEqual(atlas.edges.slice(0,3).map(edge=>edge.resolution),['unresolved','unresolved','unresolved']);
  assert.ok(atlas.edges.slice(0,3).every(edge=>edge.computed===true));
  assert.equal(atlas.edges[3].computed,undefined);
  assert.deepEqual(atlas.edges.slice(0,3).map(edge=>edge.target),['moduleName','`./${moduleName}`','`./${moduleName}`']);
  assert.ok(atlas.edges.slice(0,3).every(edge=>edge.code.includes(edge.specifier)));
  assert.equal(atlas.edges[3].resolution,'internal');
  assert.ok(atlas.warnings.some(warning=>warning.includes('3 computed import expressions')&&warning.includes('targets are not inferred')));
});
test('external imports are classified and scoped package subpaths are grouped without registry access',async t=>{
  const dir=await fixture(t,{'src/index.ts':["import fs from 'node:fs';","import {readFile} from 'node:fs/promises';","import path from 'path';","import clone from 'lodash/clone';","import thing from '@scope/tool/subpath';","import remote from 'https://cdn.example.test/lib.js';"].join('\n')});
  const atlas=await analyze(dir);
  const externals=atlas.edges.filter(edge=>edge.resolution==='external');
  assert.deepEqual(externals.map(edge=>[edge.externalKind,edge.externalName]),[
    ['builtin','fs'],['builtin','fs'],['builtin','path'],['package','lodash'],['package','@scope/tool'],['url','https://cdn.example.test']
  ]);
  assert.ok(externals.every(edge=>edge.imports===undefined));
});
test('CommonJS require calls are ignored only when a runtime lexical binding shadows the global',async t=>{
  const dir=await fixture(t,{
    'src/index.ts':["const actual = require('./target');","function injected(require: (id: string) => unknown, id: string) { return require(id); }","function local(id: string) { const require = (name: string) => name; return require(id); }","{ const require = (id: string) => id; require('./target'); }","const afterBlock = require('./target');","function globalInside() { return require('./target'); }","function hoisted() { if (true) { var require = (id: string) => id; } return require('./target'); }","function destructured({ require }: { require: (id: string) => unknown }, id: string) { return require(id); }","try { throw 0; } catch (require) { require('./target'); }","import type { require } from 'types-only';","const afterTypeOnlyImport = require('./target');","const moduleName = './target';","const computedGlobal = require(moduleName);","declare var require: (id: string) => unknown;","const ambientRequire = require('./target');"].join('\n'),
    'src/target.ts':'export const target = true;'
  });
  const atlas=await analyze(dir);
  const calls=atlas.edges.filter(edge=>edge.kind==='require');
  assert.deepEqual(calls.map(edge=>edge.line),[1,5,6,11,13,15]);
  assert.ok(calls.slice(0,4).every(edge=>edge.resolution==='internal'));
  assert.equal(calls[4].computed,true);
  assert.equal(calls[4].specifier,'moduleName');
  assert.equal(calls[4].resolution,'unresolved');
  assert.equal(calls[5].resolution,'internal');
});
test('JavaScript analysis is opt-in and links TS, JSX, ESM and CommonJS modules',async t=>{
  const dir=await fixture(t,{
    'tsconfig.json':JSON.stringify({compilerOptions:{allowJs:false,moduleResolution:'Bundler'}}),
    'src/index.ts':"import { legacy } from './legacy.js'; export const result=legacy;",
    'src/legacy.js':"import { helper } from './helper.mjs'; export const legacy=helper;",
    'src/helper.mjs':'export const helper=1;',
    'src/view.jsx':"import { legacy } from './legacy.js'; export default legacy;",
    'src/legacy.cjs':"const helper=require('./helper.mjs'); module.exports=helper;",
    'src/ignored.test.js':'export const testOnly=1;'
  });
  const typescriptOnly=await analyze(dir);
  assert.deepEqual(typescriptOnly.modules.map(module=>module.id),['src/index.ts']);
  assert.equal(typescriptOnly.edges[0].resolution,'unresolved');
  const mixed=await analyze(dir,{includeJS:true});
  assert.deepEqual(mixed.modules.map(module=>module.id),['src/helper.mjs','src/index.ts','src/legacy.cjs','src/legacy.js','src/view.jsx']);
  assert.ok(mixed.edges.filter(edge=>edge.resolution==='internal').length>=4);
  assert.ok(mixed.edges.some(edge=>edge.source==='src/index.ts'&&edge.target==='src/legacy.js'));
  assert.ok(mixed.edges.some(edge=>edge.source==='src/legacy.js'&&edge.target==='src/helper.mjs'));
  assert.ok(mixed.edges.some(edge=>edge.source==='src/view.jsx'&&edge.target==='src/legacy.js'));
  assert.ok(mixed.edges.some(edge=>edge.source==='src/legacy.cjs'&&edge.target==='src/helper.mjs'));
  const withTests=await analyze(dir,{includeJS:true,includeTests:true});
  assert.ok(withTests.modules.some(module=>module.id==='src/ignored.test.js'));
});
test('configured bundler, Node ESM and Node 10 resolution modes are honored',async t=>{
  for (const [mode,options,specifier] of [
    ['bundler',{module:'preserve',moduleResolution:'bundler'},'./target'],
    ['nodenext',{module:'nodenext',moduleResolution:'nodenext'},'./target.js'],
    ['node16',{module:'node16',moduleResolution:'node16'},'./target.js'],
    ['node10',{module:'commonjs',moduleResolution:'node10'},'./target']
  ]) {
    const dir=await fixture(t,{'package.json':'{"type":"module"}','tsconfig.json':JSON.stringify({compilerOptions:options}), 'src/index.ts':`import '${specifier}';`,'src/target.ts':'export const target = true;'});
    const atlas=await analyze(dir);assert.equal(atlas.edges[0].resolution,'internal',`${mode} resolves its supported TypeScript source`);assert.equal(atlas.edges[0].target,'src/target.ts');
  }
});
test('workspace packages resolve exported roots and subpaths to included TypeScript source',async t=>{
  const dir=await fixture(t,{
    'package.json':JSON.stringify({private:true,workspaces:{packages:['apps/*','packages/*','!packages/private']}}),
    'packages/ui/package.json':JSON.stringify({name:'@demo/ui',source:'./src/index.ts',exports:{'.':{types:'./dist/index.d.ts',import:'./dist/index.js'},'./button':{types:'./dist/button.d.ts',import:'./dist/button.js'},'./components/*':{types:'./dist/components/*.d.ts',import:'./dist/components/*.js'},'./conditional':{browser:'./src/browser.ts',import:'./src/node.ts'},'./escape':'../shared.ts'}}),
    'packages/ui/src/index.ts':'export const ui = true;',
    'packages/ui/src/button.ts':'export const button = true;',
    'packages/ui/src/components/Card.ts':'export const Card = true;',
    'packages/ui/src/browser.ts':'export const browser = true;',
    'packages/ui/src/node.ts':'export const node = true;',
    'packages/ui/src/private.ts':'export const privateValue = true;',
    'shared.ts':'export const shared = true;',
    'packages/private/package.json':JSON.stringify({name:'@demo/private',source:'./src/index.ts'}),
    'packages/private/src/index.ts':'export const hidden = true;',
    'packages/closed/package.json':JSON.stringify({name:'@demo/closed',source:'./src/index.ts',exports:{}}),
    'packages/closed/src/index.ts':'export const closed = true;',
    'apps/web/package.json':JSON.stringify({name:'@demo/web'}),
    'apps/web/tsconfig.json':JSON.stringify({compilerOptions:{module:'preserve',moduleResolution:'bundler',customConditions:['browser']}}),
    'apps/web/src/index.ts':"import '@demo/ui';\nimport '@demo/ui/button';\nimport type {} from '@demo/ui/components/Card';\nimport '@demo/ui/conditional';\nimport '@demo/ui/private';\nimport '@demo/ui/escape';\nimport '@demo/private';\nimport '@demo/closed';\nimport 'left-pad';",
  });
  const atlas=await analyze(dir);
  assert.equal(atlas.modules.find(module=>module.id==='packages/ui/src/index.ts').workspace,'packages/ui');
  assert.deepEqual(atlas.edges.map(edge=>[edge.target,edge.resolution]),[
    ['packages/ui/src/index.ts','internal'],
    ['packages/ui/src/button.ts','internal'],
    ['packages/ui/src/components/Card.ts','internal'],
    ['packages/ui/src/browser.ts','internal'],
    ['@demo/ui/private','external'],
    ['@demo/ui/escape','external'],
    ['@demo/private','external'],
    ['@demo/closed','external'],
    ['left-pad','external'],
  ]);
});
test('pnpm workspace YAML patterns resolve workspace packages and honor exclusions',async t=>{
  const dir=await fixture(t,{
    'pnpm-workspace.yaml':"packages:\n  - '**/apps/*'\n  - '!**/apps/private'\n",
    'apps/tool/package.json':JSON.stringify({name:'@demo/tool',source:'src/index.ts'}),
    'apps/tool/src/index.ts':'export const tool = true;',
    'apps/private/package.json':JSON.stringify({name:'@demo/private',source:'src/index.ts'}),
    'apps/private/src/index.ts':'export const secret = true;',
    'src/main.ts':"import '@demo/tool';\nimport '@demo/private';",
  });
  const atlas=await analyze(dir);
  assert.deepEqual(atlas.edges.map(edge=>[edge.target,edge.resolution]),[
    ['apps/tool/src/index.ts','internal'],
    ['@demo/private','external'],
  ]);
});
test('Yarn workspace export conditions follow inherited TypeScript settings and duplicate names stay unresolved',async t=>{
  const dir=await fixture(t,{
    'package.json':JSON.stringify({private:true,packageManager:'yarn@4.5.1',workspaces:['packages/**']}),
    'tsconfig.base.json':JSON.stringify({compilerOptions:{module:'preserve',moduleResolution:'bundler',customConditions:['development']}}),
    'packages/app/package.json':JSON.stringify({name:'@demo/app'}),
    'packages/app/tsconfig.json':JSON.stringify({extends:'../../tsconfig.base.json'}),
    'packages/app/src/index.ts':"import '@demo/tool/entry';\nimport '@demo/duplicate';",
    'packages/tool/package.json':JSON.stringify({name:'@demo/tool',exports:{'./entry':{types:'./dist/entry.d.ts',development:'./src/dev.ts',default:'./src/prod.ts'}}}),
    'packages/tool/src/dev.ts':'export const mode = "development";',
    'packages/tool/src/prod.ts':'export const mode = "production";',
    'packages/duplicate-a/package.json':JSON.stringify({name:'@demo/duplicate',source:'src/index.ts'}),
    'packages/duplicate-a/src/index.ts':'export const first = true;',
    'packages/duplicate-b/package.json':JSON.stringify({name:'@demo/duplicate',source:'src/index.ts'}),
    'packages/duplicate-b/src/index.ts':'export const second = true;',
  });
  const atlas=await analyze(dir);
  assert.deepEqual(atlas.edges.map(edge=>[edge.target,edge.resolution]),[
    ['packages/tool/src/dev.ts','internal'],
    ['@demo/duplicate','external'],
  ]);
  assert.ok(atlas.warnings.some(warning=>warning.includes('Multiple workspace packages use the name @demo/duplicate')));
});
test('a nested package not declared as a workspace is not assumed to be an internal dependency',async t=>{
  const dir=await fixture(t,{
    'packages/ui/package.json':JSON.stringify({name:'@demo/ui',source:'src/index.ts'}),
    'packages/ui/src/index.ts':'export const ui = true;',
    'src/main.ts':"import '@demo/ui';",
  });
  const atlas=await analyze(dir);
  assert.deepEqual([atlas.edges[0].target,atlas.edges[0].resolution],['@demo/ui','external']);
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
  const html=await readFile(path.join(dir,'repoatlas.html'),'utf8');
  assert.match(html,/RepoAtlas/);assert.match(html,/id="clusters"/);assert.match(html,/id="overview-svg"/);assert.match(html,/Center map/);
  const bad=run('--bad','--json');assert.equal(bad.status,1);assert.ok(JSON.parse(bad.stderr).error);
});
test('CLI init creates a safe editable rule config and baseline, passes its own baseline check, and protects existing files',async t=>{
  const dir=await fixture(t,{'src/index.ts':"import './helper.js';",'src/helper.js':'export const value=1;'});
  const run=(...args)=>spawnSync(process.execPath,[cli,'init','.','--include-js',...args],{cwd:dir,encoding:'utf8'});
  const initialized=run('--config-out','rules.json','--baseline-out','baseline.json','--with-workflow');
  assert.equal(initialized.status,0,initialized.stderr);assert.match(initialized.stdout,/Starter rules: no forbidden boundaries inferred/);
  const config=JSON.parse(await readFile(path.join(dir,'rules.json'),'utf8')),baseline=JSON.parse(await readFile(path.join(dir,'baseline.json'),'utf8'));
  const workflow=await readFile(path.join(dir,'.github/workflows/repoatlas.yml'),'utf8');
  assert.deepEqual(config,{forbiddenImports:[],limits:{cycleGroups:0,unreachableModules:0}});
  assert.match(workflow,/on:\n  pull_request:/);assert.match(workflow,/permissions:\n  contents: read/);assert.match(workflow,/actions\/checkout@[a-f\d]{40} # v7\.0\.1/);
  assert.match(workflow,/maximilianfeix\/repoatlas@v2\.41\.0/);assert.match(workflow,/compare-to: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);assert.match(workflow,/check-config: "rules\.json"/);assert.match(workflow,/artifact-name: repoatlas-architecture-diff/);
  assert.doesNotMatch(workflow,/pull_request_target|secrets\./);
  assert.ok(baseline.modules.some(module=>module.id==='src/helper.js'));
  const check=spawnSync(process.execPath,[cli,'check','baseline.json','--baseline','baseline.json','--config','rules.json','--json'],{cwd:dir,encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);assert.equal(JSON.parse(check.stdout).passed,true);
  const overwrite=run('--config-out','rules.json','--baseline-out','baseline.json','--with-workflow');assert.equal(overwrite.status,1);assert.match(overwrite.stderr,/Output exists.*--force/);
  const forced=run('--config-out','rules.json','--baseline-out','baseline.json','--with-workflow','--force');assert.equal(forced.status,0,forced.stderr);
  const defaults=run();assert.equal(defaults.status,0,defaults.stderr);assert.ok(JSON.parse(await readFile(path.join(dir,'repoatlas-baseline.json'),'utf8')).modules.some(module=>module.id==='src/helper.js'));
  const samePath=run('--config-out','same.json','--baseline-out','same.json');assert.equal(samePath.status,1);assert.match(samePath.stderr,/must use different paths/);
  const outside=path.resolve(dir,'..','outside-rules.json'),invalidWorkflow=run('--config-out',outside,'--with-workflow');assert.equal(invalidWorkflow.status,1);assert.match(invalidWorkflow.stderr,/--config-out must be inside/);
  const custom=run('--config-out','.github/rules.json','--baseline-out','custom-baseline.json','--workflow-out','.github/workflows/custom.yml','--with-workflow');assert.equal(custom.status,0,custom.stderr);
  assert.match(await readFile(path.join(dir,'.github/workflows/custom.yml'),'utf8'),/check-config: "\.github\/rules\.json"/);
});
test('CLI enables mixed TypeScript and JavaScript analysis explicitly',async t=>{
  const dir=await fixture(t,{'src/index.ts':"import './helper.js';",'src/helper.js':'export const value=1;'});
  const run=spawnSync(process.execPath,[cli,'.','--include-js','--json'],{cwd:dir,encoding:'utf8'});
  assert.equal(run.status,0);const atlas=JSON.parse(run.stdout);
  assert.ok(atlas.modules.some(module=>module.id==='src/helper.js'));
  assert.ok(atlas.edges.some(edge=>edge.resolution==='internal'&&edge.target==='src/helper.js'));
});
test('empty projects fail clearly',async t=>{await assert.rejects(()=>fixture(t,{}).then(dir=>analyze(dir)),/No TypeScript/);});
