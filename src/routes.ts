import type { Atlas, Edge } from './types.js';
import type { ExternalUsage } from './packages.js';

export type InspectorRoute =
  | {type:'overview'}
  | {type:'module'; id:string}
  | {type:'edge'; edge:Edge}
  | {type:'external-list'}
  | {type:'external-package'; kind:ExternalUsage['kind']; name:string; page:number};

export function encodeInspectorRoute(route: InspectorRoute): string {
  const params=new URLSearchParams();
  if(route.type==='module')params.set('module',route.id);
  else if(route.type==='edge'){
    params.set('edge-source',route.edge.source);
    params.set('edge-line',String(route.edge.line));
    params.set('edge-specifier',route.edge.specifier);
    params.set('edge-kind',route.edge.kind);
  }else if(route.type==='external-list')params.set('external-list','1');
  else if(route.type==='external-package'){
    params.set('external-kind',route.kind);
    params.set('external-name',route.name);
    if(route.page>0)params.set('page',String(route.page));
  }
  const encoded=params.toString();
  return encoded?`#${encoded}`:'';
}

export function resolveInspectorRoute(hash:string, atlas:Atlas, usages:ExternalUsage[]): InspectorRoute {
  const params=new URLSearchParams(hash.startsWith('#')?hash.slice(1):hash);
  const moduleId=params.get('module');
  if(moduleId&&atlas.modules.some(module=>module.id===moduleId))return {type:'module',id:moduleId};
  const source=params.get('edge-source'),specifier=params.get('edge-specifier'),kind=params.get('edge-kind');
  const lineText=params.get('edge-line');
  if(source&&specifier&&kind&&lineText&&/^\d+$/.test(lineText)){
    const line=Number(lineText);
    const edge=atlas.edges.find(candidate=>candidate.source===source&&candidate.specifier===specifier&&candidate.kind===kind&&candidate.line===line);
    if(edge)return {type:'edge',edge};
  }
  if(params.get('external-list')==='1')return {type:'external-list'};
  const externalKind=params.get('external-kind'),externalName=params.get('external-name');
  if(externalKind&&externalName&&['package','builtin','url','other'].includes(externalKind)){
    const usage=usages.find(item=>item.kind===externalKind&&item.name===externalName);
    if(usage){
      const pageText=params.get('page')??'0';
      const requested=/^\d+$/.test(pageText)?Number(pageText):0;
      return {type:'external-package',kind:usage.kind,name:usage.name,page:Math.min(Math.max(0,requested),Math.max(0,Math.ceil(usage.edges.length/50)-1))};
    }
  }
  return {type:'overview'};
}
