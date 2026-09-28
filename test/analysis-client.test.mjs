import test from 'node:test';
import assert from 'node:assert/strict';
import { runAnalysisInWorker } from '../docs/analysis-client.js';

class FakeWorker{
  static instances=[];
  constructor(url,options){this.url=String(url);this.options=options;this.terminated=false;FakeWorker.instances.push(this);}
  postMessage(message){this.message=message;}
  terminate(){this.terminated=true;}
}

test('worker client forwards progress and resolves one public analysis result',async()=>{
  FakeWorker.instances=[];const progress=[],atlas={name:'owner/repo',modules:[],edges:[]};
  const result=runAnalysisInWorker({type:'public',input:'owner/repo',includeTests:true,WorkerImpl:FakeWorker,onProgress:item=>progress.push(item)});
  const worker=FakeWorker.instances[0];
  const workerUrl=new URL(worker.url);assert.match(workerUrl.pathname,/assets\/repository-worker\.js$/);assert.equal(workerUrl.searchParams.get('v'),'2.40.2');assert.equal(worker.options.name,'repoatlas-analysis');
  assert.deepEqual(worker.message,{type:'analyze-public',input:'owner/repo',includeTests:true});
  worker.onmessage({data:{type:'progress',progress:{stage:'sources',completed:1,total:2}}});
  worker.onmessage({data:{type:'result',atlas}});
  assert.equal(await result,atlas);assert.equal(worker.terminated,true);
  assert.deepEqual(progress,[{stage:'sources',completed:1,total:2}]);
});

test('worker client preserves local file paths and reports worker failures',async()=>{
  FakeWorker.instances=[];const file={name:'index.ts',size:12,webkitRelativePath:'project/src/index.ts'};
  const result=runAnalysisInWorker({type:'local',files:[file],WorkerImpl:FakeWorker});
  const worker=FakeWorker.instances[0];
  assert.equal(worker.message.type,'analyze-local');assert.equal(worker.message.files[0].path,'project/src/index.ts');
  assert.equal(worker.message.files[0].file,file);
  worker.onmessage({data:{type:'error',message:'Could not read TypeScript compiler.'}});
  await assert.rejects(result,/Could not read TypeScript compiler/);assert.equal(worker.terminated,true);
});

test('worker client carries a pinned public repository commit into analysis',async()=>{
  FakeWorker.instances=[];
  runAnalysisInWorker({type:'public',input:'owner/repo',ref:'0123456789abcdef0123456789abcdef01234567',WorkerImpl:FakeWorker});
  assert.deepEqual(FakeWorker.instances[0].message,{type:'analyze-public',input:'owner/repo',includeTests:false,ref:'0123456789abcdef0123456789abcdef01234567'});
  FakeWorker.instances[0].onmessage({data:{type:'result',atlas:{}}});
});

test('canceling terminates the worker immediately and pre-canceled tasks do not start',async()=>{
  FakeWorker.instances=[];const controller=new AbortController();
  const result=runAnalysisInWorker({type:'public',input:'owner/repo',WorkerImpl:FakeWorker,signal:controller.signal});
  const worker=FakeWorker.instances[0];controller.abort(new DOMException('Canceled by user','AbortError'));
  await assert.rejects(result,/Canceled by user/);assert.equal(worker.terminated,true);
  const before=FakeWorker.instances.length;const alreadyCanceled=new AbortController();alreadyCanceled.abort();
  await assert.rejects(runAnalysisInWorker({type:'public',input:'owner/repo',WorkerImpl:FakeWorker,signal:alreadyCanceled.signal}),/canceled|abort/i);
  assert.equal(FakeWorker.instances.length,before);
});
