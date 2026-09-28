import { buildBoundaryMatrix } from './boundaries.js';
import { analyzeReachability, findCycles } from './insights.js';
import type { Atlas } from './types.js';

const xml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');

/** Produce a concise source-level summary suitable for CI logs. */
export function renderTextReport(atlas:Atlas):string {
  const internal=atlas.edges.filter(edge=>edge.resolution==='internal');
  const external=atlas.edges.filter(edge=>edge.resolution==='external');
  const unresolved=atlas.edges.filter(edge=>edge.resolution==='unresolved');
  const entries=atlas.modules.filter(module=>module.entry.length).length;
  const reachability=analyzeReachability(atlas.modules,atlas.edges);
  const cycles=findCycles(atlas.modules,internal);
  const matrix=buildBoundaryMatrix(atlas.modules,atlas.edges);
  const boundaryLabels=new Map(matrix.groups.map(group=>[group.id,group.label]));
  const compare=(left:string,right:string)=>left<right?-1:left>right?1:0;
  const boundaryLinks=matrix.cells.filter(cell=>cell.source!==cell.target).sort((a,b)=>b.edges.length-a.edges.length||compare(a.source,b.source)||compare(a.target,b.target));
  const crossBoundaryEdges=boundaryLinks.reduce((total,cell)=>total+cell.edges.length,0);
  const lines=[
    `RepoAtlas architecture report — ${atlas.name}`,
    ...(atlas.repository?[`Repository: ${atlas.repository}`]:[]),
    ...(atlas.commit?[`Snapshot: ${atlas.commit}`]:[]),
    `Modules: ${atlas.modules.length} · detected entry points: ${entries}`,
    `Imports: ${internal.length} internal · ${external.length} external · ${unresolved.length} unresolved`,
    `Reachability: ${reachability.known?`${reachability.reachable.size} reachable · ${reachability.unreachable.size} outside detected entry paths`:'unknown (no entry points detected)'}`,
    `Circular dependencies: ${cycles.length} groups · ${new Set(cycles.flat().map(module=>module.id)).size} involved modules`,
    `Boundaries: ${matrix.groups.length} workspace/directory groups · ${crossBoundaryEdges} imports across ${boundaryLinks.length} boundary pairs`,
  ];
  for(const cell of boundaryLinks.slice(0,10))lines.push(`  ${boundaryLabels.get(cell.source)} → ${boundaryLabels.get(cell.target)}: ${cell.edges.length} imports`);
  if(boundaryLinks.length>10)lines.push(`  … ${boundaryLinks.length-10} more cross-boundary links`);
  for(const warning of atlas.warnings)lines.push(`Warning: ${warning}`);
  lines.push('Static source relationships only; unreachable does not prove dead code.');
  return lines.join('\n')+'\n';
}

