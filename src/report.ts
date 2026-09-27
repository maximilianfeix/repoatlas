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
