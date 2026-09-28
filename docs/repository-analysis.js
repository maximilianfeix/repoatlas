import { visitModuleDependencies } from './assets/syntax.js';

const API='https://api.github.com';
const ignoredDirectories=new Set(['node_modules','.git','dist','build','coverage','.next','.turbo','vendor']);
const sourcePattern=/\.(?:ts|tsx|mts|cts)$/i;
const declarationPattern=/\.d\.(?:ts|mts|cts)$/i;
const testPattern=/(^|\/)(?:__tests__|tests?|fixtures?|mocks?)(\/|$)|\.(?:test|spec|stories)\.(?:ts|tsx|mts|cts)$/i;
const tsconfigPattern=/(^|\/)tsconfig(?:\.[^/]+)?\.json$/i;
const isManifest=path=>/(^|\/)package\.json$/i.test(path)||tsconfigPattern.test(path)||path==='pnpm-workspace.yaml';
const normalized=(value)=>{
  const parts=[];for(const part of value.replaceAll('\\','/').split('/')){if(!part||part==='.')continue;if(part==='..')parts.pop();else parts.push(part);}return `${value.startsWith('/')?'/':''}${parts.join('/')}`;
};
const join=(...parts)=>normalized(parts.filter(Boolean).join('/'));
const compare=(a,b)=>a<b?-1:a>b?1:0;

export function parsePublicRepositoryInput(input){
  const value=input.trim();let owner,repo;
  if(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value))[
    owner,repo
  ]=value.split('/');
  else{
    let url;try{url=new URL(value);}catch{throw new Error('Enter owner/repo or a public GitHub URL.');}
    if(url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password||url.search||url.hash)throw new Error('Use a public repository URL on https://github.com.');
    const pieces=url.pathname.split('/').filter(Boolean);
    if(pieces.length!==2)throw new Error('Use a repository URL with exactly an owner and repository name.');
    [owner,repo]=pieces;
  }
  repo=repo.replace(/\.git$/i,'');
  if(!owner||!repo||owner==='.'||owner==='..'||repo==='.'||repo==='..')throw new Error('Enter a valid GitHub owner and repository name.');
  return {owner,repo,repository:`https://github.com/${owner}/${repo}`};
}

function apiError(response,body){
  if(response.status===403&&response.headers.get('x-ratelimit-remaining')==='0'){
    const reset=Number(response.headers.get('x-ratelimit-reset'));
    const time=Number.isFinite(reset)?new Date(reset*1000).toLocaleTimeString():undefined;
    return new Error(`GitHub’s public API rate limit is exhausted${time?` until about ${time}`:''}. Try again later or use the local CLI.`);
  }
  if(response.status===404)return new Error('Repository or default-branch source was not found. Browser maps support public GitHub repositories only.');
  if(response.status===403)return new Error('GitHub refused this request. Check the public API rate limit or open the repository with the local CLI.');
  return new Error(`GitHub request failed (${response.status})${body?.message?`: ${body.message}`:''}.`);
}

async function requestJson(fetchImpl,url,signal){
  const response=await fetchImpl(url,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},signal});
  if(!response.ok){let body;try{body=await response.json();}catch{}throw apiError(response,body);}
  return response.json();
}

function isIgnored(path){return path.split('/').some(part=>ignoredDirectories.has(part));}
function eligibleSource(path,includeTests){return sourcePattern.test(path)&&!declarationPattern.test(path)&&!isIgnored(path)&&(includeTests||!testPattern.test(path));}
function rawUrl(repository,commit,path){return `https://raw.githubusercontent.com/${repository.owner}/${repository.repo}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`;}

