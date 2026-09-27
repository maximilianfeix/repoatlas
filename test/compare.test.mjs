import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { compareAtlases, parseAtlas } from '../dist/compare.js';

const atlas=(modules,edges,commit='')=>({schemaVersion:1,name:'demo',repository:'https://github.com/example/demo',...(commit?{commit}:{}),modules:modules.map(id=>({id,group:id.split('/').slice(0,-1).join('/')||'.',lines:4,entry:id==='src/main.ts'?['filename convention']:[]})),edges,warnings:[]});
const edge=(source,target,specifier,extra={})=>({source,target,specifier,kind:'import',line:1,code:`import '${specifier}';`,resolution:'internal',...extra});

test('compares stable module and dependency relationships and reports specifier changes separately',()=>{
  const base=atlas(['src/main.ts','src/lib.ts','src/removed.ts'],[
    edge('src/main.ts','src/lib.ts','./lib',{line:3}),
    edge('src/main.ts','external','left-pad',{resolution:'external'}),
    edge('src/main.ts','missing','./missing',{resolution:'unresolved'}),
    edge('src/removed.ts','src/lib.ts','./lib'),
  ],'old-commit');
  const head=atlas(['src/main.ts','src/lib.ts','src/new.ts'],[
    edge('src/main.ts','src/lib.ts','@/lib',{line:40,code:"import '@/lib';"}),
    edge('src/main.ts','missing','./missing',{resolution:'unresolved',line:50}),
    edge('src/main.ts','src/new.ts','./new'),
    edge('src/main.ts','new-external','new-package',{resolution:'external'}),
  ],'new-commit');
  const diff=compareAtlases(base,head);
  assert.deepEqual(diff.modules,{added:['src/new.ts'],removed:['src/removed.ts']});
  assert.deepEqual(diff.dependencies.added.map(item=>[item.source,item.target,item.resolution]),[
    ['src/main.ts','new-external','external'],['src/main.ts','src/new.ts','internal'],
  ]);
  assert.deepEqual(diff.dependencies.removed.map(item=>[item.source,item.target,item.resolution]),[
    ['src/main.ts','external','external'],['src/removed.ts','src/lib.ts','internal'],
  ]);
  assert.deepEqual(diff.dependencies.changedSpecifier.map(change=>[change.before.specifier,change.after.specifier]),[['./lib','@/lib']]);
  assert.equal(diff.base.commit,'old-commit');assert.equal(diff.head.commit,'new-commit');
});

test('ignores line and code shifts when the dependency relationship is unchanged',()=>{
  const before=atlas(['a.ts','b.ts'],[edge('a.ts','b.ts','./b',{line:3,code:"import './b';"})]);
  const after=atlas(['a.ts','b.ts'],[edge('a.ts','b.ts','./b',{line:30,code:"import { b } from './b';"})]);
  assert.deepEqual(compareAtlases(before,after).dependencies,{added:[],removed:[],changedSpecifier:[]});
});

test('validates snapshot structure and allows additive workspace metadata',()=>{
  const value=atlas(['packages/ui/src/index.ts'],[]);value.modules[0].workspace='packages/ui';
  assert.equal(parseAtlas(value).modules[0].workspace,'packages/ui');
  for(const invalid of [null,{}, {...value,schemaVersion:2}, {...value,modules:[{id:'x'}]}, {...value,edges:[{source:'a'}]}])assert.throws(()=>parseAtlas(invalid),/Invalid RepoAtlas snapshot/);
});

test('compare CLI emits text and JSON and rejects malformed snapshot files',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'atlas-compare-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const base=path.join(dir,'base.json'),head=path.join(dir,'head.json'),bad=path.join(dir,'bad.json');
  await writeFile(base,JSON.stringify(atlas(['a.ts'],[],'base')));
  await writeFile(head,JSON.stringify(atlas(['a.ts','b.ts'],[],'head')));
  await writeFile(bad,'not json');
  const cli=path.resolve('dist/cli.js');
  assert.equal(spawnSync(process.execPath,[cli,'--version'],{encoding:'utf8'}).stdout.trim(),JSON.parse(readFileSync('package.json','utf8')).version);
  const json=spawnSync(process.execPath,[cli,'compare',base,head,'--json'],{encoding:'utf8'});
  assert.equal(json.status,0);assert.deepEqual(JSON.parse(json.stdout).modules,{added:['b.ts'],removed:[]});
  const text=spawnSync(process.execPath,[cli,'compare',base,head],{encoding:'utf8'});
  assert.equal(text.status,0);assert.match(text.stdout,/Architecture drift: demo \(base\) → demo \(head\)/);assert.match(text.stdout,/Modules: \+1 added · −0 removed/);
  const invalid=spawnSync(process.execPath,[cli,'compare',base,bad],{encoding:'utf8'});
  assert.equal(invalid.status,1);assert.match(invalid.stderr,/Snapshot is not valid JSON/);
});
