import type { Edge, Module } from './types.js';

export interface BoundaryGroup {
  id: string;
  label: string;
  modules: number;
}

export interface BoundaryCell {
  source: string;
  target: string;
  edges: Edge[];
}

export interface BoundaryMatrix {
  groups: BoundaryGroup[];
  cells: BoundaryCell[];
}

export function boundaryGroup(module: Module): { id: string; label: string } {
  const label = module.workspace ?? (module.group === '.' ? '.' : module.group.split('/')[0]!);
  return { id: module.workspace ? `package:${module.workspace}` : `directory:${label}`, label };
}

/** Group modules by workspace package or their top-level source directory. */
export function buildBoundaryMatrix(modules: Module[], edges: Edge[]): BoundaryMatrix {
  const groupByModule=new Map<string,string>();
  const counts=new Map<string,number>();
  const labels=new Map<string,string>();
  for(const module of modules){
    const {id,label}=boundaryGroup(module);
    groupByModule.set(module.id,id);
    labels.set(id,label);
    counts.set(id,(counts.get(id)??0)+1);
  }
  const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
  const groups=[...counts].map(([id,modules])=>({id,label:labels.get(id)!,modules})).sort((a,b)=>compare(a.label,b.label)||compare(a.id,b.id));
  const grouped=new Map<string,Edge[]>();
  for(const edge of edges){
    if(edge.resolution!=='internal')continue;
    const source=groupByModule.get(edge.source),target=groupByModule.get(edge.target);
    if(!source||!target)continue;
    const key=`${source}\0${target}`;
    const bucket=grouped.get(key)??[];bucket.push(edge);grouped.set(key,bucket);
  }
  const order=new Map(groups.map((group,index)=>[group.id,index]));
  const cells=[...grouped].map(([key,cellEdges])=>{const [source,target]=key.split('\0');return {source:source!,target:target!,edges:cellEdges};})
    .sort((a,b)=>order.get(a.source)!-order.get(b.source)!||order.get(a.target)!-order.get(b.target)!);
  return {groups,cells};
}
