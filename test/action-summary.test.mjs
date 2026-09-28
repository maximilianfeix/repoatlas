import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderActionSummary } from '../dist/action-summary.js';
import { compareAtlases } from '../dist/compare.js';

const atlas=(modules,edges,commit)=>({schemaVersion:1,name:'<untrusted project>',repository:'https://github.com/example/demo',commit,modules:modules.map(id=>({id,group:'src',lines:2,entry:[]})),edges,warnings:[]});
const edge=(source,target,specifier)=>({source,target,specifier,kind:'import',line:1,code:`import '${specifier}';`,resolution:'internal'});

test('job summary shows compact architecture counts, pinned snapshots, and a GitHub artifact link',()=>{
  const base=atlas(['src/main.ts','src/old.ts'],[edge('src/main.ts','src/old.ts','./old')],'abcdef1234567890');
  const head=atlas(['src/main.ts','src/new.ts'],[edge('src/main.ts','src/new.ts','./new')],'123456abcdef7890');
  base.modules.find(module=>module.id==='src/main.ts').exports=[{name:'oldApi',kind:'function',line:1}];
  base.modules.find(module=>module.id==='src/old.ts').exports=[];
  head.modules.find(module=>module.id==='src/main.ts').exports=[{name:'newApi',kind:'function',line:2}];
  head.modules.find(module=>module.id==='src/new.ts').exports=[];
  const result=renderActionSummary(compareAtlases(base,head),'https://github.com/example/demo/actions/runs/12/artifacts/34?download=1#file');
  assert.match(result,/\*\*Modules:\*\* \+1 added · −1 removed/);
  assert.match(result,/\*\*Imports:\*\* \+1 added · −1 removed · 0 changed specifiers/);
  assert.match(result,/\*\*Exports:\*\* \+1 added · −1 removed · 0 unavailable/);
  assert.match(result,/`abcdef1234` → `123456abcd`/);
  assert.match(result,/\[Download the interactive, source-linked HTML diff\]\(<https:\/\/github\.com\/example\/demo\/actions\/runs\/12\/artifacts\/34>\)/);
  assert.match(result,/syntax-level names, not type compatibility/);
  assert.doesNotMatch(result,/untrusted project|src\/new\.ts|javascript:/);
});

test('job summary rejects non-GitHub artifact destinations and sanitizes non-commit metadata',()=>{
  const comparison=compareAtlases(atlas([],[],'[bad](javascript:alert(1))'),atlas([],[],'not-a-sha'));
  assert.match(renderActionSummary(comparison,'https://github.com/example/demo/actions/runs/1/artifacts/2'),/`unknown` → `unknown`/);
  for(const url of ['javascript:alert(1)','https://github.com.evil.test/artifact','http://github.com/example/demo'])assert.throws(()=>renderActionSummary(comparison,url),/artifact URL|GitHub HTTPS/);
});

test('action summary script appends to GitHub job summary from comparison JSON',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'repoatlas-summary-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const base=atlas(['src/main.ts'],[],'abcdef1234567890'),head=atlas(['src/main.ts','src/new.ts'],[],'123456abcdef7890');
  const comparison=compareAtlases(base,head),input=path.join(dir,'comparison.json'),summary=path.join(dir,'summary.md');
  await writeFile(input,JSON.stringify(comparison));await writeFile(summary,'# Existing job output\n');
  const result=spawnSync(process.execPath,['scripts/write-action-summary.mjs',input],{encoding:'utf8',env:{...process.env,GITHUB_STEP_SUMMARY:summary,REPOATLAS_ARTIFACT_URL:'https://github.com/example/demo/actions/runs/1/artifacts/2'}});
  assert.equal(result.status,0,result.stderr);assert.match(await readFile(summary,'utf8'),/Existing job output[\s\S]*RepoAtlas architecture change[\s\S]*Download the interactive/);
});
