import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { compareAtlases, parseAtlas } from '../dist/compare.js';
import { renderComparisonHtml } from '../dist/compare-render.js';

const atlas=(modules,edges,commit='')=>({schemaVersion:1,importBindingsVersion:1,name:'demo',repository:'https://github.com/example/demo',...(commit?{commit}:{}),modules:modules.map(id=>({id,group:id.split('/').slice(0,-1).join('/')||'.',lines:4,entry:id==='src/main.ts'?['filename convention']:[]})),edges,warnings:[]});
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

test('compares named/default import binding changes on shared edges and ignores line shifts',()=>{
  const before=atlas(['src/app.ts','src/api.ts'],[edge('src/app.ts','src/api.ts','./api',{line:4,url:'https://github.com/example/demo/blob/base/src/app.ts#L4',imports:[{name:'oldName',localName:'run'},{name:'keep',localName:'keep'}]})]);
  const after=atlas(['src/app.ts','src/api.ts'],[edge('src/app.ts','src/api.ts','./api',{line:40,url:'https://github.com/example/demo/blob/head/src/app.ts#L40',imports:[{name:'newName',localName:'run'},{name:'keep',localName:'keep'}]})]);
  const diff=compareAtlases(before,after);
  assert.deepEqual(diff.importBindings.unavailableSnapshots,[]);
  assert.deepEqual(diff.importBindings.added.map(item=>[item.name,item.localName,item.line,item.url]),[['newName','run',40,'https://github.com/example/demo/blob/head/src/app.ts#L40']]);
  assert.deepEqual(diff.importBindings.removed.map(item=>[item.name,item.localName,item.line]),[['oldName','run',4]]);
});

test('reports legacy binding metadata as unavailable and does not infer changes',()=>{
  const before=atlas(['a.ts','b.ts'],[edge('a.ts','b.ts','./b',{imports:[{name:'old',localName:'old'}]})]);delete before.importBindingsVersion;
  const after=atlas(['a.ts','b.ts'],[edge('a.ts','b.ts','./b',{imports:[{name:'new',localName:'new'}]})]);
  const diff=compareAtlases(before,after);
  assert.deepEqual(diff.importBindings,{added:[],removed:[],unavailableSnapshots:['base']});
  assert.throws(()=>parseAtlas({...after,importBindingsVersion:2}),/import binding index version/);
});

test('traces changed modules from detected entries per snapshot and reports unreachable modules',()=>{
  const base=atlas(['src/main.ts','src/mid.ts','src/api.ts','src/shared.ts','src/orphan.ts'],[
    edge('src/main.ts','src/mid.ts','./mid',{url:'https://github.com/example/demo/blob/base/src/main.ts#L2'}),
    edge('src/mid.ts','src/api.ts','./api',{url:'https://github.com/example/demo/blob/base/src/mid.ts#L3'}),
    edge('src/api.ts','src/shared.ts','./shared',{imports:[{name:'oldApi',localName:'client'}]}),
  ]);
  base.modules.find(module=>module.id==='src/orphan.ts').exports=[{name:'oldOrphan',kind:'function',line:1}];
  const head=atlas(['src/main.ts','src/mid.ts','src/api.ts','src/shared.ts','src/orphan.ts'],[
    edge('src/main.ts','src/mid.ts','./mid',{url:'https://github.com/example/demo/blob/head/src/main.ts#L4'}),
    edge('src/mid.ts','src/api.ts','./api',{url:'https://github.com/example/demo/blob/head/src/mid.ts#L5'}),
    edge('src/api.ts','src/shared.ts','./shared',{imports:[{name:'nextApi',localName:'client'}]}),
  ]);
  head.modules.find(module=>module.id==='src/orphan.ts').exports=[];
  const diff=compareAtlases(base,head);
  assert.equal(diff.impact.base.known,true);assert.equal(diff.impact.head.known,true);
  const baseRoute=diff.impact.base.routes.find(route=>route.moduleId==='src/api.ts');
  assert.equal(baseRoute.entry,'src/main.ts');assert.deepEqual(baseRoute.edges.map(edge=>edge.target),['src/mid.ts','src/api.ts']);
  assert.match(diff.impact.head.routes.find(route=>route.moduleId==='src/api.ts').edges[0].url,/blob\/head/);
  assert.deepEqual(diff.impact.base.unreachableModules,['src/orphan.ts']);
});

