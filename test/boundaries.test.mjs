import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBoundaryMatrix } from '../dist/boundaries.js';

const modules=[
  {id:'src/index.ts',group:'src',entry:['filename convention']},
  {id:'src/lib/helper.ts',group:'src/lib',entry:[]},
  {id:'packages/ui/src/index.ts',group:'packages/ui/src',entry:[],workspace:'packages/ui'},
  {id:'apps/web/src/main.ts',group:'apps/web/src',entry:[],workspace:'apps/web'},
];
const edge=(source,target,resolution='internal',line=1)=>({source,target,resolution,line,code:`import ${target}`});

test('groups workspace packages and top-level directories into deterministic import cells',()=>{
  const matrix=buildBoundaryMatrix(modules,[
    edge('src/index.ts','src/lib/helper.ts'),
    edge('src/index.ts','packages/ui/src/index.ts'),
    edge('src/lib/helper.ts','packages/ui/src/index.ts','internal',2),
    edge('packages/ui/src/index.ts','packages/ui/src/index.ts'),
    edge('apps/web/src/main.ts','packages/ui/src/index.ts'),
    edge('src/index.ts','apps/web/src/main.ts','external'),
    edge('src/index.ts','apps/web/src/main.ts','unresolved'),
    edge('missing.ts','src/index.ts'),
  ]);
  assert.deepEqual(matrix.groups,[
    {id:'package:apps/web',label:'apps/web',modules:1},
    {id:'package:packages/ui',label:'packages/ui',modules:1},
    {id:'directory:src',label:'src',modules:2},
  ]);
  assert.deepEqual(matrix.cells.map(cell=>[cell.source,cell.target,cell.edges.length]),[
    ['package:apps/web','package:packages/ui',1],
    ['package:packages/ui','package:packages/ui',1],
    ['directory:src','package:packages/ui',2],
    ['directory:src','directory:src',1],
  ]);
  assert.ok(matrix.cells.find(cell=>cell.source==='directory:src'&&cell.target==='package:packages/ui').edges.every(item=>item.line));
});

test('returns groups with empty cells for isolated directories and no modules',()=>{
  const isolated=buildBoundaryMatrix([{id:'solo.ts',group:'.',entry:[]}],[]);
  assert.deepEqual(isolated,{groups:[{id:'directory:.',label:'.',modules:1}],cells:[]});
  assert.deepEqual(buildBoundaryMatrix([],[]),{groups:[],cells:[]});
});
