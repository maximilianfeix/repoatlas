import { visitModuleDependencies } from './assets/syntax.js';

const API='https://api.github.com';
const ignoredDirectories=new Set(['node_modules','.git','dist','build','coverage','.next','.turbo','vendor']);
const sourcePattern=/\.(?:ts|tsx|mts|cts)$/i;
const testPattern=/(^|\/)(?:__tests__|tests?|fixtures?|mocks?)(\/|$)|\.(?:test|spec|stories)\.(?:ts|tsx|mts|cts)$/i;
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
function eligibleSource(path,includeTests){return sourcePattern.test(path)&&!isIgnored(path)&&(includeTests||!testPattern.test(path));}
function rawUrl(repository,commit,path){return `https://raw.githubusercontent.com/${repository.owner}/${repository.repo}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`;}

async function loadFiles(entries,repository,commit,{fetchImpl,signal,onProgress,includeTests}){
  const files=new Map();let completed=0,sourceBytes=0,next=0;
  const excluded=[];
  const selected=entries.filter(entry=>entry.type==='blob'&&!isIgnored(entry.path)&&(
    eligibleSource(entry.path,includeTests)||entry.path==='package.json'||/(^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(entry.path)
  ));
  const sources=selected.filter(entry=>eligibleSource(entry.path,true));
  const manifests=selected.filter(entry=>entry.path==='package.json'||/(^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(entry.path));
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

function sourceFiles(files){return [...files.keys()].filter(file=>sourcePattern.test(file)).sort(compare);}
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

export function analyzeRepositoryFiles({files,owner,repo,commit,compiler,includeTests=false}){
  const warnings=[],root=`/repoatlas/${owner}/${repo}`,paths=sourceFiles(files).filter(file=>includeTests||!testPattern.test(file));
  const modulesSet=new Set(paths),moduleEntries=entryTargets(files,root,modulesSet);
  const options=compilerOptions(compiler,files,root,warnings);
  const host=makeCompilerHost(compiler,files,root),modules=[],edges=[];let computed=0;
  const fileUrl=(file,line)=>`https://github.com/${owner}/${repo}/blob/${commit}/${file.split('/').map(encodeURIComponent).join('/')}#L${line}`;
  for(const file of paths){
    const text=files.get(file);if(text===undefined)continue;
    const absoluteFile=absolute(root,file),source=compiler.createSourceFile(absoluteFile,text,compiler.ScriptTarget.Latest,true,/\.tsx$/i.test(file)?compiler.ScriptKind.TSX:compiler.ScriptKind.TS);
    const group=file.includes('/')?file.slice(0,file.lastIndexOf('/')):'.',lineCount=text.split(/\r?\n/).length;
    modules.push({id:file,group,lines:lineCount,entry:moduleEntries.get(file)??[],url:fileUrl(file,1)});
    const lines=text.split(/\r?\n/);
    const add=(expression,node,kind)=>{
      const specifier=expression.text,resolved=compiler.resolveModuleName(specifier,absoluteFile,options,host).resolvedModule?.resolvedFileName;
      const targetPath=resolved?relative(root,resolved):undefined;
      const internal=!!targetPath&&modulesSet.has(targetPath);
      const resolution=internal?'internal':specifier.startsWith('.')||specifier.startsWith('/')||!!targetPath?'unresolved':'external';
      const line=source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,end=source.getLineAndCharacterOfPosition(node.end).line+1;
      edges.push({source:file,target:internal?targetPath:specifier,specifier,kind,line,code:lines.slice(line-1,Math.min(end,line+7)).join('\n').slice(0,3000),url:fileUrl(file,line),resolution,...(resolution==='external'?externalInfo(specifier):{})});
    };
    const addComputed=(expression,node,kind)=>{
      const specifier=expression.getText(source),line=source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,end=source.getLineAndCharacterOfPosition(node.end).line+1;
      computed++;edges.push({source:file,target:specifier,specifier,kind,line,code:lines.slice(line-1,Math.min(end,line+7)).join('\n').slice(0,3000),url:fileUrl(file,line),resolution:'unresolved',computed:true});
    };
    visitModuleDependencies(compiler,source,add,addComputed);
  }
  const unresolved=edges.filter(edge=>edge.resolution==='unresolved').length;
  if(unresolved)warnings.push(`${unresolved} imports could not be mapped to included TypeScript source files. See the dependency inspector.`);
  if(computed)warnings.push(`${computed} computed import expression${computed===1?'':'s'} shown as unresolved evidence; targets are not inferred.`);
  return {schemaVersion:1,name:`${owner}/${repo}`,repository:`https://github.com/${owner}/${repo}`,commit,modules,edges,warnings};
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
    eligibleSource(entry.path,includeTests)||entry.path==='package.json'||/(^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(entry.path)
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
