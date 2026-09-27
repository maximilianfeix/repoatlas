import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupParallelEdges } from '../dist/graph.js';

const edge=(source,target,line,specifier=`./${target}`)=>({source,target,line,specifier,kind:'import',resolution:'internal',code:`import '${specifier}';`});

test('parallel internal edges form one deterministic visual group while retaining every exact site',()=>{
  const input=[edge('src/z.ts','src/a.ts',8),edge('src/b.ts','src/c.ts',2),edge('src/z.ts','src/a.ts',3,'./a.js'),{...edge('src/z.ts','src/a.ts',4),resolution:'external'}];
  const groups=groupParallelEdges(input);
  assert.deepEqual(groups.map(group=>[group.source,group.target,group.edges.length]),[['src/b.ts','src/c.ts',1],['src/z.ts','src/a.ts',2]]);
  assert.deepEqual(groups[1].edges.map(item=>[item.line,item.specifier]),[[3,'./a.js'],[8,'./src/a.ts']]);
});

test('different directions and targets remain separate connectors',()=>{
  const groups=groupParallelEdges([edge('a.ts','b.ts',1),edge('b.ts','a.ts',2),edge('a.ts','c.ts',3)]);
  assert.deepEqual(groups.map(group=>`${group.source}>${group.target}`),['a.ts>b.ts','a.ts>c.ts','b.ts>a.ts']);
});
