import ts from 'typescript';
import { readdir, readFile, lstat, realpath } from 'node:fs/promises';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import type { Atlas, Edge } from './types.js';
import { activityCommitLimit, parseGitActivity } from './activity.js';
import { visitModuleDependencies } from './syntax.js';

const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', 'vendor']);
const typeScriptPattern = /\.(?:ts|tsx|mts|cts)$/;
const javaScriptPattern = /\.(?:js|jsx|mjs|cjs)$/;
const builtins = new Set(builtinModules.flatMap(name => [name, name.replace(/^node:/, '')]));
const slash = (s: string) => s.split(path.sep).join('/');
function externalDependency(specifier: string): {kind: NonNullable<Edge['externalKind']>; name: string} {
  if (builtins.has(specifier) || (specifier.startsWith('node:') && builtins.has(specifier.slice(5)))) {
    return {kind:'builtin',name:specifier.replace(/^node:/,'').split('/')[0]!};
  }
  if (/^(?:[A-Za-z][\w+.-]*:|\/\/)/.test(specifier)) {
    let name=specifier;
    try { const url=new URL(specifier); name=url.origin==='null'?`${url.protocol}//${url.pathname.split('/')[1]??''}`:url.origin; } catch { /* retain source spelling */ }
    return {kind:'url',name};
  }
  if (specifier.startsWith('#') || !specifier) return {kind:'other',name:specifier||'(empty specifier)'};
  const scoped=specifier.match(/^(@[^/]+\/[^/]+)/);
  return {kind:'package',name:scoped?.[1]??specifier.split('/')[0]!};
}
function workspaceMatch(pattern: string, directory: string): boolean {
  let source='^';
  for(let i=0;i<pattern.length;i++){
    if(pattern[i]==='*'&&pattern[i+1]==='*'&&pattern[i+2]==='/'){source+='(?:.*/)?';i+=2;}
    else if(pattern[i]==='*'&&pattern[i+1]==='*'){source+='.*';i++;}
    else if(pattern[i]==='*')source+='[^/]*';
    else source+=pattern[i]!.replace(/[|\\{}()[\]^$+?.]/g,'\\$&');
  }
  return new RegExp(`${source}$`).test(directory);
}
function isWorkspacePackage(directory: string, patterns: string[]): boolean {
  const includes=patterns.filter(pattern=>!pattern.startsWith('!'));
  const excludes=patterns.filter(pattern=>pattern.startsWith('!')).map(pattern=>pattern.slice(1));
  return includes.some(pattern=>workspaceMatch(pattern,directory))&&!excludes.some(pattern=>workspaceMatch(pattern,directory));
}
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

