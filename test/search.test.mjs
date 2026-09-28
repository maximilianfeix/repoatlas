import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesModuleSearch, matchingExports } from '../dist/search.js';

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
