import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { parseAtlas } from '../dist/compare.js';

test('published JSON Schemas are valid JSON and exposed by the CLI',async()=>{
  const cli=process.execPath,entry='dist/cli.js';
  for(const format of ['snapshot','config']){
    const schema=JSON.parse(await readFile(`schemas/${format}.schema.json`,'utf8'));
    assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');
    const result=spawnSync(cli,[entry,'schema',format],{encoding:'utf8'});
    assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),schema);
  }
  const invalid=spawnSync(cli,[entry,'schema','unknown'],{encoding:'utf8'});
  assert.equal(invalid.status,1);assert.match(invalid.stderr,/Schema format must be either snapshot or config/);
});

test('snapshot schema validation rejects fractional or negative source counts and lines',()=>{
  const base={schemaVersion:1,name:'Fixture',modules:[{id:'a.ts',group:'.',lines:1,entry:[]}],edges:[{source:'a.ts',target:'b.ts',specifier:'./b',kind:'import',line:1,code:"import './b';",resolution:'unresolved'}],warnings:[]};
  for(const mutate of [value=>value.modules[0].lines=1.5,value=>value.modules[0].lines=-1,value=>value.edges[0].line=0,value=>value.edges[0].line=2.5]){
    const snapshot=structuredClone(base);mutate(snapshot);
    assert.throws(()=>parseAtlas(snapshot),/malformed (module record|dependency edge)/);
  }
});

test('snapshot parser and published schema accept additive computed-import and external dependency metadata',async()=>{
  const schema=JSON.parse(await readFile('schemas/snapshot.schema.json','utf8'));
  assert.deepEqual(schema.properties.edges.items.properties.externalKind.enum,['package','builtin','url','other']);
  assert.equal(schema.properties.edges.items.properties.computed.const,true);
  const snapshot={schemaVersion:1,name:'Fixture',modules:[{id:'a.ts',group:'.',lines:1,entry:[]}],edges:[{source:'a.ts',target:'pkg',specifier:'pkg',kind:'import',line:1,code:"import 'pkg';",resolution:'external',externalKind:'package',externalName:'pkg'},{source:'a.ts',target:'name',specifier:'name',kind:'dynamic',line:1,code:'import(name)',resolution:'unresolved',computed:true}],warnings:[]};
  assert.deepEqual(parseAtlas(snapshot),snapshot);
});

test('snapshot schema validates opt-in Git activity data while leaving old snapshots valid',async()=>{
  const schema=JSON.parse(await readFile('schemas/snapshot.schema.json','utf8'));
  assert.equal(schema.properties.activity.properties.days.maximum,365);
  const snapshot={schemaVersion:1,name:'Fixture',activity:{days:90,commitsScanned:3,truncated:false,shallow:true},modules:[{id:'a.ts',group:'.',lines:1,entry:[],activity:{commits:2,lastChanged:'2026-09-20'}}],edges:[],warnings:[]};
  assert.deepEqual(parseAtlas(snapshot),snapshot);
  assert.deepEqual(parseAtlas({schemaVersion:1,name:'Old',modules:[],edges:[],warnings:[]}).activity,undefined);
  for(const mutate of [value=>value.activity.days=366,value=>value.modules[0].activity.commits=-1,value=>value.modules[0].activity.lastChanged='2026-02-30']){
    const invalid=structuredClone(snapshot);mutate(invalid);
    assert.throws(()=>parseAtlas(invalid),/Invalid RepoAtlas snapshot/);
  }
});
