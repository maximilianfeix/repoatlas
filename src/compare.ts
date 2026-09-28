import type { Atlas, Edge } from './types.js';
import type { ExportedSymbol } from './exports.js';
import type { Module } from './types.js';

export interface SnapshotMetadata {
  name: string;
  repository?: string;
  commit?: string;
}

export interface EdgeChange {
  before: Edge;
  after: Edge;
}

export interface ExportEvidence extends ExportedSymbol { moduleId: string; url?: string }

export interface AtlasComparison {
  base: SnapshotMetadata;
  head: SnapshotMetadata;
  modules: { added: string[]; removed: string[] };
  dependencies: { added: Edge[]; removed: Edge[]; changedSpecifier: EdgeChange[] };
  exports: { added: ExportEvidence[]; removed: ExportEvidence[]; unavailableModules: string[] };
}

const kinds=new Set(['import','type','export','dynamic','require']);
const resolutions=new Set(['internal','external','unresolved']);
const exportKinds=new Set(['function','class','interface','type','variable','enum','namespace','re-export','re-export-all','assignment']);
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);

/** Validate only stable graph fields, allowing additive optional module metadata. */
export function parseAtlas(value: unknown): Atlas {
  if(!record(value)||value.schemaVersion!==1||typeof value.name!=='string'||!Array.isArray(value.modules)||!Array.isArray(value.edges)||!Array.isArray(value.warnings))throw new Error('Invalid RepoAtlas snapshot: expected schemaVersion 1 with modules, edges, and warnings.');
  for(const module of value.modules){if(!record(module)||typeof module.id!=='string'||typeof module.group!=='string'||!Number.isSafeInteger(module.lines)||Number(module.lines)<0||!Array.isArray(module.entry)||!module.entry.every(item=>typeof item==='string')||('url'in module&&typeof module.url!=='string')||('workspace'in module&&typeof module.workspace!=='string')||('exports'in module&&(!Array.isArray(module.exports)||!module.exports.every(item=>record(item)&&typeof item.name==='string'&&exportKinds.has(String(item.kind))&&Number.isSafeInteger(item.line)&&Number(item.line)>=1&&(!('localName'in item)||typeof item.localName==='string')&&(!('source'in item)||typeof item.source==='string'))))||('activity'in module&&(!record(module.activity)||!Number.isSafeInteger(module.activity.commits)||Number(module.activity.commits)<0||typeof module.activity.lastChanged!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(module.activity.lastChanged)||!Number.isFinite(Date.parse(`${module.activity.lastChanged}T00:00:00Z`))||new Date(Date.parse(`${module.activity.lastChanged}T00:00:00Z`)).toISOString().slice(0,10)!==module.activity.lastChanged)))throw new Error('Invalid RepoAtlas snapshot: malformed module record.');}
  if('activity'in value&&(!record(value.activity)||!Number.isSafeInteger(value.activity.days)||Number(value.activity.days)<1||Number(value.activity.days)>365||!Number.isSafeInteger(value.activity.commitsScanned)||Number(value.activity.commitsScanned)<0||typeof value.activity.truncated!=='boolean'||typeof value.activity.shallow!=='boolean'))throw new Error('Invalid RepoAtlas snapshot: malformed activity metadata.');
  if(('repository'in value&&typeof value.repository!=='string')||('commit'in value&&typeof value.commit!=='string'))throw new Error('Invalid RepoAtlas snapshot: malformed snapshot metadata.');
  for(const edge of value.edges){if(!record(edge)||typeof edge.source!=='string'||typeof edge.target!=='string'||typeof edge.specifier!=='string'||!kinds.has(String(edge.kind))||!Number.isSafeInteger(edge.line)||Number(edge.line)<1||typeof edge.code!=='string'||!resolutions.has(String(edge.resolution)))throw new Error('Invalid RepoAtlas snapshot: malformed dependency edge.');}
  if(!value.warnings.every(item=>typeof item==='string'))throw new Error('Invalid RepoAtlas snapshot: malformed warnings.');
  return value as unknown as Atlas;
}

function metadata(atlas:Atlas):SnapshotMetadata {
  return {name:atlas.name,...(atlas.repository?{repository:atlas.repository}:{}),...(atlas.commit?{commit:atlas.commit}:{})};
}
function edgeKey(edge:Edge):string { return JSON.stringify([edge.source,edge.target,edge.specifier,edge.kind,edge.resolution]); }
function edgeOrder(a:Edge,b:Edge):number { const compare=(left:string,right:string)=>left<right?-1:left>right?1:0;return compare(a.source,b.source)||compare(a.target,b.target)||compare(a.kind,b.kind)||compare(a.specifier,b.specifier)||a.line-b.line; }
const exportKey=(item:ExportedSymbol)=>JSON.stringify([item.name,item.kind,item.localName??'',item.source??'']);
const exportOrder=(a:ExportEvidence,b:ExportEvidence)=>{const compare=(left:string,right:string)=>left<right?-1:left>right?1:0;return compare(a.moduleId,b.moduleId)||a.line-b.line||compare(a.name,b.name)||compare(a.kind,b.kind);};
function exportEvidence(module:Module,item:ExportedSymbol):ExportEvidence {
  return {moduleId:module.id,...item,...(module.url?{url:`${module.url.replace(/#L\d+$/,'')}#L${item.line}`}:{})};
}

