import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkArchitecture, parseArchitectureConfig, renderGitHubAnnotations, renderRuleReport } from '../dist/rules.js';

const atlas={schemaVersion:1,name:'Fixture',modules:[
  {id:'src/main.ts',group:'src',lines:4,entry:['package script']},
  {id:'src/a.ts',group:'src',lines:1,entry:[]},
  {id:'packages/ui/src/index.ts',group:'packages/ui/src',lines:1,entry:[],workspace:'packages/ui'},
  {id:'lib/unused.ts',group:'lib',lines:1,entry:[]},
],edges:[
  {source:'src/main.ts',target:'packages/ui/src/index.ts',specifier:'@demo/ui',kind:'import',line:2,code:"import '@demo/ui';",resolution:'internal'},
  {source:'src/main.ts',target:'src/a.ts',specifier:'./a',kind:'import',line:3,code:"import './a';",resolution:'internal'},
  {source:'src/a.ts',target:'src/main.ts',specifier:'./main',kind:'import',line:1,code:"import './main';",resolution:'internal'},
] ,warnings:[]};

test('architecture rules report forbidden boundaries with exact source evidence and numeric limits',()=>{
  const result=checkArchitecture(atlas,parseArchitectureConfig({forbiddenImports:[{from:'directory:src',to:'package:packages/ui'}],limits:{cycleGroups:0,unreachableModules:0}}));
  assert.equal(result.passed,false);
  assert.equal(result.metrics.cycleGroups,1);
  assert.equal(result.metrics.unreachableModules,1);
  assert.equal(result.violations.length,3);
  const edge=result.violations.find(v=>v.rule==='forbidden-import').edge;
  assert.equal(edge.source,'src/main.ts');assert.equal(edge.line,2);assert.equal(edge.code,"import '@demo/ui';");
  assert.match(renderRuleReport(result),/Architecture checks: failed/);
});

test('unknown reachability does not fail a configured orphan limit',()=>{
  const value=structuredClone(atlas);for(const module of value.modules)module.entry=[];
  const result=checkArchitecture(value,{limits:{unreachableModules:0}});
  assert.equal(result.passed,true);assert.equal(result.metrics.unreachableModules,null);
  assert.match(renderRuleReport(result),/unknown \(no entry points detected\)/);
});

test('baseline checks ignore unchanged debt and fail only for newly added boundaries, cycles, and orphans',()=>{
  const config={forbiddenImports:[{from:'directory:src',to:'package:packages/ui'}],limits:{cycleGroups:0,unreachableModules:0}};
  const clean=checkArchitecture(structuredClone(atlas),config,structuredClone(atlas));
  assert.equal(clean.passed,true);assert.equal(clean.violations.length,0);assert.equal(clean.baseline.preExistingViolations,3);
  assert.match(renderRuleReport(clean),/3 pre-existing violations ignored/);
  const head=structuredClone(atlas);
  head.modules.push({id:'src/b.ts',group:'src',lines:1,entry:[]},{id:'lib/unused-2.ts',group:'lib',lines:1,entry:[]});
  head.edges.push({source:'src/a.ts',target:'packages/ui/src/index.ts',specifier:'@demo/ui',kind:'import',line:4,code:"import '@demo/ui';",resolution:'internal'},
    {source:'src/b.ts',target:'src/c.ts',specifier:'./c',kind:'import',line:1,code:"import './c';",resolution:'internal'},
    {source:'src/c.ts',target:'src/b.ts',specifier:'./b',kind:'import',line:1,code:"import './b';",resolution:'internal'});
  head.modules.push({id:'src/c.ts',group:'src',lines:1,entry:[]});
  const changed=checkArchitecture(head,config,atlas);
  assert.equal(changed.passed,false);
  assert.deepEqual(changed.violations.map(item=>item.rule),['forbidden-import','max-cycle-groups','max-unreachable-modules']);
  assert.equal(changed.violations[0].edge.line,4);
  assert.match(changed.violations[1].message,/1 new cycle groups/);
  assert.match(changed.violations[2].message,/newly unreachable/);
  const fixed=structuredClone(atlas);fixed.edges=fixed.edges.filter(edge=>edge.source!=='src/main.ts'||edge.target!=='packages/ui/src/index.ts');fixed.edges=fixed.edges.filter(edge=>!(edge.source==='src/a.ts'&&edge.target==='src/main.ts'));fixed.modules=fixed.modules.filter(module=>module.id!=='lib/unused.ts');fixed.modules.find(module=>module.id==='packages/ui/src/index.ts').entry=['package script'];
  const resolved=checkArchitecture(fixed,config,atlas);assert.equal(resolved.passed,true);assert.equal(resolved.baseline.preExistingViolations,0);
});