/** Render the resolved import-boundary matrix as a script-free standalone SVG. */
export function renderBoundarySvg(atlas:Atlas):string {
  const matrix=buildBoundaryMatrix(atlas.modules,atlas.edges);
  const count=matrix.groups.length;
  if(count>80)throw new Error(`SVG matrix supports at most 80 boundary groups; this snapshot has ${count}. Use the text report or narrow the source snapshot.`);
  const cell=count>32?28:count>14?48:72,left=210,top=205,width=left+count*cell+24,height=top+count*cell+24;
  const byPair=new Map(matrix.cells.map(item=>[`${item.source}\0${item.target}`,item.edges.length]));
  const parts=[
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    `<title id="title">RepoAtlas dependency boundaries — ${xml(atlas.name)}</title>`,
    '<desc id="desc">Rows are importing boundaries; columns are imported boundaries. Counts include resolved static TypeScript imports only, not runtime calls.</desc>',
    '<style>text{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;fill:#dbe5f2}.muted{fill:#93a1b8}.cell{fill:#111923;stroke:#293748}.active{fill:#173027;stroke:#426b56}.title{font:700 17px system-ui,sans-serif}.label{font-size:10px}.count{font-size:11px;fill:#9aefca}</style>',
    `<text class="title" x="24" y="32">${xml(atlas.name)} · dependency boundaries</text>`,
    '<text class="muted label" x="24" y="54">Rows import into columns · resolved static imports</text>',
    `<text class="muted label" x="24" y="${top-18}">IMPORTS FROM</text>`,
  ];
  for(let col=0;col<count;col++){
    const group=matrix.groups[col]!;const x=left+col*cell+cell/2;
    parts.push(`<text class="muted label" text-anchor="end" transform="translate(${x},${top-8}) rotate(-55)"><title>${xml(group.label)} · ${group.modules} modules</title>${xml(group.label.length>30?`${group.label.slice(0,27)}…`:group.label)}</text>`);
  }
  for(let row=0;row<count;row++){
    const source=matrix.groups[row]!;const y=top+row*cell;
    parts.push(`<text class="label" x="24" y="${y+cell/2+4}"><title>${xml(source.label)} · ${source.modules} modules</title>${xml(source.label.length>34?`${source.label.slice(0,31)}…`:source.label)}</text>`);
    for(let col=0;col<count;col++){
      const target=matrix.groups[col]!;const x=left+col*cell;const amount=byPair.get(`${source.id}\0${target.id}`)??0;
      parts.push(`<g><title>${xml(source.label)} imports ${xml(target.label)}: ${amount} resolved static dependencies</title><rect class="${amount?'active':'cell'}" x="${x}" y="${y}" width="${cell-2}" height="${cell-2}" rx="4"/>${amount?`<text class="count" text-anchor="middle" x="${x+(cell-2)/2}" y="${y+cell/2+4}">${amount}</text>`:''}</g>`);
    }
  }
  parts.push('</svg>');
  return parts.join('\n')+'\n';
}

/** Render a README-friendly Mermaid graph of cross-boundary static imports. */
export function renderBoundaryMermaid(atlas:Atlas):string {
  const compare=(left:string,right:string)=>left<right?-1:left>right?1:0;
  let groupByModule=new Map<string,string>();
  const labels=new Map<string,string>();
  const counts=new Map<string,number>();
  for(const module of atlas.modules){
    const label=module.workspace??(module.group||'.');
    const id=module.workspace?`package:${label}`:`directory:${label}`;
    groupByModule.set(module.id,id);labels.set(id,label);counts.set(id,(counts.get(id)??0)+1);
  }
  let groups=[...counts].map(([id,modules])=>({id,label:labels.get(id)!,modules})).sort((a,b)=>compare(a.label,b.label)||compare(a.id,b.id));
  if(groups.length===1&&atlas.modules.length>1){
    if(atlas.modules.length>80)throw new Error(`Mermaid map has one boundary containing ${atlas.modules.length} modules. Use the interactive HTML map for file-level detail.`);
    groupByModule=new Map(atlas.modules.map(module=>[module.id,`module:${module.id}`]));
    groups=atlas.modules.map(module=>({id:`module:${module.id}`,label:module.id,modules:1})).sort((a,b)=>compare(a.label,b.label)||compare(a.id,b.id));
  }
  const buckets=new Map<string,NonNullable<Atlas['edges']>>();
  for(const edge of atlas.edges){
    if(edge.resolution!=='internal')continue;
    const source=groupByModule.get(edge.source),target=groupByModule.get(edge.target);
    if(!source||!target||source===target)continue;
    const key=`${source}\0${target}`,bucket=buckets.get(key)??[];bucket.push(edge);buckets.set(key,bucket);
  }
  const groupOrder=new Map(groups.map((group,index)=>[group.id,index]));
  const cells=[...buckets].map(([key,edges])=>{const [source,target]=key.split('\0');return {source:source!,target:target!,edges};})
    .sort((a,b)=>groupOrder.get(a.source)!-groupOrder.get(b.source)!||groupOrder.get(a.target)!-groupOrder.get(b.target)!);
  const matrix={groups,cells};
  if(matrix.groups.length>80)throw new Error(`Mermaid map supports at most 80 boundary groups; this snapshot has ${matrix.groups.length}. Use a narrower source snapshot.`);
  const nodeByGroup=new Map(matrix.groups.map((group,index)=>[group.id,`b${index+1}`]));
  const entryGroups=new Set(atlas.modules.filter(module=>module.entry.length).map(module=>groupByModule.get(module.id)).filter((id):id is string=>Boolean(id)));
  const mermaidText=(value:string)=>value.replaceAll('&','#amp;').replaceAll('"','#quot;').replaceAll('<','#lt;').replaceAll('>','#gt;').replace(/[\r\n]+/g,' ');
  const links=matrix.cells.filter(cell=>cell.source!==cell.target)
    .sort((a,b)=>b.edges.length-a.edges.length||compare(a.source,b.source)||compare(a.target,b.target));
  const visibleLinks=links.slice(0,200);
  const lines=[
    '%% Cross-boundary resolved static TypeScript imports; this is not a runtime call graph.',
    'flowchart LR',
    '  classDef entry fill:#d4f77a,stroke:#657f1b,color:#263300,stroke-width:2px',
  ];
  for(const group of matrix.groups){
    const node=nodeByGroup.get(group.id)!;
    const label=`${group.label} · ${group.modules} ${group.modules===1?'module':'modules'}${entryGroups.has(group.id)?' · detected entry':''}`;
    lines.push(`  ${node}["${mermaidText(label)}"]`);
    if(entryGroups.has(group.id))lines.push(`  class ${node} entry`);
  }
  for(const link of visibleLinks)lines.push(`  ${nodeByGroup.get(link.source)} -->|${link.edges.length} imports| ${nodeByGroup.get(link.target)}`);
  if(links.length>visibleLinks.length)lines.push(`  %% ${links.length-visibleLinks.length} lower-volume boundary links omitted; use the interactive map for the complete graph.`);
  if(!visibleLinks.length)lines.push('  %% No imports cross package or directory boundaries.');
  return lines.join('\n')+'\n';
}

