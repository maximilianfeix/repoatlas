import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const examples=JSON.parse(await readFile('docs/examples/manifest.json','utf8'));
const manifest=[];
const temp=await mkdtemp(path.join(tmpdir(),'repoatlas-examples-'));
try{
  for(const {name,url,commit} of examples){
    if(typeof name!=='string'||!/^[a-z0-9-]+$/.test(name)||typeof url!=='string'||!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(url)||typeof commit!=='string'||!/^[a-f0-9]{40}$/.test(commit))throw new Error('Every example needs a valid name, GitHub URL, and pinned commit in docs/examples/manifest.json.');
    const checkout=path.join(temp,name);
    execFileSync('git',['init','--quiet',checkout]);
    execFileSync('git',['-C',checkout,'remote','add','origin',url]);
    execFileSync('git',['-C',checkout,'fetch','--quiet','--depth=1','origin',commit],{env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_LFS_SKIP_SMUDGE:'1'}});
    execFileSync('git',['-C',checkout,'checkout','--quiet','--detach','FETCH_HEAD']);
    execFileSync(process.execPath,['dist/cli.js',checkout,'-o',`docs/examples/${name}.html`,'--force'],{stdio:'inherit'});
    const html=await readFile(`docs/examples/${name}.html`,'utf8');
    const data=JSON.parse(html.match(/<script id="atlas-data" type="application\/json">(.*?)<\/script>/s)[1]);
    if(data.commit!==commit)throw new Error(`Example ${name} resolved to ${data.commit}, expected pinned commit ${commit}.`);
    manifest.push({name,url,commit,modules:data.modules.length,connections:data.edges.filter(e=>e.resolution==='internal').length,warnings:data.warnings});
  }
}finally{await rm(temp,{recursive:true,force:true});}
await writeFile('docs/examples/manifest.json',JSON.stringify(manifest,null,2)+'\n');
// Keep upstream license notices inside the shareable artifacts as well.
await import('./notices.mjs');
