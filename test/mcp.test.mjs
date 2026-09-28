import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('stdio MCP exposes deterministic architecture and exact import evidence', async t => {
  const project = await mkdtemp(path.join(tmpdir(), 'repoatlas-mcp-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  await mkdir(path.join(project, 'src'));
  await writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'mcp-fixture', main: 'src/index.ts' }));
  await writeFile(path.join(project, 'src/index.ts'), "import { helper } from './util.js';\nexport const app = helper();\n");
  await writeFile(path.join(project, 'src/util.ts'), 'export function helper() { return 1; }\n');
  await writeFile(path.join(project, 'src/secondary.ts'), "import { helper } from './util.js';\nexport const other = helper();\n");

  const request = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });
  const child = spawn(process.execPath, ['dist/cli.js', 'mcp', project]);
  let stdout = '', stderr = '', buffer = '';
  const responses = new Map();
  const waiters = new Map();
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      const response = JSON.parse(line);
      stdout += `${line}\n`;
      if (response.id === undefined) continue;
      responses.set(response.id, response);
      waiters.get(response.id)?.(response);
    }
  });
  child.stderr.on('data', chunk => { stderr += chunk; });
  t.after(() => { if (!child.killed) child.kill(); });
  const waitFor = id => new Promise((resolve, reject) => {
    const existing = responses.get(id);
    if (existing) return resolve(existing);
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for MCP response ${id}.\n${stderr}\n${stdout}`)), 10_000);
    waiters.set(id, response => { clearTimeout(timer); waiters.delete(id); resolve(response); });
  });
  const send = async message => {
    const response = waitFor(message.id);
    child.stdin.write(`${JSON.stringify(message)}\n`);
    return response;
  };
  await send(request(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'RepoAtlas test', version: '1.0.0' } }));
  child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  const protocolMessages = [
    request(2, 'tools/list'),
    request(3, 'tools/call', { name: 'architecture_summary', arguments: {} }),
    request(4, 'tools/call', { name: 'trace_entry_path', arguments: { target: 'src/util.ts' } }),
    request(5, 'tools/call', { name: 'inspect_module', arguments: { moduleId: 'src/index.ts' } }),
    request(6, 'tools/call', { name: 'search_modules', arguments: { query: 'UTIL' } }),
    request(7, 'tools/call', { name: 'module_context', arguments: { moduleId: 'src/util.ts', limit: 1 } }),
    request(8, 'tools/call', { name: 'module_context', arguments: { moduleId: 'src/secondary.ts', limit: 2 } }),
    request(9, 'tools/call', { name: 'module_context', arguments: { moduleId: 'src/missing.ts' } }),
    request(13, 'tools/call', { name: 'search_exports', arguments: { query: 'variable', limit: 1 } }),
    request(14, 'tools/call', { name: 'module_context', arguments: { moduleId: 'src/index.ts', limit: 1 } }),
  ];
  for (const message of protocolMessages) await send(message);
  await writeFile(path.join(project, 'src/new.ts'), 'export const next = true;\n');
  await send(request(10, 'tools/call', { name: 'refresh_analysis', arguments: {} }));
  await unlink(path.join(project, 'src/index.ts'));
  await writeFile(path.join(project, 'src/start.ts'), "import { helper } from './util.js';\nexport const started = helper();\n");
  await send(request(11, 'tools/call', { name: 'refresh_analysis', arguments: {} }));
  await send(request(12, 'tools/call', { name: 'module_context', arguments: { moduleId: 'src/start.ts' } }));
  const exited = once(child, 'exit');
  child.stdin.end();
  const [code] = await exited;
  assert.equal(code, 0, stderr);
  const byId = id => responses.get(id)?.result;
  assert.ok(byId(1)?.serverInfo?.name === 'repoatlas');
  const toolNames = byId(2)?.tools?.map(tool => tool.name);
  assert.deepEqual(toolNames, ['architecture_summary', 'search_modules', 'search_exports', 'inspect_module', 'module_context', 'trace_entry_path', 'refresh_analysis']);
  assert.ok(byId(2).tools.every(tool => tool.annotations?.readOnlyHint && tool.annotations?.openWorldHint === false));
  const summary = JSON.parse(byId(3).content[0].text);
  assert.equal(summary.modules, 3);
  assert.equal(summary.internalImportSites, 2);
  const pathResult = JSON.parse(byId(4).content[0].text);
  assert.deepEqual(pathResult.modules, ['src/index.ts', 'src/util.ts']);
  assert.equal(pathResult.evidence[0].line, 1);
  assert.equal(pathResult.evidence[0].code, "import { helper } from './util.js';");
  const inspected = JSON.parse(byId(5).content[0].text);
  assert.equal(inspected.outgoing.evidence[0].target, 'src/util.ts');
  assert.equal(inspected.outgoing.evidence[0].line, 1);
  assert.deepEqual(inspected.outgoing.evidence[0].imports,[{name:'helper',localName:'helper'}]);
  const search = JSON.parse(byId(6).content[0].text);
  assert.equal(search.total, 1);
  assert.equal(search.modules[0].id, 'src/util.ts');
  const context = JSON.parse(byId(7).content[0].text);
  assert.equal(context.module.id, 'src/util.ts');
  assert.equal(context.importedBy.total, 2);
  assert.equal(context.importedBy.evidence.length, 1);
  assert.equal(context.importedBy.truncated, true);
  assert.equal(context.entryPath.entry, 'src/index.ts');
  assert.equal(context.entryPath.evidence[0].line, 1);
  assert.equal(context.entryPath.evidence[0].code, "import { helper } from './util.js';");
  const unreachable = JSON.parse(byId(8).content[0].text);
  assert.equal(unreachable.entryPath.status, 'unreachable');
  assert.deepEqual(unreachable.entryPath.modules, []);
  assert.equal(byId(9).isError, true);
  assert.match(JSON.parse(byId(9).content[0].text).error, /Module not found/);
  const exportSearch=JSON.parse(byId(13).content[0].text);
  assert.equal(exportSearch.total,2);assert.equal(exportSearch.items.length,1);assert.equal(exportSearch.truncated,true);
  assert.equal(exportSearch.items[0].moduleId,'src/index.ts');assert.equal(exportSearch.items[0].name,'app');
  const indexContext=JSON.parse(byId(14).content[0].text);
  assert.equal(indexContext.exports.available,true);assert.equal(indexContext.exports.total,1);
  assert.equal(indexContext.exports.items[0].name,'app');assert.equal(indexContext.exports.items[0].line,2);
  assert.ok(byId(10), `refresh MCP response was missing or errored: ${JSON.stringify(responses)}`);
  const refreshed = JSON.parse(byId(10).content[0].text);
  assert.equal(refreshed.modules, 4);
  assert.match(refreshed.refreshedAt, /^\d{4}-\d{2}-\d{2}T/);
  const refreshedWithoutEntry = JSON.parse(byId(11).content[0].text);
  assert.equal(refreshedWithoutEntry.modules, 4);
  const noEntryContext = JSON.parse(byId(12).content[0].text);
  const unknownPath = noEntryContext.entryPath;
  assert.equal(noEntryContext.limit, 8);
  assert.equal(unknownPath.status, 'unknown');
  assert.match(unknownPath.reason, /No entry points/);
  assert.deepEqual((await readdir(path.join(project, 'src'))).sort(), ['new.ts', 'secondary.ts', 'start.ts', 'util.ts']);
  assert.match(stderr, /RepoAtlas MCP server ready for .+ \(3 modules\)\./);
  assert.ok(stdout.trim().split('\n').every(line => JSON.parse(line).jsonrpc === '2.0'));
});
