export function runAnalysisInWorker({type,input,files,includeTests=false,onProgress,signal,WorkerImpl=globalThis.Worker}={}){
  if(signal?.aborted)return Promise.reject(signal.reason??new DOMException('Canceled by user','AbortError'));
  if(typeof WorkerImpl!=='function')return Promise.reject(new Error('This browser does not support background analysis. Use the RepoAtlas CLI instead.'));
  if(type!=='public'&&type!=='local')return Promise.reject(new Error('Unknown browser analysis mode.'));
  return new Promise((resolve,reject)=>{
    let settled=false;
    let worker;
    const cleanup=()=>{
      signal?.removeEventListener('abort',abort);
      worker?.terminate();
    };
    const finish=(callback,value)=>{if(settled)return;settled=true;cleanup();callback(value);};
    const abort=()=>finish(reject,signal?.reason??new DOMException('Canceled by user','AbortError'));
    try{
      worker=new WorkerImpl(new URL('./assets/repository-worker.js',import.meta.url),{name:'repoatlas-analysis'});
      worker.onmessage=event=>{
        const message=event.data;
        if(message?.type==='progress'){
          try{onProgress?.(message.progress);}catch(error){finish(reject,error);}
        }else if(message?.type==='result')finish(resolve,message.atlas);
        else if(message?.type==='error')finish(reject,new Error(message.message||'Browser analysis failed.'));
      };
      worker.onerror=event=>finish(reject,new Error(event.message||'The browser analysis worker failed.'));
      worker.onmessageerror=()=>finish(reject,new Error('The browser could not read the analysis worker response.'));
      signal?.addEventListener('abort',abort,{once:true});
      worker.postMessage(type==='local'
        ?{type:'analyze-local',files:[...files].map(file=>({path:file.webkitRelativePath||file.name,size:file.size,file})),includeTests}
        :{type:'analyze-public',input,includeTests});
    }catch(error){finish(reject,error);}
  });
}
