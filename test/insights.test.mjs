import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReachability, findCycles, findEntryPath, findEntryPaths } from '../dist/insights.js';

const modules = ['entry.ts', 'a.ts', 'b.ts', 'self.ts', 'free.ts', 'outside.ts'].map(id => ({ id }));

test('finds and groups circular internal imports in stable project order', () => {
  const edges = [
    { source: 'entry.ts', target: 'a.ts', resolution: 'internal' },
    { source: 'a.ts', target: 'b.ts', resolution: 'internal' },
    { source: 'b.ts', target: 'a.ts', resolution: 'internal' },
    { source: 'b.ts', target: 'entry.ts', resolution: 'internal' },
    { source: 'self.ts', target: 'self.ts', resolution: 'internal' },
    { source: 'free.ts', target: 'a.ts', resolution: 'external' },
    { source: 'outside.ts', target: 'free.ts', resolution: 'unresolved' },
  ];

  assert.deepEqual(findCycles(modules, edges).map(group => group.map(module => module.id)), [
    ['entry.ts', 'a.ts', 'b.ts'],
    ['self.ts'],
  ]);
});

test('returns no cycle groups for an acyclic graph or unknown endpoints', () => {
  assert.deepEqual(findCycles(modules, [
    { source: 'entry.ts', target: 'a.ts', resolution: 'internal' },
    { source: 'missing.ts', target: 'entry.ts', resolution: 'internal' },
  ]), []);
});

test('handles an import chain at the analysis file limit without using the call stack', () => {
  const longChain = Array.from({ length: 5000 }, (_, index) => ({ id: `${index}.ts` }));
  const edges = longChain.slice(0, -1).map((module, index) => ({ source: module.id, target: longChain[index + 1].id, resolution: 'internal' }));
  assert.deepEqual(findCycles(longChain, edges), []);
});

test('marks modules outside all recognized entry paths, including cycles and multiple entries', () => {
  const modules=['main.ts','admin.ts','shared.ts','cycle-a.ts','cycle-b.ts','orphan.ts'].map(id=>({id,entry:['main.ts','admin.ts'].includes(id)?['package.json main']:[]}));
  const edge=(source,target,resolution='internal')=>({source,target,resolution});
  const result=analyzeReachability(modules,[edge('main.ts','shared.ts'),edge('shared.ts','cycle-a.ts'),edge('cycle-a.ts','cycle-b.ts'),edge('cycle-b.ts','cycle-a.ts'),edge('admin.ts','orphan.ts','external')]);
  assert.equal(result.known,true);
  assert.deepEqual([...result.reachable],['main.ts','admin.ts','shared.ts','cycle-a.ts','cycle-b.ts']);
  assert.deepEqual([...result.unreachable],['orphan.ts']);
});

test('does not claim reachability when no entry points were detected', () => {
  const result=analyzeReachability([{id:'a.ts',entry:[]},{id:'b.ts',entry:[]}],[]);
  assert.deepEqual(result,{known:false,reachable:new Set(),unreachable:new Set()});
});

test('finds the deterministic shortest path from all detected entries',()=>{
  const withEntries=[
    {id:'app.ts',entry:['package script']},{id:'lib.ts',entry:['filename convention']},
    {id:'a.ts',entry:[]},{id:'target.ts',entry:[]},{id:'z.ts',entry:[]}
  ];
  const edges=[
    {source:'app.ts',target:'a.ts',resolution:'internal',line:1,specifier:'./a'},
    {source:'a.ts',target:'target.ts',resolution:'internal',line:2,specifier:'./target'},
    {source:'lib.ts',target:'target.ts',resolution:'internal',line:3,specifier:'./target'},
    {source:'z.ts',target:'target.ts',resolution:'internal',line:4,specifier:'./target'}
  ];
  assert.deepEqual(findEntryPath(withEntries,edges,'target.ts'),{entry:'lib.ts',modules:['lib.ts','target.ts'],edges:[edges[2]]});
  assert.deepEqual(findEntryPath(withEntries,edges,'app.ts'),{entry:'app.ts',modules:['app.ts'],edges:[]});
});

test('entry paths handle cycles and keep unknown or disconnected targets distinct as no path',()=>{
  const withEntries=[{id:'entry.ts',entry:['detected']},{id:'loop-a.ts',entry:[]},{id:'loop-b.ts',entry:[]},{id:'lost.ts',entry:[]}];
  const edges=[
    {source:'entry.ts',target:'loop-a.ts',resolution:'internal',line:1,specifier:'./loop-a'},
    {source:'loop-a.ts',target:'loop-b.ts',resolution:'internal',line:2,specifier:'./loop-b'},
    {source:'loop-b.ts',target:'loop-a.ts',resolution:'internal',line:3,specifier:'./loop-a'}
  ];
  assert.deepEqual(findEntryPath(withEntries,edges,'loop-b.ts').modules,['entry.ts','loop-a.ts','loop-b.ts']);
  assert.equal(findEntryPath(withEntries,edges,'lost.ts'),null);
  assert.equal(findEntryPath(withEntries.map(module=>({...module,entry:[]})),edges,'loop-b.ts'),null);
  assert.equal(findEntryPath(withEntries,edges,'missing.ts'),null);
});

test('computes several deterministic shortest entry paths in one graph walk',()=>{
  const graph=['entry.ts','left.ts','right.ts','target.ts','orphan.ts'].map(id=>({id,entry:id==='entry.ts'?['filename convention']:[]}));
  const edges=[
    {source:'entry.ts',target:'right.ts',resolution:'internal',line:1,specifier:'./right'},
    {source:'entry.ts',target:'left.ts',resolution:'internal',line:2,specifier:'./left'},
    {source:'left.ts',target:'target.ts',resolution:'internal',line:3,specifier:'./target'},
    {source:'right.ts',target:'target.ts',resolution:'internal',line:4,specifier:'./target'},
  ];
  const paths=findEntryPaths(graph,edges,['target.ts','left.ts','missing.ts']);
  assert.deepEqual(paths.get('target.ts').modules,['entry.ts','left.ts','target.ts']);
  assert.deepEqual(paths.get('left.ts').modules,['entry.ts','left.ts']);
  assert.equal(paths.has('missing.ts'),false);assert.equal(paths.has('orphan.ts'),false);
});

test('finds a changed module at the analysis file limit without recursive path traversal',()=>{
  const graph=Array.from({length:5000},(_,index)=>({id:`${index}.ts`,entry:index===0?['filename convention']:[]}));
  const edges=graph.slice(0,-1).map((module,index)=>({source:module.id,target:graph[index+1].id,resolution:'internal',line:1,specifier:`./${index+1}`}));
  const path=findEntryPaths(graph,edges,['4999.ts']).get('4999.ts');
  assert.equal(path.modules.length,5000);assert.equal(path.edges.length,4999);assert.equal(path.entry,'0.ts');
});

test('computes reachability iteratively for the full analysis file limit', () => {
  const modules=Array.from({length:5000},(_,index)=>({id:`${index}.ts`,entry:index===0?['filename convention']:[]}));
  const edges=modules.slice(0,-1).map((module,index)=>({source:module.id,target:modules[index+1].id,resolution:'internal'}));
  const result=analyzeReachability(modules,edges);
  assert.equal(result.reachable.size,5000);
  assert.equal(result.unreachable.size,0);
});
