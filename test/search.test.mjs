import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesModuleSearch, matchingExports, matchingImports, searchImports } from '../dist/search.js';

test('map search finds module paths, exported names, aliases, and re-export sources',()=>{
  const module={id:'src/barrel.ts',exports:[
    {name:'lookupUser',kind:'re-export',localName:'findUser',source:'./users.js',line:4},
    {name:'UserConfig',kind:'interface',line:9},
  ]};
  assert.equal(matchesModuleSearch(module,'BARREL'),true);
  assert.equal(matchesModuleSearch(module,'  LOOKUPUSER '),true);
  assert.equal(matchesModuleSearch(module,'findUser'),true);
  assert.equal(matchesModuleSearch(module,'users.js'),true);
  assert.equal(matchesModuleSearch(module,'nothing'),false);
  assert.deepEqual(matchingExports(module,'USER').map(item=>item.name),['lookupUser','UserConfig']);
  assert.deepEqual(matchingExports(module,''),[]);
});

test('legacy snapshots without export metadata remain searchable by module path',()=>{
  const module={id:'src/legacy.ts'};
  assert.equal(matchesModuleSearch(module,'legacy'),true);
  assert.equal(matchesModuleSearch(module,'PublicName'),false);
  assert.deepEqual(matchingExports(module,'PublicName'),[]);
});

test('map and MCP import search match explicit imported names and local aliases with exact edges',()=>{
  const module={id:'src/app.ts',exports:[]};
  const edges=[
    {source:'src/app.ts',target:'src/api.ts',kind:'import',specifier:'./api.js',line:7,resolution:'internal',imports:[{name:'runTask',localName:'execute'}]},
    {source:'src/other.ts',target:'src/api.ts',kind:'import',specifier:'./api.js',line:3,resolution:'internal',imports:[{name:'default',localName:'Api'}]},
    {source:'src/app.ts',target:'external',kind:'import',specifier:'external',line:9,resolution:'external',imports:[{name:'runTask',localName:'execute'}]},
  ];
  assert.equal(matchesModuleSearch(module,'execute',edges),true);
  assert.equal(matchesModuleSearch(module,'runTask',edges),true);
  assert.deepEqual(matchingImports(edges,'src/app.ts','EXECUTE').map(item=>[item.importedName,item.localName,item.edge.line]),[['runTask','execute',7]]);
  assert.deepEqual(searchImports(edges,'src/api.ts'),[]);
  assert.deepEqual(searchImports(edges,'runTask').map(item=>[item.edge.source,item.edge.target,item.edge.line]),[['src/app.ts','src/api.ts',7]]);
});
