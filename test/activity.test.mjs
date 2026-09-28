import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { analyze } from '../dist/analyze.js';
import { parseGitActivity } from '../dist/activity.js';
import { render } from '../dist/render.js';

async function repoFixture(t){
  const root=await mkdtemp(path.join(tmpdir(),'repoatlas-activity-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'src'),{recursive:true});
  await writeFile(path.join(root,'src','changed.ts'),'export const changed = true;');
  await writeFile(path.join(root,'src','quiet file.ts'),'export const quiet = true;');
  const git=(...args)=>execFileSync('git',['-C',root,...args],{stdio:'ignore'});
  git('init','-q');git('config','user.name','RepoAtlas Test');git('config','user.email','repoatlas-test@example.invalid');git('add','.');
  const commit=(days,message)=>{
    const date=new Date(Date.now()-days*24*60*60*1000).toISOString();
    execFileSync('git',['-C',root,'commit','-qm',message],{stdio:'ignore',env:{...process.env,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date}});
    return date.slice(0,10);
  };
  const initialDate=commit(60,'Initial sources');
  await writeFile(path.join(root,'src','changed.ts'),'export const changed = false;');git('add','.');const recentDate=commit(10,'Change one source');
  return {root,initialDate,recentDate};
}

test('activity history is opt-in and counts tracked file commits within the requested window',async t=>{
  const {root,initialDate,recentDate}=await repoFixture(t);
  const ordinary=await analyze(root);assert.equal(ordinary.activity,undefined);assert.ok(ordinary.modules.every(module=>module.activity===undefined));
  const atlas=await analyze(root,{activityDays:90});
  assert.deepEqual(atlas.activity,{days:90,commitsScanned:2,truncated:false,shallow:false});
  const html=render(atlas);assert.match(html,/id="activity"/);assert.match(html,/committed file touches in the last/);assert.match(html,/src\/changed\.ts/);
  assert.deepEqual(atlas.modules.map(module=>[module.id,module.activity]),[
    ['src/changed.ts',{commits:2,lastChanged:recentDate}],
    ['src/quiet file.ts',{commits:1,lastChanged:initialDate}]
  ]);
  const recent=await analyze(root,{activityDays:45});
  assert.equal(recent.modules.find(module=>module.id==='src/changed.ts').activity.commits,1);
  assert.equal(recent.modules.find(module=>module.id==='src/quiet file.ts').activity,undefined);
  const bounded=parseGitActivity('x1790580406\0\nsrc/changed.ts\0x1790579571\0\nsrc/changed.ts\0',new Set(['src/changed.ts']),2);
  assert.equal(bounded.commitsScanned,2);assert.equal(bounded.truncated,true);assert.equal(bounded.changes.get('src/changed.ts').commits,2);
});

test('activity requests reject invalid windows and non-Git folders with clear errors',async t=>{
  const {root}=await repoFixture(t);
  await assert.rejects(analyze(root,{activityDays:0}),/whole number from 1 to 365/);
  await assert.rejects(analyze(root,{activityDays:366}),/whole number from 1 to 365/);
  const plain=await mkdtemp(path.join(tmpdir(),'repoatlas-no-git-'));t.after(()=>rm(plain,{recursive:true,force:true}));
  await writeFile(path.join(plain,'index.ts'),'export const ready=true;');
  await assert.rejects(analyze(plain,{activityDays:30}),/requires a Git repository/);
});
