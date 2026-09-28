import { parsePublicRepositoryInput } from './repository-analysis.js';
import { runAnalysisInWorker } from './analysis-client.js';

let currentController;
let currentHtml;
const byId=(id)=>document.getElementById(id);

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

const form=byId('repo-command-form'),input=byId('repo-url'),analyzeButton=byId('browser-analyze'),localButton=byId('browser-local'),localPicker=byId('browser-local-picker'),cancelButton=byId('browser-cancel'),progressPanel=byId('browser-progress'),errorPanel=byId('browser-error'),result=byId('browser-result'),frame=byId('browser-map'),download=byId('download-browser-map');

async function runAnalysis(request){
  errorPanel.textContent='';result.hidden=true;frame.classList.remove('loaded');frame.srcdoc='';currentHtml=undefined;
  currentController=new AbortController();analyzeButton.disabled=true;localButton.disabled=true;cancelButton.hidden=false;progressPanel.hidden=false;progressPanel.setAttribute('aria-busy','true');progress({stage:'repository',message:'Preparing background analysis…'});
  try{
    const atlas=await runAnalysisInWorker({...request,includeTests:byId('browser-tests').checked,signal:currentController.signal,onProgress:progress});
    progress({stage:'render',message:'Building the interactive map…'});
    currentHtml=await createMapHtml(atlas);
    byId('browser-result-label').textContent=`${atlas.name} · ${atlas.modules.length.toLocaleString()} modules · ${atlas.edges.length.toLocaleString()} imports`;
    byId('browser-map').title=`Interactive RepoAtlas map of ${atlas.name}`;
    byId('browser-disclosure').textContent=atlas.commit
      ?'Source files are fetched directly from GitHub and analyzed on this device. The TypeScript compiler is loaded from jsDelivr’s version-pinned TypeScript package; it receives no repository data. GitHub’s public API limits unauthenticated requests to 60 per hour per IP. Large repositories work best with the local CLI.'
      :'Selected folder contents are analyzed on this device and never sent to a RepoAtlas server. Source snippets are included in the exported HTML; review the map before sharing it. The TypeScript compiler is loaded from jsDelivr’s version-pinned TypeScript package.';
    result.hidden=false;
    await new Promise((resolve,reject)=>{
      frame.onload=()=>{frame.classList.add('loaded');resolve();};
      frame.onerror=()=>reject(new Error('The interactive map could not be rendered.'));
      frame.srcdoc=currentHtml;
    });
    const snapshot=atlas.commit?`commit ${atlas.commit.slice(0,10)}`:'local source';
    progress({stage:'complete',message:`Map ready from ${snapshot}.`});
    byId('command-status').textContent=`Browser map ready for ${atlas.name} from ${snapshot}.`;
  }catch(error){
    if(currentController.signal.aborted)progress({stage:'canceled',message:'Analysis canceled.'});
    else errorPanel.textContent=error instanceof Error?error.message:'Could not analyze this repository.';
  }finally{
    analyzeButton.disabled=false;localButton.disabled=false;cancelButton.hidden=true;progressPanel.removeAttribute('aria-busy');currentController=undefined;
  }
}

form.addEventListener('submit',event=>{
  event.preventDefault();
  try{parsePublicRepositoryInput(input.value);}catch(error){errorPanel.textContent=error.message;input.focus();return;}
  void runAnalysis({type:'public',input:input.value});
});
localButton.addEventListener('click',()=>localPicker.click());
localPicker.addEventListener('change',()=>{
  if(!localPicker.files?.length)return;
  const files=[...localPicker.files];localPicker.value='';
  void runAnalysis({type:'local',files});
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