test('baseline with unknown entry reachability never claims new orphan violations',()=>{
  const baseline=structuredClone(atlas);for(const module of baseline.modules)module.entry=[];
  const result=checkArchitecture(atlas,{limits:{unreachableModules:0}},baseline);
  assert.equal(result.passed,true);assert.equal(result.baseline.unreachableModules,null);
});

test('config validation rejects unknown keys, invalid limits and malformed boundaries',()=>{
  assert.throws(()=>parseArchitectureConfig({limts:{cycleGroups:0}}),/unknown property/);
  assert.throws(()=>parseArchitectureConfig({limits:{cycleGroups:-1}}),/non-negative integer/);
  assert.throws(()=>parseArchitectureConfig({forbiddenImports:[{from:'src'}]}),/requires only non-empty/);
  assert.throws(()=>parseArchitectureConfig({forbiddenImports:[{from:'directory:src',to:'package:ui'},{from:'directory:src',to:'package:ui'}]}),/duplicate forbiddenImports/);
  assert.throws(()=>checkArchitecture(atlas,{forbiddenImports:[{from:'directory:typo',to:'package:packages/ui'}]}),/unknown boundary/);
});

test('GitHub annotations attach source lines and escape workflow command metacharacters',()=>{
  const result={passed:false,metrics:{cycleGroups:1,unreachableModules:null},violations:[
    {rule:'forbidden-import',message:'bad%, line\nforged::warning',edge:{source:'src/a:\r\n:b,%.ts',line:7}},
    {rule:'max-cycle-groups',message:'Found 1% cycle\ngroup; maximum is 0.'},
  ]};
  assert.equal(renderGitHubAnnotations(result),'::error file=src/a%3A%0D%0A%3Ab%2C%25.ts,line=7,title=RepoAtlas forbidden import::bad%25, line%0Aforged::warning\n::error title=RepoAtlas architecture rule::Found 1%25 cycle%0Agroup; maximum is 0.\n');
  assert.equal(renderGitHubAnnotations({...result,violations:[]}), '');
});

test('check CLI emits JSON and a failing exit code, and succeeds when rules pass',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'atlas-check-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const snapshot=path.join(dir,'snapshot.json'),config=path.join(dir,'rules.json');await writeFile(snapshot,JSON.stringify(atlas));
  const cli=path.resolve('dist/cli.js'),run=(...extra)=>spawnSync(process.execPath,[cli,'check',snapshot,'--config',config,...extra,'--json'],{encoding:'utf8'});
  await writeFile(config,JSON.stringify({limits:{cycleGroups:0}}));
  const failed=run();assert.equal(failed.status,1);assert.equal(JSON.parse(failed.stdout).violations[0].rule,'max-cycle-groups');
  await writeFile(config,JSON.stringify({forbiddenImports:[{from:'directory:src',to:'package:packages/ui'}]}));
  const failedAnnotation=spawnSync(process.execPath,[cli,'check',snapshot,'--config',config,'--format','github'],{encoding:'utf8'});
  assert.equal(failedAnnotation.status,1);assert.match(failedAnnotation.stdout,/::error file=src\/main\.ts,line=2,title=RepoAtlas forbidden import::/);
  await writeFile(config,JSON.stringify({limits:{cycleGroups:1,unreachableModules:1}}));
  const passed=run();assert.equal(passed.status,0);assert.equal(JSON.parse(passed.stdout).passed,true);
  const baselinePath=path.join(dir,'baseline.json');await writeFile(baselinePath,JSON.stringify(atlas));
  const baselinePassed=run('--baseline',baselinePath);assert.ok(baselinePassed.status===0,JSON.stringify(baselinePassed));assert.equal(JSON.parse(baselinePassed.stdout).baseline.preExistingViolations,0);
  const annotation=spawnSync(process.execPath,[cli,'check',snapshot,'--config',config,'--format','github'],{encoding:'utf8'});
  assert.equal(annotation.status,0);assert.equal(annotation.stdout,'');
  const formatJson=spawnSync(process.execPath,[cli,'check',snapshot,'--config',config,'--format','json'],{encoding:'utf8'});
  assert.equal(formatJson.status,0);assert.equal(JSON.parse(formatJson.stdout).passed,true);
  const conflict=spawnSync(process.execPath,[cli,'check',snapshot,'--config',config,'--json','--format','github'],{encoding:'utf8'});
  assert.equal(conflict.status,1);assert.match(conflict.stderr,/Choose either --json or --format/);
  await writeFile(config,'{');const invalid=run();assert.equal(invalid.status,1);assert.match(invalid.stderr,/not valid JSON/);
});