async function loadFiles(entries,repository,commit,{fetchImpl,signal,onProgress,includeTests}){
  const files=new Map();let completed=0,sourceBytes=0,next=0;
  const excluded=[];
  const selected=entries.filter(entry=>entry.type==='blob'&&!isIgnored(entry.path)&&(
    eligibleSource(entry.path,includeTests)||isManifest(entry.path)
  ));
  const sources=selected.filter(entry=>eligibleSource(entry.path,true));
  const manifests=selected.filter(entry=>isManifest(entry.path));
  if(sources.length>1200)throw new Error(`This repository has ${sources.length.toLocaleString()} TypeScript files. The browser flow is capped at 1,200; use the local CLI for larger repositories.`);
  if(manifests.length>300)throw new Error('This repository has too many package and TypeScript configuration files for the browser flow. Use the local CLI.');
  const queue=[...sources,...manifests.filter(item=>!sources.some(source=>source.path===item.path))];
  const large=queue.filter(entry=>Number(entry.size)>1_000_000);
  for(const entry of large)excluded.push(`${entry.path} is larger than 1 MB`);
  const work=queue.filter(entry=>!large.includes(entry));
  const controller=new AbortController();
  const abort=()=>controller.abort(signal?.reason);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  try{
    async function worker(){
      while(next<work.length){
        if(controller.signal.aborted)throw controller.signal.reason??new DOMException('Aborted','AbortError');
        const entry=work[next++];
        const response=await fetchImpl(rawUrl(repository,commit,entry.path),{signal:controller.signal});
        if(!response.ok)throw new Error(`Could not read ${entry.path} from the pinned GitHub commit (HTTP ${response.status}).`);
        const text=await response.text();
        sourceBytes+=new TextEncoder().encode(text).byteLength;
        if(sourceBytes>25_000_000)throw new Error('This repository exceeds the 25 MB browser source limit. Use the local CLI.');
        files.set(entry.path,text);completed++;onProgress?.({completed,total:work.length,path:entry.path});
      }
    }
    await Promise.all(Array.from({length:Math.min(8,work.length)},worker));
  }catch(error){controller.abort();throw error;}
  finally{signal?.removeEventListener('abort',abort);}
  return {files,excluded};
}

function sourceFiles(files){return [...files.keys()].filter(file=>sourcePattern.test(file)&&!declarationPattern.test(file)).sort(compare);}
function absolute(root,file){return join(root,file);}
function relative(root,file){const path=normalized(file);return path.startsWith(`${root}/`)?path.slice(root.length+1):path===root?'':path;}
function compilerOptions(compiler,files,root,warnings){
  const configText=files.get('tsconfig.json');
  if(!configText)return {module:compiler.ModuleKind.ESNext,moduleResolution:compiler.ModuleResolutionKind.Bundler,target:compiler.ScriptTarget.Latest,allowImportingTsExtensions:true};
  try{
    const config=JSON.parse(configText);
    if(config.extends)warnings.push('The root tsconfig extends another configuration; browser analysis uses its local compilerOptions only.');
    const converted=compiler.convertCompilerOptionsFromJson(config.compilerOptions??{},root);
    for(const diagnostic of converted.errors)warnings.push(compiler.flattenDiagnosticMessageText(diagnostic.messageText,' '));
    return {module:compiler.ModuleKind.ESNext,moduleResolution:compiler.ModuleResolutionKind.Bundler,target:compiler.ScriptTarget.Latest,allowImportingTsExtensions:true,...converted.options};
  }catch{warnings.push('The root tsconfig.json could not be read; default TypeScript module resolution is used.');return {module:compiler.ModuleKind.ESNext,moduleResolution:compiler.ModuleResolutionKind.Bundler,target:compiler.ScriptTarget.Latest,allowImportingTsExtensions:true};}
}