test('keeps entry reachability explicitly unknown without detected entries and bounds large route lists',()=>{
  const before=atlas(['a.ts'],[]),after=atlas(['a.ts','b.ts'],[edge('a.ts','b.ts','./b')]);
  for(const module of [...before.modules,...after.modules])module.entry=[];
  const unknown=compareAtlases(before,after).impact;
  assert.equal(unknown.base.known,false);assert.equal(unknown.head.known,false);
  const many=atlas(['src/main.ts',...Array.from({length:61},(_,i)=>`src/m${i}.ts`)],[...Array.from({length:61},(_,i)=>edge('src/main.ts',`src/m${i}.ts`,`./m${i}`))]);
  const bounded=compareAtlases(atlas(['src/main.ts'],[]),many).impact.head;
  assert.equal(bounded.routes.length,60);assert.equal(bounded.omittedModules,2);
  const longIds=['src/main.ts',...Array.from({length:50},(_,i)=>`src/deep-${i}.ts`)];
  const long=atlas(longIds,longIds.slice(0,-1).map((source,i)=>edge(source,longIds[i+1],`./deep-${i}`)));
  const longRoute=compareAtlases(atlas(['src/main.ts'],[]),long).impact.head.routes.find(route=>route.moduleId==='src/deep-49.ts');
  assert.equal(longRoute.totalSteps,50);assert.equal(longRoute.edges.length,40);assert.equal(longRoute.omittedSteps,10);
});

