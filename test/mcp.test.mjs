import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
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
  ];
  for (const message of protocolMessages) await send(message);
  await writeFile(path.join(project, 'src/new.ts'), 'export const next = true;\n');
  await send(request(7, 'tools/call', { name: 'refresh_analysis', arguments: {} }));
  const exited = once(child, 'exit');
  child.stdin.end();
  const [code] = await exited;
  assert.equal(code, 0, stderr);
  const byId = id => responses.get(id)?.result;
  assert.ok(byId(1)?.serverInfo?.name === 'repoatlas');
  const toolNames = byId(2)?.tools?.map(tool => tool.name);
  assert.deepEqual(toolNames, ['architecture_summary', 'search_modules', 'inspect_module', 'trace_entry_path', 'refresh_analysis']);
  assert.ok(byId(2).tools.every(tool => tool.annotations?.readOnlyHint && tool.annotations?.openWorldHint === false));
  const summary = JSON.parse(byId(3).content[0].text);
  assert.equal(summary.modules, 2);
  assert.equal(summary.internalImportSites, 1);
  const pathResult = JSON.parse(byId(4).content[0].text);
  assert.deepEqual(pathResult.modules, ['src/index.ts', 'src/util.ts']);
  assert.equal(pathResult.evidence[0].line, 1);
  assert.equal(pathResult.evidence[0].code, "import { helper } from './util.js';");
  const inspected = JSON.parse(byId(5).content[0].text);
  assert.equal(inspected.outgoing.evidence[0].target, 'src/util.ts');
  assert.equal(inspected.outgoing.evidence[0].line, 1);
  const search = JSON.parse(byId(6).content[0].text);
  assert.equal(search.total, 1);
  assert.equal(search.modules[0].id, 'src/util.ts');
  assert.ok(byId(7), `refresh MCP response was missing or errored: ${JSON.stringify(responses)}`);
  const refreshed = JSON.parse(byId(7).content[0].text);
  assert.equal(refreshed.modules, 3);
  assert.match(refreshed.refreshedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual((await readdir(path.join(project, 'src'))).sort(), ['index.ts', 'new.ts', 'util.ts']);
  assert.match(stderr, /RepoAtlas MCP server ready for .+ \(2 modules\)\./);
  assert.ok(stdout.trim().split('\n').every(line => JSON.parse(line).jsonrpc === '2.0'));
});