function makeCompilerHost(compiler,files,root){
  const directories=new Set([root]);
  for(const file of files.keys())for(let dir=join(root,file.split('/').slice(0,-1).join('/'));dir&&dir!==root;dir=join(dir,'..'))directories.add(dir);
  const fileExists=file=>files.has(relative(root,file));
  return {
    fileExists,
    readFile:file=>files.get(relative(root,file)),
    directoryExists:directory=>directories.has(normalized(directory)),
    getCurrentDirectory:()=>root,
    getDirectories:directory=>[...directories].filter(item=>item.startsWith(`${normalized(directory)}/`)&&!item.slice(normalized(directory).length+1).includes('/')).map(item=>item.slice(normalized(directory).length+1)).sort(compare),
    realpath:file=>normalized(file),
    useCaseSensitiveFileNames:()=>true,
  };
}

function externalInfo(specifier){
  if(/^(?:[A-Za-z][\w+.-]*:|\/\/)/.test(specifier)){
    try{const url=new URL(specifier);return {externalKind:'url',externalName:url.origin==='null'?`${url.protocol}//${url.pathname.split('/')[1]??''}`:url.origin};}catch{return {externalKind:'url',externalName:specifier};}
  }
  if(specifier.startsWith('#')||!specifier)return {externalKind:'other',externalName:specifier||'(empty specifier)'};
  const scoped=specifier.match(/^(@[^/]+\/[^/]+)/);return {externalKind:'package',externalName:scoped?.[1]??specifier.split('/')[0]};
}