export async function analyze(input: string, options: { includeTests?: boolean; includeJS?: boolean; repository?: string; activityDays?: number } = {}): Promise<Atlas> {
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
        if ((typeScriptPattern.test(ent.name) || (options.includeJS && javaScriptPattern.test(ent.name))) && !/\.d\.(?:ts|mts|cts)$/.test(ent.name) && (options.includeTests || !/\.(?:test|spec)\.[^.]+$/.test(ent.name))) {
          if ((await lstat(file)).size > 2_000_000) { warnings.push(`Skipped large file: ${slash(path.relative(root,file))}`); continue; }
          files.push(file);
          if (files.length > 5000) throw new Error('Repository exceeds the v1 limit of 5,000 source files. Analyze a subdirectory.');
        }
      }
    }
  }
  await walk(root);
  if (!files.length) throw new Error(options.includeJS ? 'No TypeScript or JavaScript source files found. Try --include-tests or choose a source directory.' : 'No TypeScript source files found. Try --include-tests or choose a TypeScript project.');
  const rootPackage=packages.find(pkg=>pkg.dir===root);
  const workspacePatterns: string[]=[];
  const configuredWorkspaces=rootPackage?.data.workspaces;
  const packageGlobs=Array.isArray(configuredWorkspaces)?configuredWorkspaces:configuredWorkspaces?.packages;
  if(Array.isArray(packageGlobs))workspacePatterns.push(...packageGlobs.filter((pattern: unknown): pattern is string=>typeof pattern==='string'));
  try {
    const yaml=await readFile(path.join(root,'pnpm-workspace.yaml'),'utf8');
    let inPackages=false;
    for(const line of yaml.split(/\r?\n/)){
      if(/^packages\s*:\s*(?:#.*)?$/.test(line)){inPackages=true;continue;}
      if(inPackages&&/^\S/.test(line)&&!/^\s*#/.test(line))break;
      if(!inPackages)continue;
      const match=line.match(/^\s*-\s*(?:'([^']+)'|"([^"]+)"|([^#\s]+))/);
      const pattern=match?.[1]??match?.[2]??match?.[3];
      if(pattern)workspacePatterns.push(pattern);
    }
  } catch { /* pnpm workspace metadata is optional */ }
  const workspacePackages=packages
    .filter(pkg=>pkg.dir!==root&&typeof pkg.data.name==='string'&&isWorkspacePackage(slash(path.relative(root,pkg.dir)),workspacePatterns))
    .sort((a,b)=>slash(a.dir).localeCompare(slash(b.dir)));
  const workspaceNameCounts=new Map<string,number>();
  for(const pkg of workspacePackages)workspaceNameCounts.set(pkg.data.name,(workspaceNameCounts.get(pkg.data.name)??0)+1);
  const ambiguousWorkspaceNames=new Set([...workspaceNameCounts].filter(([,count])=>count>1).map(([name])=>name));
  for(const name of [...ambiguousWorkspaceNames].sort())warnings.push(`Multiple workspace packages use the name ${name}; imports to that package are left unresolved.`);
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
  let activity:Atlas['activity'];
  let activityChanges:Map<string,{commits:number;lastChanged:string}>|undefined;
  if(options.activityDays!==undefined){
    if(!Number.isSafeInteger(options.activityDays)||options.activityDays<1||options.activityDays>365)throw new Error('--activity-days must be a whole number from 1 to 365.');
    if(!commit||!tracked.size)throw new Error('--activity-days requires a Git repository with at least one commit.');
    if(prefix)throw new Error('--activity-days requires the Git repository root, not a subdirectory.');
    const shallow=git(root,['rev-parse','--is-shallow-repository'])==='true';
    let log:string;
    try{log=execFileSync('git',['-C',root,'log','--format=x%ct','--name-only','-z','--no-renames',`--since=${options.activityDays} days ago`,'--max-count=2000'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:15000,maxBuffer:16*1024*1024});}
    catch{throw new Error('Could not read recent Git activity. The repository history exceeded the bounded scan; use a shorter --activity-days window.');}
    const parsed=parseGitActivity(log,tracked);
    activity={days:options.activityDays,commitsScanned:parsed.commitsScanned,truncated:parsed.truncated,shallow};
    activityChanges=parsed.changes;
    if(shallow)warnings.push('Git history is shallow; the activity view may omit earlier commits in the selected window.');
    if(parsed.truncated)warnings.push(`Git activity scan reached its ${activityCommitLimit}-commit cap; some modules may be missing recent changes.`);
  }
  const id = (f: string) => slash(path.relative(root, f));
  const url = (f: string, line = 1) => repository && commit && !dirty && tracked.has(id(f)) ? `${repository}/blob/${commit}/${(prefix + id(f)).split('/').map(encodeURIComponent).join('/')}#L${line}` : undefined;
  const fileSet = new Set(files);
  const defaults: ts.CompilerOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowJs: options.includeJS ?? false, resolveJsonModule: true };
  function compilerOptions(file: string) {
    let dir = path.dirname(file);
    while (inside(dir)) { if (configs.has(dir)) return { ...defaults, ...configs.get(dir), allowJs: options.includeJS ? true : (configs.get(dir)!.allowJs ?? defaults.allowJs) }; if (dir === root) break; dir = path.dirname(dir); }
    return defaults;
  }
  function sourceTarget(target: string, dir: string): string | undefined {
    const base = path.resolve(dir, target);
    const candidates = [base, base.replace(/\.d\.ts$/, '.ts'), base.replace(/\.d\.mts$/, '.mts'), base.replace(/\.d\.cts$/, '.cts'), base.replace(/\.(?:js|jsx|mjs|cjs)$/, '.ts'), base.replace(/\.mjs$/, '.mts'), base.replace(/\.cjs$/, '.cts'), `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
    return candidates.find(f => fileSet.has(f));
  }
  function workspaceFile(pkg: {dir:string;data:any}, target: string): string | undefined {
    const file=sourceTarget(target,pkg.dir);
    if(!file)return undefined;
    const relative=path.relative(pkg.dir,file);
    return relative!== '..'&&!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative)?file:undefined;
  }
  function conditionTargets(value: unknown, kind: Edge['kind'], customConditions: string[] = []): string[] {
    if(typeof value==='string')return [value];
    if(Array.isArray(value))return value.flatMap(item=>conditionTargets(item,kind,customConditions));
    if(!value||typeof value!=='object')return [];
    const record=value as Record<string,unknown>;
    const preference=kind==='require'?['types',...customConditions,'require','node','default','import','source']:['types',...customConditions,'import','node','default','source','require'];
    return [...preference,...Object.keys(record)].filter((key,index,all)=>all.indexOf(key)===index&&key in record).flatMap(key=>conditionTargets(record[key],kind,customConditions));
  }
  function workspaceTarget(specifier: string, kind: Edge['kind'], options: ts.CompilerOptions): string | undefined {
    const customConditions=options.customConditions??[];
    const segments=specifier.split('/');
    const packageSegmentCount=segments[0]!.startsWith('@')?2:1;
    const packageName=segments.slice(0,packageSegmentCount).join('/');
    const packagePath=segments.slice(packageSegmentCount).join('/');
    const matches=workspacePackages.filter(candidate=>candidate.data.name===packageName);
    if(matches.length>1)return undefined;
    const pkg=matches[0]??(rootPackage?.data.name===packageName?rootPackage:undefined);
    if(!pkg)return undefined;
    const subpath=packagePath;
    const exportMap=pkg.data.exports;
    let exportTargets: string[]=[];
    let mappedSubpath=subpath;
    if(exportMap!==undefined){
      const exportPath=subpath?`./${subpath}`:'.';
      if(typeof exportMap==='string'){
        if(subpath)return undefined;
        exportTargets=conditionTargets(exportMap,kind,customConditions);
      }else if(Array.isArray(exportMap)){
        if(subpath||!exportMap.length)return undefined;
        exportTargets=conditionTargets(exportMap,kind);
      }else if(exportMap&&typeof exportMap==='object'){
        const entries=Object.entries(exportMap as Record<string,unknown>);
        const subpathEntries=entries.filter(([key])=>key==='.'||key.startsWith('./'));
        if(!subpathEntries.length){
          if(subpath||!entries.length||entries.some(([key])=>key.startsWith('.')))return undefined;
          exportTargets=conditionTargets(exportMap,kind,customConditions);
        }else{
          let found=subpathEntries.find(([key])=>key===exportPath);
          let capture='';
          if(!found){
            const patterned=subpathEntries.map(([key,value])=>{
              const star=key.indexOf('*');
              if(star<0)return undefined;
              const before=key.slice(0,star),after=key.slice(star+1);
              if(!exportPath.startsWith(before)||!exportPath.endsWith(after))return undefined;
              const middle=exportPath.slice(before.length,exportPath.length-after.length);
              return {key,value,capture:middle,specificity:before.length+after.length};
            }).filter((item):item is {key:string;value:unknown;capture:string;specificity:number}=>!!item).sort((a,b)=>b.specificity-a.specificity);
            const match=patterned[0];
            if(match){found=[match.key,match.value];capture=match.capture;}
          }
          if(!found)return undefined;
          const [key,value]=found;
          mappedSubpath=key.includes('*')?key.replaceAll('*',capture).replace(/^\.\//,''):key==='.'?'':key.replace(/^\.\//,'');
          exportTargets=conditionTargets(value,kind,customConditions).map(target=>target.replaceAll('*',capture));
        }
      }else return undefined;
    }
    for(const target of exportTargets){const resolved=workspaceFile(pkg,target);if(resolved)return resolved;}
    if(typeof pkg.data.source==='string'){
      const source=String(pkg.data.source).replace(/^\.\//,'');
      const candidates=subpath?[path.join(path.dirname(source),mappedSubpath),path.join(path.dirname(source),subpath)]:[source];
      for(const candidate of candidates){const resolved=workspaceFile(pkg,candidate);if(resolved)return resolved;}
    }
    const sourceRoot=typeof pkg.data.source==='string'?path.dirname(String(pkg.data.source).replace(/^\.\//,'')):'src';
    const inferred=subpath?[path.join(sourceRoot,mappedSubpath),path.join(sourceRoot,subpath),subpath]:[path.join(sourceRoot,'index.ts'),'src/index.ts','index.ts'];
    for(const candidate of inferred){const resolved=workspaceFile(pkg,candidate);if(resolved)return resolved;}
    return undefined;
  }
  const entries = new Map<string, string[]>();
  function mark(target: unknown, dir: string, reason: string) {
    if (typeof target === 'string') { const f = sourceTarget(target,dir); if (f) entries.set(f, [...(entries.get(f) || []), reason]); }
    else if (target && typeof target === 'object') for (const value of Object.values(target)) mark(value,dir,reason);
  }
  for (const {dir,data} of packages) for (const key of ['source','main','module','bin','exports']) mark(data[key], dir, `package.json ${key}`);
  const modules: Atlas['modules'] = [], edges: Edge[] = [];
  let computedImportCount = 0;
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    const lines = content.split(/\r?\n/);
    const reasons = entries.get(file) || [];
    if (/^(?:index|main|app|server|cli)\.(?:ts|tsx|mts|cts)$/.test(path.basename(file))) reasons.push('filename convention (heuristic)');
    const workspace=workspacePackages.filter(pkg=>file.startsWith(`${pkg.dir}${path.sep}`)).sort((a,b)=>b.dir.length-a.dir.length)[0];
    const moduleId=id(file),moduleActivity=activityChanges?.get(moduleId);
    modules.push({id: moduleId, group: slash(path.relative(root,path.dirname(file))) || '.', lines: lines.length, entry: [...new Set(reasons)], url: url(file), ...(workspace?{workspace:slash(path.relative(root,workspace.dir))}:{}),...(moduleActivity?{activity:moduleActivity}:{})});
    function add(literal: ts.StringLiteralLike, node: ts.Node, kind: Edge['kind']) {
      const specifier = literal.text;
      const resolved = ts.resolveModuleName(specifier, file, compilerOptions(file), host).resolvedModule;
      let target = resolved?.resolvedFileName;
      if (!target) {
        target=workspaceTarget(specifier,kind,compilerOptions(file));
      }
      if (!target) {
        for (const pkg of packages) {
          if (pkg.data.name === specifier) {
            if(ambiguousWorkspaceNames.has(pkg.data.name))break;
            if(pkg.dir!==root&&!workspacePackages.includes(pkg))break;
            if(pkg.data.exports!==undefined)break;
            target = sourceTarget(pkg.data.source || pkg.data.module || pkg.data.main || 'src/index.ts', pkg.dir);
            if (target) break;
          }
        }
      }
      const internal = target && fileSet.has(path.resolve(target));
      const resolution = internal ? 'internal' : specifier.startsWith('.') || specifier.startsWith('/') || (target && inside(target) && !target.includes('node_modules')) ? 'unresolved' : 'external';
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const end = sf.getLineAndCharacterOfPosition(node.end).line + 1;
      const dependency=resolution==='external'?externalDependency(specifier):undefined;
      edges.push({source:id(file), target: internal ? id(target!) : specifier, specifier, kind, line, code:lines.slice(line-1, Math.min(end,line+7)).join('\n').slice(0,3000), url:url(file,line), resolution, ...(dependency?{externalKind:dependency.kind,externalName:dependency.name}:{})});
    }
    function addComputed(expression: ts.Expression, node: ts.Node, kind: Edge['kind']) {
      const specifier = expression.getText(sf);
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const end = sf.getLineAndCharacterOfPosition(node.end).line + 1;
      computedImportCount++;
      edges.push({source:id(file), target:specifier, specifier, kind, line, code:lines.slice(line-1, Math.min(end,line+7)).join('\n').slice(0,3000), url:url(file,line), resolution:'unresolved', computed:true});
    }
    visitModuleDependencies(ts,sf,add,addComputed);
  }
  const unresolved = edges.filter(e => e.resolution === 'unresolved').length;
  if (unresolved) warnings.push(`${unresolved} imports could not be mapped to included source files. See the dependency inspector.`);
  if (computedImportCount) warnings.push(`${computedImportCount} computed import expression${computedImportCount === 1 ? '' : 's'} shown as unresolved evidence; targets are not inferred.`);
  return {schemaVersion:1, name: repository?.split('/').slice(-2).join('/') || path.basename(root), repository, commit,...(activity?{activity}:{}), modules, edges, warnings};
}