/** Compare graph relationships while ignoring source line shifts and code formatting. */
export function compareAtlases(base:Atlas,head:Atlas):AtlasComparison {
  const beforeModules=new Set(base.modules.map(module=>module.id)),afterModules=new Set(head.modules.map(module=>module.id));
  const addedModules=[...afterModules].filter(id=>!beforeModules.has(id)).sort();
  const removedModules=[...beforeModules].filter(id=>!afterModules.has(id)).sort();
  const beforeEdges=new Map<string,Edge>(),afterEdges=new Map<string,Edge>();
  for(const edge of base.edges)if(!beforeEdges.has(edgeKey(edge)))beforeEdges.set(edgeKey(edge),edge);
  for(const edge of head.edges)if(!afterEdges.has(edgeKey(edge)))afterEdges.set(edgeKey(edge),edge);
  const relationKey=(edge:Edge)=>JSON.stringify([edge.source,edge.target,edge.kind,edge.resolution]);
  const groupByRelation=(edges:Edge[])=>{const groups=new Map<string,Edge[]>();for(const edge of edges){const key=relationKey(edge),group=groups.get(key)??[];if(!group.some(item=>item.specifier===edge.specifier)){group.push(edge);groups.set(key,group);}}return groups;};
  const baseRelations=groupByRelation([...beforeEdges.values()]),headRelations=groupByRelation([...afterEdges.values()]);
  const changedSpecifier:EdgeChange[]=[];
  const changedBefore=new Set<string>(),changedAfter=new Set<string>();
  for(const [key,before] of baseRelations){
    const after=headRelations.get(key);
    if(!after)continue;
    const remainingBefore=before.filter(edge=>!after.some(next=>next.specifier===edge.specifier));
    const remainingAfter=after.filter(edge=>!before.some(previous=>previous.specifier===edge.specifier));
    remainingBefore.sort(edgeOrder);remainingAfter.sort(edgeOrder);
    for(let i=0;i<Math.min(remainingBefore.length,remainingAfter.length);i++){
      const previous=remainingBefore[i]!,next=remainingAfter[i]!;
      changedSpecifier.push({before:previous,after:next});changedBefore.add(edgeKey(previous));changedAfter.add(edgeKey(next));
    }
  }
  const added=[...afterEdges].filter(([key])=>!beforeEdges.has(key)&&!changedAfter.has(key)).map(([,edge])=>edge).sort(edgeOrder);
  const removed=[...beforeEdges].filter(([key])=>!afterEdges.has(key)&&!changedBefore.has(key)).map(([,edge])=>edge).sort(edgeOrder);
  const uniqueSpecifier=new Map<string,EdgeChange>();
  for(const change of changedSpecifier)uniqueSpecifier.set(`${edgeKey(change.before)}\0${edgeKey(change.after)}`,change);
  const changes=[...uniqueSpecifier.values()].sort((a,b)=>edgeOrder(a.after,b.after));
  const baseModules=new Map(base.modules.map(module=>[module.id,module])),headModules=new Map(head.modules.map(module=>[module.id,module]));
  const exportChanges:{added:ExportEvidence[];removed:ExportEvidence[];unavailableModules:string[]}={added:[],removed:[],unavailableModules:[]};
  for(const id of [...new Set([...baseModules.keys(),...headModules.keys()])].sort()){
    const before=baseModules.get(id),after=headModules.get(id);
    if(!before||!after){const present=before??after!;if(present.exports===undefined)exportChanges.unavailableModules.push(id);else for(const item of present.exports)(before?exportChanges.removed:exportChanges.added).push(exportEvidence(present,item));continue;}
    if(before.exports===undefined||after.exports===undefined){exportChanges.unavailableModules.push(id);continue;}
    const old=new Map(before.exports.map(item=>[exportKey(item),item])),next=new Map(after.exports.map(item=>[exportKey(item),item]));
    for(const [key,item] of next)if(!old.has(key))exportChanges.added.push(exportEvidence(after,item));
    for(const [key,item] of old)if(!next.has(key))exportChanges.removed.push(exportEvidence(before,item));
  }
  exportChanges.added.sort(exportOrder);exportChanges.removed.sort(exportOrder);
  return {base:metadata(base),head:metadata(head),modules:{added:addedModules,removed:removedModules},dependencies:{added,removed,changedSpecifier:changes},exports:exportChanges};
}
