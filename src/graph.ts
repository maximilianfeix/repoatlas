import type { Edge } from './types.js';

export interface ParallelEdgeGroup {
  source:string;
  target:string;
  edges:Edge[];
}

export function groupParallelEdges(edges:Edge[]):ParallelEdgeGroup[] {
  const groups=new Map<string,Edge[]>();
  for(const edge of edges){
    if(edge.resolution!=='internal')continue;
    const key=`${edge.source}\0${edge.target}`;
    const group=groups.get(key)??[];group.push(edge);groups.set(key,group);
  }
  return [...groups].map(([key,groupEdges])=>{
    const [source,target]=key.split('\0');
    return {source:source!,target:target!,edges:groupEdges.sort((a,b)=>a.line-b.line||a.specifier.localeCompare(b.specifier)||a.kind.localeCompare(b.kind))};
  }).sort((a,b)=>a.source.localeCompare(b.source)||a.target.localeCompare(b.target));
}
