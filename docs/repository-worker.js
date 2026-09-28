import { analyzeLocalRepositoryFiles, analyzePublicRepository } from './repository-analysis.js';

const compilerUrl='https://cdn.jsdelivr.net/npm/typescript@6.0.3/lib/typescript.js';
const compilerIntegrity='sha384-hLq9xq2/tlk0vqCTYY2KECZxYi9UuHw/GLg6biud4KQQhLlq4x/OouQB+CusnUN3';
let compilerPromise;

function base64(bytes){let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary);}
async function loadCompiler(){
  if(globalThis.ts?.version==='6.0.3')return globalThis.ts;
  if(compilerPromise)return compilerPromise;
  compilerPromise=(async()=>{
    const response=await fetch(compilerUrl,{mode:'cors',credentials:'omit',cache:'force-cache'});
    if(!response.ok)throw new Error(`Could not load the TypeScript compiler (${response.status}).`);
    const source=await response.arrayBuffer(),digest=`sha384-${base64(await crypto.subtle.digest('SHA-384',source))}`;
    if(digest!==compilerIntegrity)throw new Error('The TypeScript compiler did not match its pinned integrity digest.');
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    try{importScripts(url);}finally{URL.revokeObjectURL(url);}
    if(globalThis.ts?.version!=='6.0.3')throw new Error('The pinned TypeScript compiler did not load correctly.');
    return globalThis.ts;
  })().catch(error=>{compilerPromise=undefined;throw error;});
  return compilerPromise;
}

self.addEventListener('message',async event=>{
  const message=event.data;
  try{
    const compiler=await loadCompiler();
    const onProgress=progress=>self.postMessage({type:'progress',progress});
    const atlas=message.type==='analyze-local'
      ?await analyzeLocalRepositoryFiles(message.files,{compiler,includeTests:message.includeTests,onProgress})
      :message.type==='analyze-public'
        ?await analyzePublicRepository(message.input,{compiler,includeTests:message.includeTests,ref:message.ref,onProgress})
        :(()=>{throw new Error('Unknown browser analysis request.');})();
    self.postMessage({type:'result',atlas});
  }catch(error){
    self.postMessage({type:'error',message:error instanceof Error?error.message:'Browser analysis failed.'});
  }
});