/** Render a compact, deterministic SVG card for repository landing pages. */
export function renderArchitectureCard(atlas:Atlas):string {
  const internal=atlas.edges.filter(edge=>edge.resolution==='internal');
  const entries=atlas.modules.filter(module=>module.entry.length).length;
  const cycles=findCycles(atlas.modules,internal);
  const title=atlas.name.length>48?`${atlas.name.slice(0,45)}…`:atlas.name;
  const stats=[
    {value:String(atlas.modules.length),label:'modules'},
    {value:String(entries),label:'entry points'},
    {value:String(internal.length),label:'resolved imports'},
    {value:String(cycles.length),label:'dependency cycles'},
  ];
  const positions=[28,204,380,556];
  const parts=[
    '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="232" viewBox="0 0 720 232" role="img" aria-labelledby="title desc">',
    `<title id="title">RepoAtlas architecture summary — ${xml(atlas.name)}</title>`,
    '<desc id="desc">Static TypeScript import analysis. Counts summarize this snapshot and do not represent runtime calls.</desc>',
    '<defs><linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#14251f"/><stop offset="1" stop-color="#111923"/></linearGradient></defs>',
    '<rect x="1" y="1" width="718" height="230" rx="18" fill="#0b0e14" stroke="#2b3b3b"/>',
    '<path d="M19 2h682a17 17 0 0 1 17 17v55H2V19A17 17 0 0 1 19 2Z" fill="url(#wash)"/>',
    '<text x="28" y="31" fill="#92edc7" font-family="system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="2">REPOATLAS  /  ARCHITECTURE SNAPSHOT</text>',
    `<text x="28" y="57" fill="#e6edf7" font-family="system-ui,sans-serif" font-size="19" font-weight="650">${xml(title)}</text>`,
  ];
  for(let index=0;index<stats.length;index++){
    const item=stats[index]!;const x=positions[index]!;
    parts.push(`<g><rect x="${x}" y="88" width="156" height="83" rx="11" fill="#111923" stroke="#293748"/><text x="${x+14}" y="129" fill="#92edc7" font-family="ui-monospace,monospace" font-size="26" font-weight="700">${item.value}</text><text x="${x+14}" y="151" fill="#93a1b8" font-family="system-ui,sans-serif" font-size="12">${item.label}</text></g>`);
  }
  parts.push('<path d="M28 190h664" stroke="#293748"/>');
  parts.push('<text x="28" y="211" fill="#93a1b8" font-family="system-ui,sans-serif" font-size="11">Evidence-backed static imports · runtime behavior is not inferred</text>');
  parts.push('</svg>');
  return parts.join('\n')+'\n';
}