test('compares static public exports, ignores line shifts, and identifies snapshots without export data',()=>{
  const base=atlas(['src/api.ts','src/old-snapshot.ts','src/removed.ts'],[],'base-sha');
  const head=atlas(['src/api.ts','src/old-snapshot.ts','src/new.ts'],[],'head-sha');
  const record=(snapshot,id,exports,commit)=>{const module=snapshot.modules.find(item=>item.id===id);module.exports=exports;module.url=`https://github.com/example/demo/blob/${commit}/${id}#L1`;};
  record(base,'src/api.ts',[
    {name:'keep',kind:'function',line:2},
    {name:'gone',kind:'variable',line:3},
    {name:'legacy',kind:'re-export',line:4,source:'./old.js'},
  ],'base-sha');
  record(head,'src/api.ts',[
    {name:'keep',kind:'function',line:42},
    {name:'added',kind:'interface',line:5},
    {name:'legacy',kind:'re-export',line:4,source:'./new.js'},
  ],'head-sha');
  record(base,'src/removed.ts',[{name:'goneFile',kind:'class',line:1}],'base-sha');
  record(head,'src/new.ts',[{name:'newFile',kind:'type',line:1}],'head-sha');
  const diff=compareAtlases(base,head);
  assert.deepEqual(diff.exports.added.map(item=>[item.moduleId,item.name,item.kind,item.line]),[
    ['src/api.ts','legacy','re-export',4],['src/api.ts','added','interface',5],['src/new.ts','newFile','type',1],
  ]);
  assert.deepEqual(diff.exports.removed.map(item=>[item.moduleId,item.name,item.kind,item.line]),[
    ['src/api.ts','gone','variable',3],['src/api.ts','legacy','re-export',4],['src/removed.ts','goneFile','class',1],
  ]);
  assert.match(diff.exports.added[0].url,/head-sha\/src\/api\.ts#L4$/);
  assert.deepEqual(diff.exports.unavailableModules,['src/old-snapshot.ts']);
});

test('renders an offline, searchable HTML diff with exact source evidence and escaped input',()=>{
  const base=atlas(['a.ts','b.ts'],[edge('a.ts','b.ts','./b',{line:3,url:'https://github.com/example/demo/blob/old/a.ts#L3'})],'old');
  const head=atlas(['a.ts','c.ts'],[edge('a.ts','c.ts','</script><script>alert(1)</script>',{line:8,code:"import '</script><script>alert(1)</script>';",url:'https://github.com/example/demo/blob/new/a.ts#L8'})],'new');
  head.edges[0].url='javascript:alert(3)';
  base.modules[0].exports=[];head.modules[0].exports=[{name:'untrusted',kind:'function',line:1}];head.modules[0].url='https://github.com.evil.example/blob/head/a.ts#L1';
  head.name='demo <script>alert(2)</script>';
  const html=renderComparisonHtml(compareAtlases(base,head));
  assert.match(html,/Architecture report/);assert.match(html,/type="application\/json"/);
  assert.match(html,/\\u003c\/script>/);assert.doesNotMatch(html,/<script>alert\([12]\)<\/script>/);
  assert.match(html,/blob\/old\/a\.ts#L3/);assert.doesNotMatch(html,/href="javascript:/);
  assert.doesNotMatch(html,/href="https:\/\/github\.com\.evil/);
  assert.match(html,/aria-label="Search architecture changes"/);assert.match(html,/No tracking or network requests/);
  assert.match(html,/prefers-reduced-motion:reduce/);assert.match(html,/translateY\(-1px\)/);
  assert.match(html,/Exports added/);assert.match(html,/export-changes/);
});

test('renders imported binding changes with exact source links and search/filter hooks',()=>{
  const base=atlas(['a.ts','b.ts'],[edge('a.ts','b.ts','./b',{imports:[{name:'old',localName:'legacy'}]})]);
  const head=atlas(['a.ts','b.ts'],[edge('a.ts','b.ts','./b',{line:8,url:'https://github.com/example/demo/blob/head/a.ts#L8',imports:[{name:'next',localName:'current'}]})]);
  const html=renderComparisonHtml(compareAtlases(base,head));
  assert.match(html,/Imported bindings/);assert.match(html,/a\.ts → b\.ts · next as current/);
  assert.match(html,/a\.ts:8/);assert.match(html,/blob\/head\/a\.ts#L8/);
  assert.match(html,/Bindings added/);assert.match(html,/data-binding-change/);assert.match(html,/updateBindingFilter/);assert.match(html,/\.change\[hidden\]\{display:none\}/);assert.match(html,/No module or dependency changes match this filter/);
});

test('renders shortest changed-module entry paths with snapshot-pinned evidence and disclosure controls',()=>{
  const base=atlas(['src/main.ts','src/api.ts','src/shared.ts'],[edge('src/main.ts','src/api.ts','./api',{line:4,url:'https://github.com/example/demo/blob/base/src/main.ts#L4'}),edge('src/api.ts','src/shared.ts','./shared',{line:3,url:'https://github.com/example/demo/blob/base/src/api.ts#L3'})],'base');
  const head=atlas(['src/main.ts','src/api.ts','src/shared.ts'],[edge('src/main.ts','src/api.ts','./api',{line:8,url:'https://github.com/example/demo/blob/head/src/main.ts#L8'}),edge('src/api.ts','src/shared.ts','./shared',{line:9,url:'https://github.com/example/demo/blob/head/src/api.ts#L9',imports:[{name:'next',localName:'next'}]})],'head');
  const html=renderComparisonHtml(compareAtlases(base,head));
  assert.match(html,/Changed modules from detected entry points/);assert.match(html,/Trace route · 1 import(?:<|"|\s)/);
  assert.match(html,/blob\/base\/src\/main\.ts#L4/);assert.match(html,/blob\/head\/src\/main\.ts#L8/);
  assert.match(html,/<ol class="route-rail" aria-label="Shortest import route from src\/main\.ts to src\/api\.ts">/);
  assert.match(html,/class="route-node route-entry"/);assert.match(html,/class="route-hop-label">Import · line 8/);assert.match(html,/class="route-node route-changed"/);
  assert.match(html,/Reachability does not establish that runtime code executes/);assert.match(html,/entry-impact/);
  assert.match(html,/\.impact-route\{animation:impact-in \.18s ease-out both\}/);assert.match(html,/prefers-reduced-motion:reduce/);
});

test('keeps base and head dependency links pinned to their respective commits',()=>{
  const before=atlas(['old.ts','shared.ts'],[edge('old.ts','shared.ts','./shared',{url:'https://github.com/example/demo/blob/base-sha/old.ts#L1'})],'base');
  const after=atlas(['new.ts','shared.ts'],[edge('new.ts','shared.ts','./shared',{url:'https://github.com/example/demo/blob/head-sha/new.ts#L1'})],'head');
  const html=renderComparisonHtml(compareAtlases(before,after));
  assert.match(html,/blob\/base-sha\/old\.ts#L1/);
  assert.match(html,/blob\/head-sha\/new\.ts#L1/);
});

test('validates snapshot structure and allows additive workspace metadata',()=>{
  const value=atlas(['packages/ui/src/index.ts'],[]);value.modules[0].workspace='packages/ui';
  assert.equal(parseAtlas(value).modules[0].workspace,'packages/ui');
  for(const invalid of [null,{}, {...value,schemaVersion:2}, {...value,modules:[{id:'x'}]}, {...value,edges:[{source:'a'}]}])assert.throws(()=>parseAtlas(invalid),/Invalid RepoAtlas snapshot/);
});

test('compare CLI emits text, JSON and a safe standalone HTML file, refuses overwrite, and rejects malformed input',async t=>{
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
  assert.match(text.stdout,/Public exports: \+0 added · −0 removed/);
  assert.match(text.stdout,/Entry paths \(base\):/);assert.match(text.stdout,/Entry paths \(head\):/);
  const htmlFile=path.join(dir,'diff.html');
  const html=spawnSync(process.execPath,[cli,'compare',base,head,'--format','html','--output',htmlFile],{encoding:'utf8'});
  assert.equal(html.status,0);assert.match(readFileSync(htmlFile,'utf8'),/What changed in the architecture/);
  const overwrite=spawnSync(process.execPath,[cli,'compare',base,head,'--format','html','--output',htmlFile],{encoding:'utf8'});
  assert.equal(overwrite.status,1);assert.match(overwrite.stderr,/Output exists/);
  const invalidFormat=spawnSync(process.execPath,[cli,'compare',base,head,'--format','html'],{encoding:'utf8'});
  assert.equal(invalidFormat.status,1);assert.match(invalidFormat.stderr,/requires --output/);
  const invalid=spawnSync(process.execPath,[cli,'compare',base,bad],{encoding:'utf8'});
  assert.equal(invalid.status,1);assert.match(invalid.stderr,/Snapshot is not valid JSON/);
});
