import { analyzePublicRepository, parsePublicRepositoryInput } from './repository-analysis.js';

const compilerUrl='https://cdn.jsdelivr.net/npm/typescript@6.0.3/lib/typescript.js';
const compilerIntegrity='sha384-hLq9xq2/tlk0vqCTYY2KECZxYi9UuHw/GLg6biud4KQQhLlq4x/OouQB+CusnUN3';
let compilerPromise;
let currentController;
let currentHtml;
const byId=(id)=>document.getElementById(id);

function loadCompiler(){
  if(window.ts?.version==='6.0.3')return Promise.resolve(window.ts);
  if(compilerPromise)return compilerPromise;
  compilerPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=compilerUrl;script.integrity=compilerIntegrity;script.crossOrigin='anonymous';script.async=true;
    script.onload=()=>window.ts?.version==='6.0.3'?resolve(window.ts):reject(new Error('The pinned TypeScript compiler did not load correctly.'));
    script.onerror=()=>reject(new Error('Could not load the pinned TypeScript compiler from jsDelivr. Check your connection and try again.'));
    document.head.append(script);
  }).catch(error=>{compilerPromise=undefined;throw error;});
  return compilerPromise;
}

function base64(bytes){let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary);}
async function digest(value){return `sha256-${base64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}`;}

async function createMapHtml(atlas){
  const [templateResponse,scriptResponse]=await Promise.all([
    fetch('./assets/map-template.html',{cache:'force-cache'}),
    fetch('./assets/map-ui.js',{cache:'force-cache'}),
  ]);
  if(!templateResponse.ok||!scriptResponse.ok)throw new Error('Could not load the RepoAtlas map renderer. Refresh the page and try again.');
  let template=await templateResponse.text();const script=await scriptResponse.text();
  const style=template.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  if(style===undefined||!template.includes('/*ATLAS_DATA*/')||!template.includes('/*ATLAS_SCRIPT*/'))throw new Error('The standalone map template is incomplete.');
  const [scriptHash,styleHash]=await Promise.all([digest(script),digest(style)]);
  template=template.replace("script-src 'unsafe-inline'; style-src 'unsafe-inline'",`script-src '${scriptHash}'; style-src '${styleHash}'`);
  const data=JSON.stringify(atlas).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return template.replace('/*ATLAS_DATA*/',()=>data).replace('/*ATLAS_SCRIPT*/',()=>script);
}

function progress(item){
  const text=byId('browser-progress-text'),bar=byId('browser-progress-value');
  text.textContent=item.message??(item.total?`Reading ${item.completed} of ${item.total} repository files…`:item.path?`Reading ${item.path}…`:'Preparing the architecture map…');
  const value=item.stage==='repository'?3:item.stage==='tree'?8:item.stage==='sources'&&item.total?8+Math.round(86*item.completed/item.total):item.stage==='sources'?8:95;
  bar.style.width=`${value}%`;
}

const input=byId('repo-url'),analyzeButton=byId('browser-analyze'),cancelButton=byId('browser-cancel'),progressPanel=byId('browser-progress'),errorPanel=byId('browser-error'),result=byId('browser-result'),frame=byId('browser-map'),download=byId('download-browser-map');

analyzeButton.addEventListener('click',async()=>{
  errorPanel.textContent='';result.hidden=true;frame.classList.remove('loaded');frame.srcdoc='';currentHtml=undefined;
  try{parsePublicRepositoryInput(input.value);}catch(error){errorPanel.textContent=error.message;input.focus();return;}
  currentController=new AbortController();analyzeButton.disabled=true;cancelButton.hidden=false;progressPanel.hidden=false;progressPanel.setAttribute('aria-busy','true');progress({stage:'repository',message:'Loading the pinned TypeScript compiler…'});
  try{
    const ts=await loadCompiler();
    const atlas=await analyzePublicRepository(input.value,{compiler:ts,includeTests:byId('browser-tests').checked,signal:currentController.signal,onProgress:progress});
    progress({stage:'render',message:'Building the interactive map…'});
    currentHtml=await createMapHtml(atlas);
    byId('browser-result-label').textContent=`${atlas.name} · ${atlas.modules.length.toLocaleString()} modules · ${atlas.edges.length.toLocaleString()} imports`;
    result.hidden=false;
    await new Promise((resolve,reject)=>{
      frame.onload=()=>{frame.classList.add('loaded');resolve();};
      frame.onerror=()=>reject(new Error('The interactive map could not be rendered.'));
      frame.srcdoc=currentHtml;
    });
    progress({stage:'complete',message:`Map ready at commit ${atlas.commit.slice(0,10)}.`});
    byId('command-status').textContent=`Browser map ready for ${atlas.name} at ${atlas.commit.slice(0,10)}.`;
  }catch(error){
    if(currentController.signal.aborted)progress({stage:'canceled',message:'Analysis canceled.'});
    else errorPanel.textContent=error instanceof Error?error.message:'Could not analyze this repository.';
  }finally{
    analyzeButton.disabled=false;cancelButton.hidden=true;progressPanel.removeAttribute('aria-busy');currentController=undefined;
  }
});

cancelButton.addEventListener('click',()=>currentController?.abort(new DOMException('Canceled by user','AbortError')));
download.addEventListener('click',()=>{
  if(!currentHtml)return;
  const repository=(byId('browser-result-label').textContent.split(' · ')[0]||'repository').replace(/[^A-Za-z0-9._-]+/g,'-');
  const url=URL.createObjectURL(new Blob([currentHtml],{type:'text/html;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`${repository}-architecture.html`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60_000);
});

document.querySelectorAll('[data-repo]').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.repo;}));