function entryTargets(files,root,modules){
  const entries=new Map();
  const find=(raw,dir)=>{
    if(typeof raw!=='string')return;
    const base=join(dir,raw.replace(/^\.\//,''));
    for(const candidate of [base,...['.ts','.tsx','.mts','.cts','/index.ts','/index.tsx'].map(ext=>base+ext)])if(modules.has(candidate))return candidate;
  };
  const mark=(value,dir,reason)=>{
    if(typeof value==='string'){const target=find(value,dir);if(target)entries.set(target,[...(entries.get(target)??[]),reason]);}
    else if(value&&typeof value==='object')for(const item of Object.values(value))mark(item,dir,reason);
  };
  for(const [file,text] of files)if(file==='package.json'||file.endsWith('/package.json')){
    try{const data=JSON.parse(text);for(const key of ['source','main','module','bin','exports'])mark(data[key],file.slice(0,-'package.json'.length),`package.json ${key}`);}catch{}
  }
  for(const module of modules)if(/(^|\/)(?:index|main|app|server|cli)\.(?:ts|tsx|mts|cts)$/i.test(module))entries.set(module,[...(entries.get(module)??[]),'filename convention (heuristic)']);
  return entries;
}

function workspaceMatch(pattern,directory){
  let source='^';
  for(let index=0;index<pattern.length;index++){
    if(pattern[index]==='*'&&pattern[index+1]==='*'&&pattern[index+2]==='/'){source+='(?:.*/)?';index+=2;}
    else if(pattern[index]==='*'&&pattern[index+1]==='*'){source+='.*';index++;}
    else if(pattern[index]==='*')source+='[^/]*';
    else source+=pattern[index].replace(/[|\\{}()[\]^$+?.]/g,'\\$&');
  }
  return new RegExp(`${source}$`).test(directory);
}

function workspaceSettings(files,warnings){
  const packages=[];let rootPackage;
  for(const [file,text] of files){
    if(file!=='package.json'&&!file.endsWith('/package.json'))continue;
    try{
      const data=JSON.parse(text),directory=file==='package.json'?'':file.slice(0,-'package.json'.length).replace(/\/$/,'');
      const item={dir:directory,data};packages.push(item);if(!directory)rootPackage=item;
    }catch{warnings.push(`Invalid ${file}; workspace metadata is skipped.`);}
  }
  const patterns=[];
  const configured=rootPackage?.data.workspaces,globs=Array.isArray(configured)?configured:configured?.packages;
  if(Array.isArray(globs))patterns.push(...globs.filter(pattern=>typeof pattern==='string'));
  const yaml=files.get('pnpm-workspace.yaml');
  if(yaml){
    let inPackages=false;
    for(const line of yaml.split(/\r?\n/)){
      if(/^packages\s*:\s*(?:#.*)?$/.test(line)){inPackages=true;continue;}
      if(inPackages&&/^\S/.test(line)&&!/^[ \t]*#/.test(line))break;
      if(!inPackages)continue;
      const match=line.match(/^\s*-\s*(?:'([^']+)'|"([^"]+)"|([^#\s]+))/),pattern=match?.[1]??match?.[2]??match?.[3];
      if(pattern)patterns.push(pattern);
    }
  }
  const isDeclared=directory=>patterns.some(pattern=>!pattern.startsWith('!')&&workspaceMatch(pattern,directory))&&!patterns.some(pattern=>pattern.startsWith('!')&&workspaceMatch(pattern.slice(1),directory));
  const workspaces=packages.filter(item=>item.dir&&typeof item.data.name==='string'&&isDeclared(item.dir)).sort((a,b)=>compare(a.dir,b.dir));
  const counts=new Map();for(const item of workspaces)counts.set(item.data.name,(counts.get(item.data.name)??0)+1);
  const ambiguous=new Set([...counts].filter(([,count])=>count>1).map(([name])=>name));
  for(const name of [...ambiguous].sort(compare))warnings.push(`Multiple workspace packages use the name ${name}; imports to that package are left unresolved.`);
  return {rootPackage,workspaces,ambiguous};
}

function conditionTargets(value,kind,customConditions=[]){
  if(typeof value==='string')return [value];
  if(Array.isArray(value))return value.flatMap(item=>conditionTargets(item,kind,customConditions));
  if(!value||typeof value!=='object')return [];
  const preference=['types',...customConditions,...(kind==='require'?['require','node','default','import','source']:['import','node','default','source','require'])];
  return [...preference,...Object.keys(value)].filter((key,index,all)=>all.indexOf(key)===index&&key in value).flatMap(key=>conditionTargets(value[key],kind,customConditions));
}

function workspaceSourceTarget(pkg,target,modules){
  if(typeof target!=='string'||target.startsWith('/')||target.includes('\\'))return undefined;
  const relativeTarget=target.replace(/^\.\//,''),source=pkg.data.source?.replace(/^\.\//,'');
  const sourceRoot=typeof source==='string'?source.slice(0,source.lastIndexOf('/')<0?0:source.lastIndexOf('/')):'src';
  const builtPath=relativeTarget.replace(/^(?:dist|build|lib)\/(?:(?:types|cjs|esm|commonjs|module)\/)?/,'');
  const bases=[join(pkg.dir,relativeTarget),join(pkg.dir,sourceRoot,builtPath),join(pkg.dir,'src',builtPath),join(pkg.dir,builtPath)];
  const candidates=[];
  for(const base of bases){
    if(pkg.dir&&base!==pkg.dir&&!base.startsWith(`${pkg.dir}/`))continue;
    candidates.push(base,base.replace(/\.d\.ts$/i,'.ts'),base.replace(/\.d\.mts$/i,'.mts'),base.replace(/\.d\.cts$/i,'.cts'),base.replace(/\.(?:js|jsx|mjs|cjs)$/i,'.ts'),base.replace(/\.mjs$/i,'.mts'),base.replace(/\.cjs$/i,'.cts'),...['.ts','.tsx','.mts','.cts','/index.ts','/index.tsx','/index.mts','/index.cts'].map(ext=>base+ext));
  }
  return candidates.find(candidate=>modules.has(candidate));
}

function workspaceTarget(specifier,kind,options,settings,modules){
  const segments=specifier.split('/'),packageLength=segments[0].startsWith('@')?2:1;
  const name=segments.slice(0,packageLength).join('/'),subpath=segments.slice(packageLength).join('/');
  const matches=settings.workspaces.filter(item=>item.data.name===name);
  if(settings.ambiguous.has(name)||matches.length>1)return undefined;
  const pkg=matches[0]??(settings.rootPackage?.data.name===name?settings.rootPackage:undefined);
  if(!pkg)return undefined;
  const exportMap=pkg.data.exports;let targets=[],mappedSubpath=subpath;
  if(exportMap!==undefined){
    const exportPath=subpath?`./${subpath}`:'.';
    if(typeof exportMap==='string'||Array.isArray(exportMap)){
      if(subpath)return undefined;targets=conditionTargets(exportMap,kind,options.customConditions??[]);
    }else if(exportMap&&typeof exportMap==='object'){
      const entries=Object.entries(exportMap),subpathEntries=entries.filter(([key])=>key==='.'||key.startsWith('./'));
      if(!subpathEntries.length){if(subpath||!entries.length)return undefined;targets=conditionTargets(exportMap,kind,options.customConditions??[]);}
      else{
        let found=subpathEntries.find(([key])=>key===exportPath),capture='';
        if(!found){
          const patterned=subpathEntries.map(([key,value])=>{
            const star=key.indexOf('*');if(star<0)return undefined;
            const before=key.slice(0,star),after=key.slice(star+1);
            if(!exportPath.startsWith(before)||!exportPath.endsWith(after))return undefined;
            return {key,value,capture:exportPath.slice(before.length,exportPath.length-after.length),specificity:before.length+after.length};
          }).filter(Boolean).sort((a,b)=>b.specificity-a.specificity);
          if(patterned[0]){found=[patterned[0].key,patterned[0].value];capture=patterned[0].capture;}
        }
        if(!found)return undefined;
        const [key,value]=found;
        mappedSubpath=key.includes('*')?key.replaceAll('*',capture).replace(/^\.\//,''):key==='.'?'':key.replace(/^\.\//,'');
        targets=conditionTargets(value,kind,options.customConditions??[]).map(target=>target.replaceAll('*',capture));
      }
    }else return undefined;
  }
  for(const target of targets){const found=workspaceSourceTarget(pkg,target,modules);if(found)return found;}
  const source=typeof pkg.data.source==='string'?pkg.data.source.replace(/^\.\//,''):undefined;
  const sourceRoot=source?source.slice(0,source.lastIndexOf('/')<0?0:source.lastIndexOf('/')):'src';
  const fallbacks=subpath?[source?join(sourceRoot,mappedSubpath):'',source?join(sourceRoot,subpath):'',subpath]:[source??'',join(sourceRoot,'index.ts'),'src/index.ts','index.ts'];
  for(const target of fallbacks){if(!target)continue;const found=workspaceSourceTarget(pkg,target,modules);if(found)return found;}
  return undefined;
}
function workspaceName(specifier){const segments=specifier.split('/');return segments[0]?.startsWith('@')?segments.slice(0,2).join('/'):segments[0];}

function publicExports(compiler,source){
  const result=[],kind=(node)=>node.modifiers?.some(item=>item.kind===compiler.SyntaxKind.ExportKeyword),isDefault=node=>node.modifiers?.some(item=>item.kind===compiler.SyntaxKind.DefaultKeyword);
  const add=(node,name,type,extra={})=>result.push({name,kind:type,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,...extra});
  for(const node of source.statements){
    if(compiler.isExportDeclaration(node)){
      const from=node.moduleSpecifier&&compiler.isStringLiteral(node.moduleSpecifier)?node.moduleSpecifier.text:undefined,clause=node.exportClause;
      if(!clause)add(node,'*','re-export-all',from===undefined?{}:{source:from});
      else if(compiler.isNamespaceExport(clause))add(node,clause.name.text,'re-export-all',from===undefined?{}:{source:from});
      else for(const item of clause.elements){const name=item.name.text,local=item.propertyName?.text??name;add(node,name,'re-export',{...(local!==name?{localName:local}:{}),...(from===undefined?{}:{source:from})});}
      continue;
    }
    if(compiler.isExportAssignment(node)){add(node,'=','assignment',{localName:node.expression.getText(source)});continue;}
    if(!kind(node))continue;
    const named=(name,type)=>add(node,isDefault(node)?'default':name,type,isDefault(node)&&name!=='default'?{localName:name}:{});
    if(compiler.isFunctionDeclaration(node))named(node.name?.text??'default','function');
    else if(compiler.isClassDeclaration(node))named(node.name?.text??'default','class');
    else if(compiler.isInterfaceDeclaration(node))named(node.name.text,'interface');
    else if(compiler.isTypeAliasDeclaration(node))named(node.name.text,'type');
    else if(compiler.isEnumDeclaration(node))named(node.name.text,'enum');
    else if(compiler.isModuleDeclaration(node))named(node.name.getText(source).replace(/^['"]|['"]$/g,''),'namespace');
    else if(compiler.isVariableStatement(node))for(const declaration of node.declarationList.declarations){const names=[];const visit=binding=>{if(compiler.isIdentifier(binding))names.push(binding.text);else for(const element of binding.elements)if(!compiler.isOmittedExpression(element))visit(element.name);};visit(declaration.name);for(const name of names)named(name,'variable');}
  }
  return result.sort((a,b)=>a.line-b.line||a.name.localeCompare(b.name)||a.kind.localeCompare(b.kind));
}

export function analyzeRepositoryFiles({files,owner,repo,commit,compiler,includeTests=false}){
  const warnings=[],root=`/repoatlas/${owner}/${repo}`,paths=sourceFiles(files).filter(file=>includeTests||!testPattern.test(file));
  const modulesSet=new Set(paths),moduleEntries=entryTargets(files,root,modulesSet);
  const workspace=workspaceSettings(files,warnings);
  const options=compilerOptions(compiler,files,root,warnings);
  const host=makeCompilerHost(compiler,files,root),modules=[],edges=[];let computed=0;
  const fileUrl=(file,line)=>commit?`https://github.com/${owner}/${repo}/blob/${commit}/${file.split('/').map(encodeURIComponent).join('/')}#L${line}`:undefined;
  for(const file of paths){
    const text=files.get(file);if(text===undefined)continue;
    const absoluteFile=absolute(root,file),source=compiler.createSourceFile(absoluteFile,text,compiler.ScriptTarget.Latest,true,/\.tsx$/i.test(file)?compiler.ScriptKind.TSX:compiler.ScriptKind.TS);
    const group=file.includes('/')?file.slice(0,file.lastIndexOf('/')):'.',lineCount=text.split(/\r?\n/).length;
    const packageOwner=workspace.workspaces.filter(item=>item.dir&&file.startsWith(`${item.dir}/`)).sort((a,b)=>b.dir.length-a.dir.length)[0];
    modules.push({id:file,group,lines:lineCount,entry:moduleEntries.get(file)??[],exports:publicExports(compiler,source),...(packageOwner?{workspace:packageOwner.dir}:{}),...(fileUrl(file,1)?{url:fileUrl(file,1)}:{})});
    const lines=text.split(/\r?\n/);
    const add=(expression,node,kind)=>{
      const specifier=expression.text,resolved=compiler.resolveModuleName(specifier,absoluteFile,options,host).resolvedModule?.resolvedFileName;
      let targetPath=resolved?relative(root,resolved):undefined;
      let internal=!!targetPath&&modulesSet.has(targetPath);
      if(!internal){const target=workspaceTarget(specifier,kind,options,workspace,modulesSet);if(target){targetPath=target;internal=true;}}
      const ambiguous=workspace.ambiguous.has(workspaceName(specifier));
      const resolution=internal?'internal':ambiguous||specifier.startsWith('.')||specifier.startsWith('/')||!!targetPath?'unresolved':'external';
      const line=source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,end=source.getLineAndCharacterOfPosition(node.end).line+1;
      edges.push({source:file,target:internal?targetPath:specifier,specifier,kind,line,code:lines.slice(line-1,Math.min(end,line+7)).join('\n').slice(0,3000),...(fileUrl(file,line)?{url:fileUrl(file,line)}:{}),resolution,...(resolution==='external'?externalInfo(specifier):{})});
    };
    const addComputed=(expression,node,kind)=>{
      const specifier=expression.getText(source),line=source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,end=source.getLineAndCharacterOfPosition(node.end).line+1;
      computed++;edges.push({source:file,target:specifier,specifier,kind,line,code:lines.slice(line-1,Math.min(end,line+7)).join('\n').slice(0,3000),...(fileUrl(file,line)?{url:fileUrl(file,line)}:{}),resolution:'unresolved',computed:true});
    };
    visitModuleDependencies(compiler,source,add,addComputed);
  }
  const unresolved=edges.filter(edge=>edge.resolution==='unresolved').length;
  if(unresolved)warnings.push(`${unresolved} imports could not be mapped to included TypeScript source files. See the dependency inspector.`);
  if(computed)warnings.push(`${computed} computed import expression${computed===1?'':'s'} shown as unresolved evidence; targets are not inferred.`);
  return {schemaVersion:1,name:`${owner}/${repo}`,...(commit?{repository:`https://github.com/${owner}/${repo}`,commit}:{}),modules,edges,warnings};
}

export async function analyzePublicRepository(input,{compiler,includeTests=false,fetchImpl=fetch,signal,onProgress}={}){
  if(!compiler)throw new Error('The TypeScript compiler is not loaded.');
  const repository=parsePublicRepositoryInput(input),base=`${API}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`;
  onProgress?.({stage:'repository',message:'Checking the public GitHub repository…'});
  const metadata=await requestJson(fetchImpl,base,signal);
  if(metadata.private)throw new Error('Browser maps support public repositories only. Use the local CLI for private repositories.');
  const branch=metadata.default_branch;if(typeof branch!=='string'||!branch)throw new Error('GitHub did not report a default branch for this repository.');
  const commitData=await requestJson(fetchImpl,`${base}/commits/${encodeURIComponent(branch)}`,signal);
  const commit=commitData.sha,treeSha=commitData.commit?.tree?.sha;
  if(typeof commit!=='string'||!/^([0-9a-f]{40}|[0-9a-f]{64})$/i.test(commit)||typeof treeSha!=='string')throw new Error('GitHub returned an invalid default-branch commit.');
  onProgress?.({stage:'tree',message:'Listing TypeScript files…'});
  const treeData=await requestJson(fetchImpl,`${base}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`,signal);
  if(treeData.truncated)throw new Error('GitHub truncated this repository tree. Use the local CLI for a complete map.');
  if(!Array.isArray(treeData.tree))throw new Error('GitHub returned an invalid repository tree.');
  const entries=treeData.tree.filter(entry=>entry.type==='blob'&&!isIgnored(entry.path)&&(
    eligibleSource(entry.path,includeTests)||isManifest(entry.path)
  ));
  const sourceCount=entries.filter(entry=>eligibleSource(entry.path,includeTests)).length;
  if(!sourceCount)throw new Error('No TypeScript source files were found. Use the local CLI for JavaScript repositories.');
  onProgress?.({stage:'sources',message:`Reading ${sourceCount.toLocaleString()} TypeScript files from the pinned commit…`});
  const {files,excluded}=await loadFiles(entries,repository,commit,{fetchImpl,signal,onProgress:progress=>onProgress?.({stage:'sources',...progress}),includeTests});
  if(sourceFiles(files).filter(file=>includeTests||!testPattern.test(file)).length===0)throw new Error('No readable TypeScript source files fit the 1 MB per-file browser limit. Use the local CLI for larger repositories.');
  const atlas=analyzeRepositoryFiles({files,owner:repository.owner,repo:repository.repo,commit,compiler,includeTests});
  atlas.warnings.unshift('Browser mode analyzes public TypeScript files on this device. It uses the root tsconfig compilerOptions; inherited tsconfig settings are not fetched.');
  if(excluded.length)atlas.warnings.unshift(`${excluded.length} oversized repository file${excluded.length===1?' was':'s were'} skipped (1 MB per-file browser limit).`);
  return atlas;
}

export async function analyzeLocalRepositoryFiles(fileList,{compiler,includeTests=false,signal,onProgress}={}){
  if(!compiler)throw new Error('The TypeScript compiler is not loaded.');
  const inputFiles=[...fileList];
  if(!inputFiles.length)throw new Error('Choose a folder containing TypeScript source files.');
  const firstEntry=inputFiles[0],firstFile=firstEntry.file??firstEntry;
  const firstPath=(firstEntry.path||firstFile.webkitRelativePath||firstFile.name).replaceAll('\\','/');
  const projectName=firstPath.includes('/')?firstPath.split('/')[0]:'local-project';
  const project=projectName.replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'local-project';
  const entries=[];
  for(const entry of inputFiles){
    const file=entry.file??entry;
    const raw=(entry.path||file.webkitRelativePath||file.name).replaceAll('\\','/');
    const pieces=raw.split('/').filter(Boolean);
    if(pieces.some(part=>part==='..'))continue;
    const path=pieces.length>1&&pieces[0]===projectName?pieces.slice(1).join('/'):pieces.join('/');
    if(!path||isIgnored(path))continue;
    const source=eligibleSource(path,includeTests),manifest=isManifest(path);
    if(source||manifest)entries.push({path,file,size:Number(entry.size??file.size)});
  }
  const sources=entries.filter(entry=>eligibleSource(entry.path,includeTests));
  if(sources.length>1200)throw new Error(`This folder has ${sources.length.toLocaleString()} TypeScript files. Browser analysis is capped at 1,200; use the local CLI for larger repositories.`);
  if(entries.filter(entry=>isManifest(entry.path)).length>300)throw new Error('This folder has too many package and TypeScript configuration files for browser analysis.');
  const oversized=entries.filter(entry=>entry.size>1_000_000),oversizedSet=new Set(oversized);
  const work=entries.filter(entry=>!oversizedSet.has(entry));
  const estimatedBytes=work.reduce((sum,entry)=>sum+entry.size,0);
  if(estimatedBytes>25_000_000)throw new Error('This folder exceeds the 25 MB browser source limit. Use the local CLI for larger repositories.');
  if(!sources.some(entry=>!oversizedSet.has(entry)))throw new Error('No readable TypeScript source files fit the 1 MB per-file browser limit.');
  const files=new Map();let next=0,completed=0,actualBytes=0;
  async function worker(){
    while(next<work.length){
      if(signal?.aborted)throw signal.reason??new DOMException('Aborted','AbortError');
      const entry=work[next++],text=await entry.file.text();
      actualBytes+=new TextEncoder().encode(text).byteLength;
      if(actualBytes>25_000_000)throw new Error('This folder exceeds the 25 MB browser source limit. Use the local CLI for larger repositories.');
      files.set(entry.path,text);completed++;onProgress?.({stage:'sources',completed,total:work.length,path:entry.path});
    }
  }
  onProgress?.({stage:'sources',message:`Reading ${sources.length.toLocaleString()} local TypeScript files…`});
  await Promise.all(Array.from({length:Math.min(8,work.length)},worker));
  const atlas=analyzeRepositoryFiles({files,owner:'Local',repo:project,compiler,includeTests});
  atlas.warnings.unshift('Local folder analysis stays in this browser. Source snippets are embedded in this HTML map; review them before sharing.');
  if(oversized.length)atlas.warnings.unshift(`${oversized.length} oversized repository file${oversized.length===1?' was':'s were'} skipped (1 MB per-file browser limit).`);
  return atlas;
}
