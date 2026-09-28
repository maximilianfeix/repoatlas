import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildEntryTour, clampEntryTourStep } from '../dist/tour.js';

const edge=(source,target,line)=>({source,target,line,specifier:`./${target}`,kind:'static',resolution:'internal',code:`import '${target}'`});

test('entry tour follows each exact import edge from the detected entry',()=>{
  const first=edge('src/main.ts','src/app.ts',4),second=edge('src/app.ts','src/view.ts',9);
  const path={entry:'src/main.ts',modules:['src/main.ts','src/app.ts','src/view.ts'],edges:[first,second]};
  assert.deepEqual(buildEntryTour(path),[
    {index:0,module:'src/main.ts'},
    {index:1,module:'src/app.ts',edge:first},
    {index:2,module:'src/view.ts',edge:second},
  ]);
  assert.equal(clampEntryTourStep(-1,path),0);
  assert.equal(clampEntryTourStep(1.9,path),1);
  assert.equal(clampEntryTourStep(99,path),2);
  assert.equal(clampEntryTourStep(Number.NaN,path),0);
});

test('entry tour rejects malformed path evidence instead of showing a false connection',()=>{
  assert.throws(()=>buildEntryTour({entry:'src/main.ts',modules:['src/main.ts','src/view.ts'],edges:[]}),/one module per import edge/);
  assert.throws(()=>buildEntryTour({entry:'src/main.ts',modules:['src/main.ts','src/view.ts'],edges:[edge('src/main.ts','src/app.ts',4)]}),/adjacent tour modules/);
});

test('active tour motion has a reduced-motion override',async()=>{
  const template=await readFile(new URL('../src/template.html',import.meta.url),'utf8');
  assert.match(template,/\.edge\.path-edge\.selected\{[^}]*animation:tour-travel/);
  assert.match(template,/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?\.edge\.path-edge\.selected\{animation:none\}/);
});
