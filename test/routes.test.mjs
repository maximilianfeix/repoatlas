import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeInspectorRoute, resolveInspectorRoute } from '../dist/routes.js';

const moduleRecord=id=>({id,group:'src',lines:20,entry:[]});
const edge=(source,line,specifier,kind='import',resolution='internal')=>({source,line,specifier,kind,resolution,target:specifier,code:`import '${specifier}';`});
const atlas={schemaVersion:1,name:'fixture',modules:[moduleRecord('src/über #1.ts')],edges:[edge('src/über #1.ts',7,'@scope/pkg?x=1#part')],warnings:[]};

test('module and exact edge deep links encode unusual paths and specifiers without ambiguity',()=>{
  const moduleHash=encodeInspectorRoute({type:'module',id:atlas.modules[0].id});
  assert.deepEqual(resolveInspectorRoute(moduleHash,atlas,[]),{type:'module',id:atlas.modules[0].id});
  const edgeHash=encodeInspectorRoute({type:'edge',edge:atlas.edges[0]});
  const route=resolveInspectorRoute(edgeHash,atlas,[]);
  assert.equal(route.type,'edge');
  assert.equal(route.edge,atlas.edges[0]);
});

test('external package routes clamp paging and restore a precise group',()=>{
  const usage={kind:'package',name:'@scope/α',edges:Array.from({length:63},(_,index)=>edge(`src/file${index}.ts`,index+1,'@scope/α/subpath','import','external')),moduleCount:63};
  const hash=encodeInspectorRoute({type:'external-package',kind:usage.kind,name:usage.name,page:9});
  assert.deepEqual(resolveInspectorRoute(hash,atlas,[usage]),{type:'external-package',kind:'package',name:'@scope/α',page:1});
  assert.equal(resolveInspectorRoute(encodeInspectorRoute({type:'external-list'}),atlas,[usage]).type,'external-list');
});

test('malformed, invalid, and stale deep links safely fall back to overview',()=>{
  for(const hash of ['#edge-line=NaN','#edge-line=2.5','#module=%E0%A4%A','#module=missing.ts','#external-kind=package&external-name=missing','#edge-source=src%2Fmissing.ts&edge-line=1&edge-specifier=x&edge-kind=import']){
    assert.deepEqual(resolveInspectorRoute(hash,atlas,[]),{type:'overview'});
  }
});
