import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkArchitecture, parseArchitectureConfig, renderRuleReport } from '../dist/rules.js';

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

test('config validation rejects unknown keys, invalid limits and malformed boundaries',()=>{
  assert.throws(()=>parseArchitectureConfig({limts:{cycleGroups:0}}),/unknown property/);
  assert.throws(()=>parseArchitectureConfig({limits:{cycleGroups:-1}}),/non-negative integer/);
  assert.throws(()=>parseArchitectureConfig({forbiddenImports:[{from:'src'}]}),/requires only non-empty/);
  assert.throws(()=>parseArchitectureConfig({forbiddenImports:[{from:'directory:src',to:'package:ui'},{from:'directory:src',to:'package:ui'}]}),/duplicate forbiddenImports/);
  assert.throws(()=>checkArchitecture(atlas,{forbiddenImports:[{from:'directory:typo',to:'package:packages/ui'}]}),/unknown boundary/);
});

test('check CLI emits JSON and a failing exit code, and succeeds when rules pass',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'atlas-check-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const snapshot=path.join(dir,'snapshot.json'),config=path.join(dir,'rules.json');await writeFile(snapshot,JSON.stringify(atlas));
  const cli=path.resolve('dist/cli.js'),run=()=>spawnSync(process.execPath,[cli,'check',snapshot,'--config',config,'--json'],{encoding:'utf8'});
  await writeFile(config,JSON.stringify({limits:{cycleGroups:0}}));
  const failed=run();assert.equal(failed.status,1);assert.equal(JSON.parse(failed.stdout).violations[0].rule,'max-cycle-groups');
  await writeFile(config,JSON.stringify({limits:{cycleGroups:1,unreachableModules:1}}));
  const passed=run();assert.equal(passed.status,0);assert.equal(JSON.parse(passed.stdout).passed,true);
  await writeFile(config,'{');const invalid=run();assert.equal(invalid.status,1);assert.match(invalid.stderr,/not valid JSON/);
});
