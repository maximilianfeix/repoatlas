import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupExternalDependencies } from '../dist/packages.js';

const edge=(source,line,specifier,externalKind,externalName,resolution='external')=>({source,line,specifier,externalKind,externalName,resolution,target:specifier,kind:'import',code:`import '${specifier}';`});

test('external dependency inventory counts import sites and distinct source modules deterministically',()=>{
  const edges=[
    edge('src/z.ts',8,'@scope/ui/button','package','@scope/ui'),
    edge('src/a.ts',12,'@scope/ui','package','@scope/ui'),
    edge('src/a.ts',2,'@scope/ui/theme','package','@scope/ui'),
    edge('src/a.ts',1,'node:fs','builtin','fs'),
    edge('src/b.ts',5,'https://cdn.example/ui.js','url','https://cdn.example'),
    edge('src/a.ts',6,'./internal','package','internal','internal')
  ];
  const groups=groupExternalDependencies(edges);
  assert.deepEqual(groups.map(group=>[group.kind,group.name,group.edges.length,group.moduleCount]),[
    ['builtin','fs',1,1],['package','@scope/ui',3,2],['url','https://cdn.example',1,1]
  ]);
  assert.deepEqual(groups[1].edges.map(item=>[item.source,item.line]),[['src/a.ts',2],['src/a.ts',12],['src/z.ts',8]]);
});

test('older snapshots without package classification remain browseable as other external imports',()=>{
  const groups=groupExternalDependencies([{source:'src/index.ts',line:1,specifier:'old-package',target:'old-package',kind:'import',code:"import 'old-package';",resolution:'external'}]);
  assert.equal(groups[0].kind,'other');
  assert.equal(groups[0].name,'old-package');
});
