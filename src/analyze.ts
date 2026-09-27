import ts from 'typescript';
import { readdir, readFile, lstat, realpath } from 'node:fs/promises';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Atlas, Edge } from './types.js';

const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', 'vendor']);
const sourcePattern = /\.(?:ts|tsx|mts|cts)$/;
const slash = (s: string) => s.split(path.sep).join('/');
export function githubURL(input: string): string {
  const u = new URL(input);
  if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.port || u.username || u.password || u.search || u.hash || !/^\/[\w.-]+\/[\w.-]+\/?$/.test(u.pathname)) {
    throw new Error('Use a GitHub repository URL: https://github.com/owner/repo');
  }
  return `https://github.com${u.pathname.replace(/\/$/, '').replace(/\.git$/, '')}`;
}
function git(root: string, args: string[]): string | undefined {
  try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 }).trim(); } catch { return undefined; }
}

export async function analyze(input: string, options: { includeTests?: boolean; repository?: string } = {}): Promise<Atlas> {
  const root = await realpath(input);
  if (!(await lstat(root)).isDirectory()) throw new Error('Input must be a directory.');
  const files: string[] = [], configs = new Map<string, ts.CompilerOptions>(), packages: {dir: string; data: any}[] = [];
  const warnings: string[] = [];
  const inside = (f: string) => { const rel = path.relative(root, path.resolve(f)); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
  const safe = (f: string) => { try { return inside(f) && inside(realpathSync(f)); } catch { return false; } };
  const host: ts.ModuleResolutionHost = {
    fileExists: f => safe(f) && existsSync(f) && lstatSync(f).isFile(),
    readFile: f => safe(f) ? readFileSync(f, 'utf8') : undefined,
    directoryExists: f => safe(f) && lstatSync(f).isDirectory(),
    realpath: f => safe(f) ? realpathSync(f) : f
  };
  async function walk(dir: string) {
    for (const ent of (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      if (ent.isSymbolicLink() || ent.name.startsWith('.') || ignored.has(ent.name)) continue;
      const file = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!options.includeTests && /^(?:tests?|__tests__|__mocks__|fixtures)$/.test(ent.name)) continue;
        await walk(file);
      } else if (ent.isFile()) {
        if (ent.name === 'package.json') { try { packages.push({dir, data: JSON.parse(await readFile(file, 'utf8'))}); } catch { warnings.push(`Invalid package.json: ${slash(path.relative(root, file))}`); } }
        if (ent.name === 'tsconfig.json') {
          const parsed = ts.readConfigFile(file, host.readFile);
          if (parsed.error) warnings.push(`Cannot parse ${slash(path.relative(root, file))}`);
          else {
            const config = ts.parseJsonConfigFileContent(parsed.config, { ...host, useCaseSensitiveFileNames: true, readDirectory: () => [] } as ts.ParseConfigHost, dir);
            configs.set(dir, config.options);
            for (const error of config.errors.filter(e => e.code !== 18003)) warnings.push(`${slash(path.relative(root, file))}: ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`);
          }
        }
        if (sourcePattern.test(ent.name) && !/\.d\.(?:ts|mts|cts)$/.test(ent.name) && (options.includeTests || !/\.(?:test|spec)\.[^.]+$/.test(ent.name))) {
          if ((await lstat(file)).size > 2_000_000) { warnings.push(`Skipped large file: ${slash(path.relative(root,file))}`); continue; }
          files.push(file);
          if (files.length > 5000) throw new Error('Repository exceeds the v1 limit of 5,000 TypeScript files. Analyze a subdirectory.');
        }
      }
    }
  }
  await walk(root);
  if (!files.length) throw new Error('No TypeScript source files found. Try --include-tests or choose a TypeScript project.');
  let repository = options.repository;
  if (!repository) {
    const remote = git(root, ['remote', 'get-url', 'origin']);
    if (remote) { try { repository = githubURL(remote.replace(/^git@github.com:/, 'https://github.com/')); } catch { /* offline evidence remains available */ } }
  }
  if (repository) repository = githubURL(repository);
  const commit = git(root, ['rev-parse', 'HEAD']);
  const dirty = git(root, ['status', '--porcelain', '--untracked-files=all']);
  if (dirty) warnings.push('Working tree has changes: GitHub links are disabled; embedded evidence reflects local files.');
  const prefix = git(root, ['rev-parse', '--show-prefix']) || '';
  let tracked = new Set<string>();
  try { tracked = new Set(execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 }).toString('utf8').split('\0')); } catch { /* not a Git repository */ }
  const id = (f: string) => slash(path.relative(root, f));
  const url = (f: string, line = 1) => repository && commit && !dirty && tracked.has(id(f)) ? `${repository}/blob/${commit}/${(prefix + id(f)).split('/').map(encodeURIComponent).join('/')}#L${line}` : undefined;
  const fileSet = new Set(files);
  const defaults: ts.CompilerOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowJs: false, resolveJsonModule: true };
  function compilerOptions(file: string) {
    let dir = path.dirname(file);
    while (inside(dir)) { if (configs.has(dir)) return { ...defaults, ...configs.get(dir) }; if (dir === root) break; dir = path.dirname(dir); }
    return defaults;
  }
  function sourceTarget(target: string, dir: string): string | undefined {
    const base = path.resolve(dir, target);
    const candidates = [base, base.replace(/\.(?:js|jsx|mjs|cjs)$/, '.ts'), base.replace(/\.mjs$/, '.mts'), base.replace(/\.cjs$/, '.cts'), `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
    return candidates.find(f => fileSet.has(f));
  }
  const entries = new Map<string, string[]>();
  function mark(target: unknown, dir: string, reason: string) {
    if (typeof target === 'string') { const f = sourceTarget(target,dir); if (f) entries.set(f, [...(entries.get(f) || []), reason]); }
    else if (target && typeof target === 'object') for (const value of Object.values(target)) mark(value,dir,reason);
  }
  for (const {dir,data} of packages) for (const key of ['source','main','module','bin','exports']) mark(data[key], dir, `package.json ${key}`);
  const modules: Atlas['modules'] = [], edges: Edge[] = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    const lines = content.split(/\r?\n/);
    const reasons = entries.get(file) || [];
    if (/^(?:index|main|app|server|cli)\.(?:ts|tsx|mts|cts)$/.test(path.basename(file))) reasons.push('filename convention (heuristic)');
    modules.push({id: id(file), group: slash(path.relative(root,path.dirname(file))) || '.', lines: lines.length, entry: [...new Set(reasons)], url: url(file)});
    function add(literal: ts.StringLiteralLike, node: ts.Node, kind: Edge['kind']) {
      const specifier = literal.text;
      const resolved = ts.resolveModuleName(specifier, file, compilerOptions(file), host).resolvedModule;
      let target = resolved?.resolvedFileName;
      if (!target) {
        for (const pkg of packages) {
          if (pkg.data.name === specifier) {
            target = sourceTarget(pkg.data.source || pkg.data.module || pkg.data.main || 'src/index.ts', pkg.dir);
            if (target) break;
          }
        }
      }
      const internal = target && fileSet.has(path.resolve(target));
      const resolution = internal ? 'internal' : specifier.startsWith('.') || specifier.startsWith('/') || (target && inside(target) && !target.includes('node_modules')) ? 'unresolved' : 'external';
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const end = sf.getLineAndCharacterOfPosition(node.end).line + 1;
      edges.push({source:id(file), target: internal ? id(target!) : specifier, specifier, kind, line, code:lines.slice(line-1, Math.min(end,line+7)).join('\n').slice(0,3000), url:url(file,line), resolution});
    }
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) add(node.moduleSpecifier,node,node.importClause?.isTypeOnly ? 'type' : 'import');
      else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) add(node.moduleSpecifier,node,node.isTypeOnly ? 'type' : 'export');
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) add(node.moduleReference.expression,node,'require');
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) add(node.argument.literal,node,'type');
      else if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) add(node.arguments[0],node,node.expression.kind === ts.SyntaxKind.ImportKeyword ? 'dynamic' : 'require');
      ts.forEachChild(node,visit);
    }
    visit(sf);
  }
  const unresolved = edges.filter(e => e.resolution === 'unresolved').length;
  if (unresolved) warnings.push(`${unresolved} imports could not be mapped to included TypeScript files. See the dependency inspector.`);
  return {schemaVersion:1, name: repository?.split('/').slice(-2).join('/') || path.basename(root), repository, commit, modules, edges, warnings};
}
