import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderArchitectureCard, renderBoundaryMermaid, renderBoundarySvg, renderTextReport } from '../dist/report.js';

const atlas=(name='Demo')=>({schemaVersion:1,name,repository:'https://github.com/example/demo',commit:'abc123',modules:[
  {id:'src/main.ts',group:'src',lines:3,entry:['filename convention']},
  {id:'packages/ui/src/index.ts',group:'packages/ui/src',lines:2,entry:[],workspace:'packages/ui'},
  {id:'packages/ui/src/unused.ts',group:'packages/ui/src',lines:1,entry:[],workspace:'packages/ui'},
],edges:[
  {source:'src/main.ts',target:'packages/ui/src/index.ts',specifier:'@demo/ui',kind:'import',line:1,code:"import '@demo/ui';",resolution:'internal'},
  {source:'src/main.ts',target:'left-pad',specifier:'left-pad',kind:'import',line:2,code:"import 'left-pad';",resolution:'external'},
  {source:'src/main.ts',target:'missing',specifier:'./missing',kind:'import',line:3,code:"import './missing';",resolution:'unresolved'},
],warnings:['1 unresolved import']});

test('text report summarizes modules, entry reachability, dependencies, cycles and boundaries',()=>{
  const text=renderTextReport(atlas());
  assert.match(text,/Modules: 3 · detected entry points: 1/);
  assert.match(text,/Imports: 1 internal · 1 external · 1 unresolved/);
  assert.match(text,/Reachability: 2 reachable · 1 outside detected entry paths/);
  assert.match(text,/Boundaries: 2 workspace\/directory groups · 1 imports across 1 boundary pairs/);
  assert.match(text,/src → packages\/ui: 1 imports/);
  assert.match(text,/Warning: 1 unresolved import/);
});

test('text report handles snapshots with no entries without orphan claims',()=>{
  const value=atlas();for(const module of value.modules)module.entry=[];
  assert.match(renderTextReport(value),/Reachability: unknown \(no entry points detected\)/);
});

test('boundary SVG is deterministic, script-free, and escapes untrusted labels',()=>{
  const value=atlas('<script>alert("x")</script> & project');
  const svg=renderBoundarySvg(value);
  assert.equal(svg,renderBoundarySvg(value));
  assert.match(svg,/&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; project/);
  assert.equal(svg.toLowerCase().includes('<script'),false);
  assert.match(svg,/src imports packages\/ui: 1 resolved static dependencies/);
  assert.match(svg,/not runtime calls/);
});

test('boundary SVG asks for filtering when the group cap is exceeded',()=>{
  const modules=Array.from({length:81},(_,index)=>({id:`folder-${index}/index.ts`,group:`folder-${index}`,lines:1,entry:[]}));
  assert.throws(()=>renderBoundarySvg({...atlas(),modules,edges:[]}),/at most 80 boundary groups/);
});

test('Mermaid boundary graph is deterministic, escapes labels, marks entries, and counts static imports',()=>{
  const value=atlas();value.modules[1].workspace='packages/"ui"';value.modules[2].workspace='packages/"ui"';
  const graph=renderBoundaryMermaid(value);
  assert.equal(graph,renderBoundaryMermaid(value));
  assert.match(graph,/^flowchart LR/m);
  assert.match(graph,/packages\/#quot;ui#quot; · 2 modules/);
  assert.match(graph,/detected entry/);
  assert.match(graph,/-->\|1 imports\|/);
  assert.match(graph,/resolved static TypeScript imports/);
  assert.doesNotMatch(graph,/left-pad|missing/);
});

test('Mermaid map switches to file nodes when a project has only one directory boundary',()=>{
  const value={...atlas(),modules:[
    {id:'src/index.ts',group:'src',lines:1,entry:['package metadata']},
    {id:'src/client.ts',group:'src',lines:1,entry:[]},
  ],edges:[{source:'src/index.ts',target:'src/client.ts',specifier:'./client',kind:'import',line:1,code:"import './client';",resolution:'internal'}]};
  const graph=renderBoundaryMermaid(value);
  assert.match(graph,/src\/index\.ts · 1 module · detected entry/);
  assert.match(graph,/src\/client\.ts · 1 module/);
  assert.match(graph,/-->\|1 imports\|/);
});

test('Mermaid boundary graph caps crowded diagrams and explains omitted links',()=>{
  const modules=Array.from({length:21},(_,index)=>({id:`group-${index}/index.ts`,group:`group-${index}`,lines:1,entry:index===0?['package metadata']:[]}));
  const edges=modules.flatMap((source,index)=>modules.flatMap((target,targetIndex)=>index!==targetIndex?[{source:source.id,target:target.id,specifier:`./${target.id}`,kind:'import',line:1,code:'',resolution:'internal'}]:[]));
  const graph=renderBoundaryMermaid({...atlas(),modules,edges});
  assert.equal((graph.match(/-->\|\d+ imports\|/g)??[]).length,200);
  assert.match(graph,/220 lower-volume boundary links omitted/);
  const tooMany=Array.from({length:81},(_,index)=>({id:`folder-${index}/index.ts`,group:`folder-${index}`,lines:1,entry:[]}));
  assert.throws(()=>renderBoundaryMermaid({...atlas(),modules:tooMany,edges:[]}),/at most 80 boundary groups/);
});

test('architecture card is deterministic, escaped, accessible, and accurately labeled as static analysis',()=>{
  const value=atlas('<script>alert("x")</script> & project');
  const card=renderArchitectureCard(value);
  assert.equal(card,renderArchitectureCard(value));
  assert.match(card,/&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; project/);
  assert.match(card,/>3<\/text>/);
  assert.match(card,/>1<\/text>/);
  assert.match(card,/>resolved imports/);
  assert.match(card,/runtime behavior is not inferred/);
  assert.match(card,/role="img" aria-labelledby="title desc"/);
  assert.equal(card.toLowerCase().includes('<script'),false);
});

test('report CLI writes text and SVG safely and prevents accidental overwrite',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'atlas-report-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const input=path.join(dir,'snapshot.json'),svg=path.join(dir,'boundaries.svg'),mermaid=path.join(dir,'boundaries.mmd'),card=path.join(dir,'architecture.svg');await writeFile(input,JSON.stringify(atlas()));
  const cli=path.resolve('dist/cli.js'),run=(...args)=>spawnSync(process.execPath,[cli,'report',input,...args],{encoding:'utf8'});
  const text=run('--format','text');assert.equal(text.status,0);assert.match(text.stdout,/RepoAtlas architecture report — Demo/);
  assert.equal(run('--format','svg','--output',svg).status,0);assert.match(await readFile(svg,'utf8'),/^<svg/);
  const noOverwrite=run('--format','svg','--output',svg);assert.equal(noOverwrite.status,1);assert.match(noOverwrite.stderr,/Output exists/);
  assert.equal(run('--format','svg','--output',svg,'--overwrite').status,0);
  assert.equal(run('--format','mermaid','--output',mermaid).status,0);assert.match(await readFile(mermaid,'utf8'),/^%%.*\nflowchart LR/);
  assert.equal(run('--format','card','--output',card).status,0);assert.match(await readFile(card,'utf8'),/ARCHITECTURE SNAPSHOT/);
  const noCardOverwrite=run('--format','card','--output',card);assert.equal(noCardOverwrite.status,1);assert.match(noCardOverwrite.stderr,/Output exists/);
  assert.equal(run('--format','unknown').status,1);
  assert.equal(run('--format','html').status,1);
});
