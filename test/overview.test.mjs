import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArchitectureOverview } from '../dist/overview.js';

const modules = [
  { id:'src/index.ts', group:'src', entry:['package.json'] },
  { id:'src/lib/helper.ts', group:'src/lib', entry:[] },
  { id:'packages/ui/src/index.ts', group:'packages/ui/src', workspace:'packages/ui', entry:[] },
  { id:'packages/ui/src/button.ts', group:'packages/ui/src', workspace:'packages/ui', entry:[] },
  { id:'apps/web/src/main.ts', group:'apps/web/src', workspace:'apps/web', entry:[] },
  { id:'tools/unused.ts', group:'tools', entry:[] },
];
const edge = (source, target, line, resolution='internal') => ({
  source, target, line, resolution, specifier:`./${target}`, code:`import '${target}'`, kind:'import',
});

test('summarizes package boundaries and retains the contributing source sites', () => {
  const overview = buildArchitectureOverview(modules, [
    edge('src/index.ts','src/lib/helper.ts',2),
    edge('src/index.ts','packages/ui/src/index.ts',4),
    edge('src/lib/helper.ts','packages/ui/src/index.ts',7),
    edge('src/lib/helper.ts','packages/ui/src/index.ts',8),
    edge('packages/ui/src/index.ts','packages/ui/src/button.ts',11),
    edge('packages/ui/src/index.ts','src/index.ts',12),
    edge('apps/web/src/main.ts','packages/ui/src/index.ts',5),
    edge('src/index.ts','apps/web/src/main.ts',15,'external'),
    edge('src/index.ts','missing.ts',16,'unresolved'),
  ]);

  assert.deepEqual(overview.groups.map(group => ({
    label:group.label, modules:group.modules, internal:group.internalImports,
    incoming:group.incomingImports, outgoing:group.outgoingImports,
    dependencies:group.dependencies, dependents:group.dependents,
  })), [
    {label:'packages/ui', modules:2, internal:1, incoming:4, outgoing:1, dependencies:1, dependents:2},
    {label:'src', modules:2, internal:1, incoming:1, outgoing:3, dependencies:1, dependents:1},
    {label:'apps/web', modules:1, internal:0, incoming:0, outgoing:1, dependencies:1, dependents:0},
    {label:'tools', modules:1, internal:0, incoming:0, outgoing:0, dependencies:0, dependents:0},
  ]);
  assert.deepEqual(overview.dependencies.map(cell => [cell.source, cell.target, cell.edges.length]), [
    ['directory:src','package:packages/ui',3],
    ['package:apps/web','package:packages/ui',1],
    ['package:packages/ui','directory:src',1],
  ]);
  assert.deepEqual(overview.dependencies[0].edges.map(item=>item.line),[4,7,8]);
});

test('handles a project with isolated groups and no internal imports', () => {
  assert.deepEqual(buildArchitectureOverview([
    { id:'src/one.ts', group:'src', entry:[] },
    { id:'packages/two/index.ts', group:'packages/two', workspace:'packages/two', entry:[] },
  ], []), {
    groups:[
      {id:'package:packages/two', label:'packages/two', modules:1, internalImports:0, incomingImports:0, outgoingImports:0, dependencies:0, dependents:0},
      {id:'directory:src', label:'src', modules:1, internalImports:0, incomingImports:0, outgoingImports:0, dependencies:0, dependents:0},
    ],
    dependencies:[],
  });
  assert.deepEqual(buildArchitectureOverview([], []), {groups:[], dependencies:[]});
});
