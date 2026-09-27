import type { Atlas, Edge, Module } from './types.js';
import { focusNeighborhood, impactNeighborhood } from './focus.js';
const data: Atlas = JSON.parse(document.getElementById('atlas-data')!.textContent!);
const $ = (id: string) => document.getElementById(id)!;
function el(tag: string, text = '', cls = '') { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; }
function link(text: string, url: string) { const a = el('a',text) as HTMLAnchorElement; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
const NS = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Record<string, string | number> = {}) { const e = document.createElementNS(NS,tag); for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,String(v)); return e; }
const internal = data.edges.filter(e => e.resolution === 'internal');
const byId = new Map(data.modules.map(m => [m.id,m]));
let selected: string | undefined, selectedEdge: Edge | undefined, entriesOnly = false, focusMap = false, impactMap = false, zoom = 1;
$('repo-name').textContent = data.name;
for (const [value,label] of [[data.modules.length,'modules'],[internal.length,'connections'],[data.modules.filter(m=>m.entry.length).length,'entry points']]) { const stat = el('div'); stat.append(el('strong',String(value)),el('span',String(label))); $('stats').append(stat); }
for (const group of [...new Set(data.modules.map(m=>m.group))].sort()) { const opt = document.createElement('option'); opt.value = group; opt.textContent = group; $('group').append(opt); }
$('notice').textContent = data.warnings.join(' ');
if (data.warnings.length) $('notice').className = 'warning';
function intro() {
  const panel = $('inspector'); panel.replaceChildren(el('h2','The source of truth'),el('h3','Architecture you can verify.'),el('p','Select a module to explore its imports and dependents. Select any connection to see the exact code that created it.'));
  panel.append(el('p',`${data.edges.filter(e=>e.resolution==='external').length} external imports · ${data.edges.filter(e=>e.resolution==='unresolved').length} unresolved imports`));
  if (data.commit) panel.append(el('p',`Snapshot ${data.commit.slice(0,10)}`));
  panel.append(el('h2','Start exploring'));
  data.modules.filter(m=>m.entry.length).slice(0,8).forEach(m=>{ const b=el('button',m.id,'dep'); b.onclick=()=>choose(m.id); panel.append(b); });
}
function edgeDetail(edge: Edge) {
  selectedEdge=edge; const panel=$('inspector'); panel.replaceChildren(el('h2','Connection evidence'),el('h3',`${edge.source} → ${edge.target}`),el('span',edge.kind,'pill'),el('span',edge.resolution,'pill'),el('p',`${edge.source}:${edge.line}`),el('pre',edge.code));
  if (edge.url) panel.append(link(`Open source on GitHub ↗ (line ${edge.line})`,edge.url));
  else panel.append(el('p','Embedded source evidence. A clean GitHub checkout is needed for a permanent source link.'));
  const b=el('button','← Back to module','dep'); b.onclick=()=>choose(edge.source); panel.append(b);
  draw();
}
function choose(id: string) {
  selected=id; selectedEdge=undefined;
  const module=byId.get(id)!; const panel=$('inspector'); panel.replaceChildren(el('h2','Module inspector'),el('h3',id),el('p',`${module.lines} lines · ${module.group}`));
  for (const reason of module.entry) panel.append(el('span',reason,'pill'));
  if (module.url) panel.append(el('p'),link('Open module on GitHub ↗',module.url));
  const directCount = new Set(internal.filter(edge => edge.target === id).map(edge => edge.source)).size;
  const totalDependents = Math.max(0,impactNeighborhood(data.modules,internal,id).length-1);
  const summary = el('div','','impact-summary');
  summary.append(el('h2','Change impact'));
  const metric = el('div','','impact-total');
  metric.append(el('strong',String(totalDependents)),el('span','potential dependents'));
  summary.append(metric,el('p',`${directCount} direct · ${totalDependents-directCount} indirect`),el('p','Based on resolved static imports.'));
  const impactButton = el('button',impactMap ? 'Exit impact map' : 'Show impact map','button impact-link');
  impactButton.id='impact-link';
  impactButton.onclick=()=>{impactMap=!impactMap;focusMap=false;draw();choose(id);};
  summary.append(impactButton);
  panel.append(summary);
  for (const [label,edges] of [['Imports',data.edges.filter(e=>e.source===id)],['Imported by',data.edges.filter(e=>e.target===id && e.resolution==='internal')]] as [string,Edge[]][]) {
    panel.append(el('h3',`${label} · ${edges.length}`));
    if (!edges.length) panel.append(el('p','No static connections found.'));
    for (const edge of edges) { const b=el('button',label==='Imports' ? edge.target : edge.source,'dep'); b.append(el('small',`${edge.kind} · ${edge.resolution} · line ${edge.line}`)); b.onclick=()=>edgeDetail(edge); panel.append(b); }
  }
  draw();
}
function draw() {
  const query=($('search') as HTMLInputElement).value.toLowerCase();
  const group=($('group') as HTMLSelectElement).value;
  const focused=focusMap && selected ? focusNeighborhood(data.modules,internal,selected) : undefined;
  const impacted=impactMap && selected ? impactNeighborhood(data.modules,internal,selected) : undefined;
  const matches=focused ?? impacted ?? data.modules.filter(m=>(!query || m.id.toLowerCase().includes(query)) && (!group || m.group===group) && (!entriesOnly || m.entry.length));
  const scoped=matches;
  const visible=scoped.slice(0,100);
  $('focus').toggleAttribute('disabled',!selected);
  $('focus').classList.toggle('active',focusMap);
  $('focus').setAttribute('aria-pressed',String(focusMap));
  $('impact').toggleAttribute('disabled',!selected);
  $('impact').classList.toggle('active',impactMap);
  $('impact').setAttribute('aria-pressed',String(impactMap));
  const impactLink=document.getElementById('impact-link');
  if(impactLink) impactLink.textContent=impactMap ? 'Exit impact map' : 'Show impact map';
  const limited=scoped.length>100 ? (focused || impacted ? ' · first 100 shown' : ' · refine filters') : '';
  $('view-count').textContent=`${visible.length} / ${scoped.length} ${focused ? 'connected' : impacted ? 'affected' : 'matching'} modules${limited}`;
  $('view-description').textContent=impacted ? `Potential change impact for ${selected} · reverse imports` : focused ? `Direct neighborhood of ${selected}` : 'Click a connection for its code';
  const list=$('module-list'); list.replaceChildren();
  for (const m of matches.slice(0,500)) { const b=el('button',`${m.entry.length ? '● ' : ''}${m.id}`,selected===m.id ? 'selected' : ''); b.onclick=()=>{ if(!visible.some(v=>v.id===m.id)){ ($('search') as HTMLInputElement).value=m.id; focusMap=false; impactMap=false; } choose(m.id); }; list.append(b); }
  if (!matches.length) list.append(el('p','No matching modules.'));
  const graph=$('graph'); graph.replaceChildren();
  const ids=new Set(visible.map(m=>m.id));
  const edges=internal.filter(e=>ids.has(e.source)&&ids.has(e.target));
  // Three stable columns: likely entry points, connecting modules, leaf modules.
  const buckets: Module[][]=[[],[],[]];
  for(const m of visible) buckets[m.entry.length ? 0 : internal.some(e=>e.source===m.id) ? 1 : 2].push(m);
  const width=920,height=Math.max(450,Math.max(...buckets.map(b=>b.length))*88+90);
  graph.setAttribute('viewBox',`0 0 ${width} ${height}`); graph.setAttribute('width',String(width*zoom)); graph.setAttribute('height',String(height*zoom));
  const defs=svg('defs'), marker=svg('marker',{id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'}); marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#8190a8'}));defs.append(marker);graph.append(defs);
  const positions=new Map<string,{x:number;y:number}>();
  buckets.forEach((bucket,col)=>{const label=svg('text',{x:col*300+25,y:30,class:'graph-label'});label.textContent=['ENTRY POINTS','MODULES','LEAVES'][col];graph.append(label);bucket.forEach((m,row)=>positions.set(m.id,{x:col*300+25,y:row*88+55}));});
  for (const edge of edges) {
    const a=positions.get(edge.source)!,b=positions.get(edge.target)!;
    const d=a.x===b.x ? `M ${a.x+240} ${a.y+27} C ${a.x+280} ${a.y+27}, ${b.x+280} ${b.y+27}, ${b.x+240} ${b.y+27}` : `M ${a.x+240} ${a.y+27} C ${a.x+275} ${a.y+27}, ${b.x-35} ${b.y+27}, ${b.x} ${b.y+27}`;
    const p=svg('path',{d,class:`edge${selectedEdge===edge ? ' selected':''}`,'marker-end':'url(#arrow)',tabindex:0,role:'button','aria-label':`${edge.source} imports ${edge.target} at line ${edge.line}`});
    p.addEventListener('click',()=>edgeDetail(edge)); p.addEventListener('keydown',(e)=>{if((e as KeyboardEvent).key==='Enter')edgeDetail(edge);}); graph.append(p);
  }
  for(const m of visible) {
    const {x,y}=positions.get(m.id)!; const g=svg('g',{transform:`translate(${x},${y})`,class:`node${m.entry.length?' entry':''}${selected===m.id?' selected':''}`,tabindex:0,role:'button','aria-label':m.id});
    const title=svg('title');title.textContent=m.id;g.append(title,svg('rect',{width:240,height:58,rx:8}));
    const text=svg('text',{x:12,y:24}); const name=m.id.split('/').at(-1)!;text.textContent=(m.entry.length?'● ':'')+(name.length>28?name.slice(0,25)+'…':name);
    const meta=svg('text',{x:12,y:43,class:'meta'});meta.textContent=m.group.length>32?'…'+m.group.slice(-31):m.group;g.append(text,meta);
    g.addEventListener('click',()=>choose(m.id));g.addEventListener('keydown',(e)=>{if((e as KeyboardEvent).key==='Enter')choose(m.id);});graph.append(g);
  }
}
$('search').addEventListener('input',draw);$('group').addEventListener('change',draw);
$('entries').onclick=()=>{entriesOnly=!entriesOnly;$('entries').classList.toggle('active',entriesOnly);$('entries').setAttribute('aria-pressed',String(entriesOnly));draw();};
$('impact').onclick=()=>{if(selected){impactMap=!impactMap;focusMap=false;draw();}};
$('focus').onclick=()=>{if(selected){focusMap=!focusMap;impactMap=false;draw();}};
$('reset').onclick=()=>{($('search') as HTMLInputElement).value='';($('group') as HTMLSelectElement).value='';entriesOnly=false;focusMap=false;impactMap=false;selected=undefined;selectedEdge=undefined;zoom=1;$('entries').classList.remove('active');$('entries').setAttribute('aria-pressed','false');intro();draw();};
$('zoom-in').onclick=()=>{zoom=Math.min(2,zoom+0.2);draw();};$('zoom-out').onclick=()=>{zoom=Math.max(0.4,zoom-0.2);draw();};
document.addEventListener('keydown',e=>{if(e.key==='/' && !(e.target instanceof HTMLInputElement)){e.preventDefault();$('search').focus();}});
intro();draw();
