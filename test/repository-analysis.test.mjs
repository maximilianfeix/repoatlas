import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { analyzeLocalRepositoryFiles, analyzePublicRepository, analyzeRepositoryFiles, parsePublicRepositoryInput } from '../docs/repository-analysis.js';

const commit='0123456789abcdef0123456789abcdef01234567';
const files=new Map([
  ['package.json',JSON.stringify({name:'demo',main:'src/index.ts'})],
  ['pnpm-workspace.yaml','packages:\n  - "packages/*"\n'],
  ['tsconfig.json',JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@/*':['src/*']}}})],
  ['src/index.ts',[
    "import type { Utility } from '@/util.js';",
    "export { run } from './util.js';",
    "import('external-package');",
    "import(`./${name}`);",
    "require('./util.js');",
    "function local(require: (name: string) => void) { require('./ignored'); }",
    'export type { Utility };',
    "import { add } from '@demo/math';",
  ].join('\n')],
  ['src/util.ts','export const run = true;\n'],
  ['packages/math/package.json',JSON.stringify({name:'@demo/math',source:'src/index.ts'})],
  ['packages/math/src/index.ts','export const add = (a: number,b: number) => a+b;\n'],
]);

test('browser repository input accepts public GitHub shorthand and canonical URLs only',()=>{
  assert.deepEqual(parsePublicRepositoryInput('owner/repo.git'),{owner:'owner',repo:'repo',repository:'https://github.com/owner/repo'});
  assert.deepEqual(parsePublicRepositoryInput('https://github.com/owner/repo/'),{owner:'owner',repo:'repo',repository:'https://github.com/owner/repo'});
  for(const invalid of ['https://github.com/owner/repo/tree/main','http://github.com/owner/repo','https://github.com.evil.test/owner/repo','https://u:p@github.com/owner/repo','owner/repo?x=y','owner/../repo'])assert.throws(()=>parsePublicRepositoryInput(invalid),/GitHub|owner and repository|valid|public repository/);
});

test('browser analyzer shares CLI AST edges, path aliases, exact source lines, and pinned source URLs',()=>{
  const atlas=analyzeRepositoryFiles({files,owner:'owner',repo:'repo',commit,compiler:ts});
  assert.equal(atlas.name,'owner/repo');assert.equal(atlas.commit,commit);
  assert.deepEqual(atlas.modules.find(module=>module.id==='src/index.ts').entry,['package.json main','filename convention (heuristic)']);
  assert.deepEqual(atlas.modules.find(module=>module.id==='src/index.ts').exports.slice(0,2),[
    {name:'run',kind:'re-export',line:2,source:'./util.js'},
    {name:'Utility',kind:'re-export',line:7},
  ]);
  const edge=(specifier)=>atlas.edges.find(item=>item.specifier===specifier);
  assert.deepEqual([edge('@/util.js').resolution,edge('@/util.js').target,edge('@/util.js').line],['internal','src/util.ts',1]);
  assert.deepEqual([edge('./util.js').resolution,edge('./util.js').target,edge('./util.js').line],['internal','src/util.ts',2]);
  assert.deepEqual([edge('external-package').resolution,edge('external-package').externalName,edge('external-package').line],['external','external-package',3]);
  const computed=atlas.edges.find(item=>item.computed);assert.equal(computed.resolution,'unresolved');assert.equal(computed.line,4);
  assert.equal(atlas.edges.some(item=>item.specifier==='./ignored'),false);
  assert.match(edge('@/util.js').url,new RegExp(`/blob/${commit}/src/index\\.ts#L1$`));
  assert.match(edge('@/util.js').code,/import type \{ Utility \}/);
});

function jsonResponse(value,status=200,headers={}){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});}

test('public GitHub analysis pins all reads to a commit and avoids sending file contents to the API',async()=>{
  const apiCalls=[],rawCalls=[],progress=[];
  const fetchImpl=async(url,options={})=>{
    const parsed=new URL(url);
    if(parsed.hostname==='api.github.com'){
      apiCalls.push({url:parsed.href,headers:options.headers});
      if(parsed.pathname==='/repos/owner/repo')return jsonResponse({private:false,default_branch:'main'});
      if(parsed.pathname==='/repos/owner/repo/commits/main')return jsonResponse({sha:commit,commit:{tree:{sha:'abcdef0123456789'}}});
      if(parsed.pathname==='/repos/owner/repo/git/trees/abcdef0123456789')return jsonResponse({truncated:false,tree:[
        {type:'blob',path:'package.json',size:52},{type:'blob',path:'pnpm-workspace.yaml',size:30},{type:'blob',path:'tsconfig.json',size:58},
        {type:'blob',path:'src/index.ts',size:250},{type:'blob',path:'src/util.ts',size:80},
        {type:'blob',path:'packages/math/package.json',size:45},{type:'blob',path:'packages/math/src/index.ts',size:45},
        {type:'blob',path:'test/example.test.ts',size:20},
      ]});
      return jsonResponse({},404);
    }
    rawCalls.push(parsed.href);
    const path=decodeURIComponent(parsed.pathname.split('/').slice(4).join('/'));
    return new Response(files.get(path)??'',{status:files.has(path)?200:404});
  };
  const atlas=await analyzePublicRepository('owner/repo',{compiler:ts,fetchImpl,onProgress:item=>progress.push(item)});
  assert.equal(atlas.commit,commit);assert.equal(atlas.modules.length,3);assert.equal(atlas.edges.length,6);
  assert.equal(apiCalls.length,3);assert.equal(apiCalls.every(call=>call.headers['X-GitHub-Api-Version']==='2026-03-10'),true);
  assert.equal(rawCalls.every(url=>url.includes(`/${commit}/`)),true);
  assert.equal(apiCalls.some(call=>call.url.includes('typescript.js')||call.url.includes('contents')),false);
  assert.equal(progress.some(item=>item.stage==='sources'&&item.completed===7),true,JSON.stringify(progress));
  assert.equal(rawCalls.some(url=>url.endsWith('/pnpm-workspace.yaml')),true);
  assert.deepEqual([atlas.edges.find(edge=>edge.specifier==='@demo/math').resolution,atlas.edges.find(edge=>edge.specifier==='@demo/math').target],['internal','packages/math/src/index.ts']);
  assert.equal(atlas.warnings.some(warning=>warning.includes('inherited tsconfig settings')),true);
});

test('public browser analysis accepts only full SHA links and rebuilds the requested snapshot',async()=>{
  await assert.rejects(()=>analyzePublicRepository('owner/repo',{compiler:ts,ref:'main'}),/full 40- or 64-character Git SHA/);
  const requested=[];
  const fetchImpl=async url=>{
    const parsed=new URL(url);requested.push(parsed.href);
    if(parsed.hostname==='api.github.com'){
      if(parsed.pathname==='/repos/owner/repo')return jsonResponse({private:false,default_branch:'main'});
      if(parsed.pathname===`/repos/owner/repo/commits/${commit}`)return jsonResponse({sha:commit,commit:{tree:{sha:'abcdef0123456789'}}});
      if(parsed.pathname==='/repos/owner/repo/git/trees/abcdef0123456789')return jsonResponse({truncated:false,tree:[{type:'blob',path:'src/index.ts',size:25}]});
    }
    if(parsed.hostname==='raw.githubusercontent.com'&&parsed.pathname.endsWith(`/${commit}/src/index.ts`))return new Response('export const entry = true;',{status:200});
    return new Response('unexpected request',{status:500});
  };
  const atlas=await analyzePublicRepository('owner/repo',{compiler:ts,ref:commit,fetchImpl});
  assert.equal(atlas.commit,commit);assert.equal(atlas.repository,'https://github.com/owner/repo');
  assert.equal(requested.some(url=>url.endsWith(`/commits/${commit}`)),true);
  assert.equal(requested.every(url=>!url.includes('contents')),true);
});

test('browser analysis reports rate limits, truncated trees, and honors cancellation',async()=>{
  const rateLimit=async(url)=>new URL(url).pathname==='/repos/owner/repo'?jsonResponse({},403,{'x-ratelimit-remaining':'0','x-ratelimit-reset':String(Math.floor(Date.now()/1000)+60)}):jsonResponse({});
  await assert.rejects(()=>analyzePublicRepository('owner/repo',{compiler:ts,fetchImpl:rateLimit}),/rate limit is exhausted/);
  const truncated=async(url)=>{
    const path=new URL(url).pathname;
    if(path==='/repos/owner/repo')return jsonResponse({private:false,default_branch:'main'});
    if(path.endsWith('/commits/main'))return jsonResponse({sha:commit,commit:{tree:{sha:'abcdef0123456789'}}});
    return jsonResponse({truncated:true,tree:[]});
  };
  await assert.rejects(()=>analyzePublicRepository('owner/repo',{compiler:ts,fetchImpl:truncated}),/truncated this repository tree/);
  const controller=new AbortController();
  const cancel=async(url,options)=>{
    const path=new URL(url).pathname;
    if(path==='/repos/owner/repo')return jsonResponse({private:false,default_branch:'main'});
    if(path.endsWith('/commits/main'))return jsonResponse({sha:commit,commit:{tree:{sha:'abcdef0123456789'}}});
    if(path.endsWith('/git/trees/abcdef0123456789'))return jsonResponse({truncated:false,tree:[{type:'blob',path:'src/index.ts',size:20}]});
    return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
  };
  await assert.rejects(()=>analyzePublicRepository('owner/repo',{compiler:ts,fetchImpl:cancel,signal:controller.signal,onProgress:item=>{if(item.stage==='sources')controller.abort();}}),/abort/i);
});

test('browser bounds file counts and skips oversized files before fetching source',async()=>{
  const base=(tree)=>async url=>{
    const path=new URL(url).pathname;
    if(path==='/repos/owner/repo')return jsonResponse({private:false,default_branch:'main'});
    if(path.endsWith('/commits/main'))return jsonResponse({sha:commit,commit:{tree:{sha:'abcdef0123456789'}}});
    if(path.endsWith('/git/trees/abcdef0123456789'))return jsonResponse({truncated:false,tree});
    return new Response('unexpected source request',{status:500});
  };
  const many=Array.from({length:1201},(_,index)=>({type:'blob',path:`src/file-${index}.ts`,size:20}));
  await assert.rejects(()=>analyzePublicRepository('owner/repo',{compiler:ts,fetchImpl:base(many)}),/capped at 1,200/);
  await assert.rejects(()=>analyzePublicRepository('owner/repo',{compiler:ts,fetchImpl:base([{type:'blob',path:'src/index.ts',size:1_000_001}])}),/No readable TypeScript source files fit/);
});

test('local folder analysis shares AST resolution, omits remote links, and excludes tests/declarations by default',async()=>{
  const { analyzeLocalRepositoryFiles }=await import('../docs/repository-analysis.js');
  const localFile=(path,text)=>({name:path.split('/').at(-1),size:new TextEncoder().encode(text).length,webkitRelativePath:`secret-project/${path}`,text:async()=>text});
  const local=await analyzeLocalRepositoryFiles([
    localFile('package.json',JSON.stringify({name:'secret-project',main:'src/index.ts'})),
    localFile('tsconfig.json',JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@/*':['src/*']}}})),
    localFile('src/index.ts',"import { run } from '@/util.js';\nrun();"),
    localFile('src/util.ts','export const run = () => true;'),
    localFile('src/globals.d.ts','declare const ignored: string;'),
    localFile('tests/sample.test.ts',"import { run } from '../src/util.js';"),
  ],{compiler:ts});
  assert.equal(local.name,'Local/secret-project');
  assert.equal(local.commit,undefined);assert.equal(local.repository,undefined);
  assert.deepEqual(local.modules.map(module=>module.id),['src/index.ts','src/util.ts']);
  assert.equal(local.modules.find(module=>module.id==='src/index.ts').entry[0],'package.json main');
  const edge=local.edges.find(item=>item.specifier==='@/util.js');
  assert.equal(edge.resolution,'internal');assert.equal(edge.target,'src/util.ts');assert.equal(edge.line,1);
  assert.equal(edge.url,undefined);assert.match(edge.code,/import \{ run \}/);
  assert.match(local.warnings[0],/stays in this browser/);
  const withTests=await analyzeLocalRepositoryFiles([
    localFile('src/index.ts','export const entry = true;'),
    localFile('tests/sample.test.ts',"import { entry } from '../src/index.js';"),
  ],{compiler:ts,includeTests:true});
  assert.equal(withTests.modules.some(module=>module.id==='tests/sample.test.ts'),true);
});

test('local folder limits are checked before reading selected files',async()=>{
  const fake=(path,size)=>({name:path.split('/').at(-1),size,webkitRelativePath:`large-project/${path}`,text:async()=>{throw new Error('must not read')}});
  const many=Array.from({length:1201},(_,index)=>fake(`src/file-${index}.ts`,10));
  await assert.rejects(()=>analyzeLocalRepositoryFiles(many,{compiler:ts}),/capped at 1,200/);
  const tooLarge=Array.from({length:27},(_,index)=>fake(`src/file-${index}.ts`,999_999));
  await assert.rejects(()=>analyzeLocalRepositoryFiles(tooLarge,{compiler:ts}),/25 MB browser source limit/);
  const controller=new AbortController();controller.abort(new DOMException('Canceled by user','AbortError'));
  await assert.rejects(()=>analyzeLocalRepositoryFiles([fake('src/index.ts',10)],{compiler:ts,signal:controller.signal}),/Canceled by user/);
});

test('browser workspace resolution maps declared package exports and keeps ambiguous or undeclared names explicit',()=>{
  const workspaceFiles=new Map([
    ['package.json',JSON.stringify({name:'root',workspaces:{packages:['packages/*','apps/*']}})],
    ['apps/web/package.json',JSON.stringify({name:'web'})],
    ['apps/web/src/main.ts',"import { button } from '@acme/ui';\nimport { color } from '@acme/ui/tokens/color';\nimport { thing } from 'duplicate-pkg';\nimport { other } from 'nested-only';"],
    ['packages/ui/package.json',JSON.stringify({name:'@acme/ui',exports:{'.':{types:'./dist/types/index.d.ts',import:'./dist/index.js'},'./tokens/*':{import:'./dist/types/tokens/*.d.ts'}},source:'./src/index.ts'})],
    ['packages/ui/src/index.ts','export const button = true;'],
    ['packages/ui/src/tokens/color.ts','export const color = "blue";'],
    ['packages/dup-a/package.json',JSON.stringify({name:'duplicate-pkg'})],
    ['packages/dup-a/src/index.ts','export const a = 1;'],
    ['packages/dup-b/package.json',JSON.stringify({name:'duplicate-pkg'})],
    ['packages/dup-b/src/index.ts','export const b = 2;'],
    ['nested/package.json',JSON.stringify({name:'nested-only'})],
    ['nested/src/index.ts','export const hidden = true;'],
  ]);
  const atlas=analyzeRepositoryFiles({files:workspaceFiles,owner:'owner',repo:'repo',commit,compiler:ts});
  const bySpecifier=specifier=>atlas.edges.find(edge=>edge.specifier===specifier);
  assert.deepEqual([bySpecifier('@acme/ui').resolution,bySpecifier('@acme/ui').target],['internal','packages/ui/src/index.ts']);
  assert.deepEqual([bySpecifier('@acme/ui/tokens/color').resolution,bySpecifier('@acme/ui/tokens/color').target],['internal','packages/ui/src/tokens/color.ts']);
  assert.equal(atlas.modules.find(module=>module.id==='packages/ui/src/index.ts').workspace,'packages/ui');
  assert.equal(bySpecifier('duplicate-pkg').resolution,'unresolved');
  assert.equal(bySpecifier('nested-only').resolution,'external');
  assert.match(atlas.warnings.join('\n'),/Multiple workspace packages use the name duplicate-pkg/);
});

test('pnpm workspace browser maps honor YAML include and exclude patterns',async()=>{
  const workspaceFiles=new Map([
    ['package.json','{}'],
    ['pnpm-workspace.yaml','packages:\n  - "packages/*"\n  - "!packages/ignored"\n'],
    ['apps/web.ts',"import { yes } from 'yes';\nimport { no } from 'no';"],
    ['packages/yes/package.json',JSON.stringify({name:'yes',source:'src/index.ts'})],
    ['packages/yes/src/index.ts','export const yes = true;'],
    ['packages/ignored/package.json',JSON.stringify({name:'no',source:'src/index.ts'})],
    ['packages/ignored/src/index.ts','export const no = true;'],
  ]);
  const atlas=analyzeRepositoryFiles({files:workspaceFiles,owner:'owner',repo:'repo',commit,compiler:ts});
  const yes=atlas.edges.find(edge=>edge.specifier==='yes'),no=atlas.edges.find(edge=>edge.specifier==='no');
  assert.deepEqual([yes.resolution,yes.target],['internal','packages/yes/src/index.ts']);
  assert.equal(no.resolution,'external');
  const localFile=(path,text)=>({name:path.split('/').at(-1),size:new TextEncoder().encode(text).length,webkitRelativePath:`workspace/${path}`,text:async()=>text});
  const local=await analyzeLocalRepositoryFiles([...workspaceFiles].map(([path,text])=>localFile(path,text)),{compiler:ts});
  assert.deepEqual([local.edges.find(edge=>edge.specifier==='yes').resolution,local.edges.find(edge=>edge.specifier==='yes').target],['internal','packages/yes/src/index.ts']);
});
