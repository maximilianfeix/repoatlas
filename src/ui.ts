import type { Atlas, Edge, Module } from './types.js';
import { focusNeighborhood, impactNeighborhood } from './focus.js';
import { analyzeReachability, findCycles } from './insights.js';
const data: Atlas = JSON.parse(document.getElementById('atlas-data')!.textContent!);
const $ = (id: string) => document.getElementById(id)!;
function el(tag: string, text = '', cls = '') { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; }
function link(text: string, url: string) { const a = el('a',text) as HTMLAnchorElement; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
const NS = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Record<string, string | number> = {}) { const e = document.createElementNS(NS,tag); for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,String(v)); return e; }
const internal = data.edges.filter(e => e.resolution === 'internal');
const byId = new Map(data.modules.map(m => [m.id,m]));
const cycleGroups = findCycles(data.modules, internal);
const reachability = analyzeReachability(data.modules,internal);
const cycleByModule = new Map(cycleGroups.flatMap((group, index) => group.map(module => [module.id, index] as const)));
const importerSets = new Map<string, Set<string>>();
const modulesWithImports = new Set(internal.map(edge=>edge.source));
for (const edge of internal) {
  const importers=importerSets.get(edge.target) ?? new Set<string>();
  importers.add(edge.source);
  importerSets.set(edge.target,importers);
}
let selected: string | undefined, selectedEdge: Edge | undefined, entriesOnly = false, focusMap = false, impactMap = false, cyclesOnly = false, orphansOnly = false, cycleGroupIndex = 0, pageIndex = 0, zoom = 1;
$('repo-name').textContent = data.name;
for (const [value,label] of [[data.modules.length,'modules'],[internal.length,'connections'],[data.modules.filter(m=>m.entry.length).length,'entry points']]) { const stat = el('div'); stat.append(el('strong',String(value)),el('span',String(label))); $('stats').append(stat); }
for (const group of [...new Set(data.modules.map(m=>m.group))].sort()) { const opt = document.createElement('option'); opt.value = group; opt.textContent = group; $('group').append(opt); }
const allCyclesOption=document.createElement('option'); allCyclesOption.value='-1'; allCyclesOption.textContent=`All cycle groups · ${cycleGroups.length}`; $('cycle-group').append(allCyclesOption);
cycleGroups.forEach((cycle,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=`Cycle ${index+1} · ${cycle.length} modules`;$('cycle-group').append(option);});
$('notice').textContent = data.warnings.join(' ');
if (data.warnings.length) $('notice').className = 'warning';
function intro() {
  const panel = $('inspector'); panel.replaceChildren(el('h2','The source of truth'),el('h3','Architecture you can verify.'),el('p','Select a module to explore its imports and dependents. Select any connection to see the exact code that created it.'));
  panel.append(el('p',`${data.edges.filter(e=>e.resolution==='external').length} external imports · ${data.edges.filter(e=>e.resolution==='unresolved').length} unresolved imports`));
  if (data.commit) panel.append(el('p',`Snapshot ${data.commit.slice(0,10)}`));
  const signals = el('div','','insight-summary');
  signals.append(el('h2','Architecture signals'),el('p',`${cycleGroups.length} circular dependency groups · ${cycleByModule.size} modules involved.`));
  if(reachability.known){
    signals.append(el('h2','Entry-point reachability'),el('p',`${reachability.reachable.size} reachable · ${reachability.unreachable.size} outside detected entry-point paths. Entry-point detection follows file and package conventions.`));
    if(reachability.unreachable.size){const b=el('button','Explore unreachable modules','button insight-link');b.onclick=()=>{orphansOnly=true;entriesOnly=false;focusMap=false;impactMap=false;cyclesOnly=false;pageIndex=0;draw();};signals.append(b);}
  }else signals.append(el('p','Reachability is unknown: no entry points were detected.'));
  if (cycleGroups.length) {
    const b=el('button',cyclesOnly ? 'Exit cycle map' : 'Explore circular dependencies','button insight-link'); b.id='cycle-link';
    b.onclick=()=>{cyclesOnly=!cyclesOnly;if(cyclesOnly)cycleGroupIndex=0;pageIndex=0;focusMap=false;impactMap=false;orphansOnly=false;draw();};
    signals.append(b);
  } else signals.append(el('p','No circular imports detected in resolved internal dependencies.'));
  const hubs=data.modules.map(module=>({module,count:importerSets.get(module.id)?.size ?? 0}))
    .filter(item=>item.count>0).sort((a,b)=>b.count-a.count || a.module.id.localeCompare(b.module.id)).slice(0,3);
  if (hubs.length) {
    signals.append(el('h2','Most depended on'));
    for (const {module,count} of hubs) {
      const b=el('button',module.id,'dep'); b.append(el('small',`${count} direct importers`)); b.onclick=()=>choose(module.id); signals.append(b);
    }
  }
  panel.append(signals);
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
  if(reachability.known)panel.append(el('span',reachability.unreachable.has(id)?'Outside detected entry-point paths':'Reachable from detected entry points',`pill${reachability.unreachable.has(id)?' orphan-pill':''}`));
  for (const reason of module.entry) panel.append(el('span',reason,'pill'));
  const cycleIndex=cycleByModule.get(id);
  if (cycleIndex !== undefined) panel.append(el('span',`Circular group ${cycleIndex+1} · ${cycleGroups[cycleIndex]!.length} modules`,'pill cycle-pill'));
  if (module.url) panel.append(el('p'),link('Open module on GitHub ↗',module.url));
  const directCount = importerSets.get(id)?.size ?? 0;
  const totalDependents = Math.max(0,impactNeighborhood(data.modules,internal,id).length-1);
  const summary = el('div','','impact-summary');
  summary.append(el('h2','Change impact'));
  const metric = el('div','','impact-total');
  metric.append(el('strong',String(totalDependents)),el('span','potential dependents'));
  summary.append(metric,el('p',`${directCount} direct · ${totalDependents-directCount} indirect`),el('p','Based on resolved static imports.'));
  const impactButton = el('button',impactMap ? 'Exit impact map' : 'Show impact map','button impact-link');
  impactButton.id='impact-link';
  impactButton.onclick=()=>{impactMap=!impactMap;focusMap=false;orphansOnly=false;pageIndex=0;draw();choose(id);};
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
  const matches=cyclesOnly ? data.modules.filter(m=>cycleByModule.has(m.id) && (cycleGroupIndex<0 || cycleByModule.get(m.id)===cycleGroupIndex)) : focused ?? impacted ?? data.modules.filter(m=>(!query || m.id.toLowerCase().includes(query)) && (!group || m.group===group) && (!entriesOnly || m.entry.length) && (!orphansOnly || reachability.unreachable.has(m.id)));
  const scoped=matches;
  const pageCount=Math.max(1,Math.ceil(scoped.length/100));
  pageIndex=Math.min(pageIndex,pageCount-1);
  const visible=scoped.slice(pageIndex*100,(pageIndex+1)*100);
  $('focus').toggleAttribute('disabled',!selected);
  $('focus').classList.toggle('active',focusMap);
  $('focus').setAttribute('aria-pressed',String(focusMap));
  $('impact').toggleAttribute('disabled',!selected);
  $('impact').classList.toggle('active',impactMap);
  $('impact').setAttribute('aria-pressed',String(impactMap));
  $('cycles').toggleAttribute('disabled',cycleGroups.length===0);
  $('cycles').classList.toggle('active',cyclesOnly);
  $('cycles').setAttribute('aria-pressed',String(cyclesOnly));
  $('orphans').toggleAttribute('disabled',!reachability.known||reachability.unreachable.size===0);
  $('orphans').classList.toggle('active',orphansOnly);
  $('orphans').setAttribute('aria-pressed',String(orphansOnly));
  const cycleSelect=$('cycle-group') as HTMLSelectElement;
  cycleSelect.hidden=!cyclesOnly;
  cycleSelect.value=String(cycleGroupIndex);
  const cycleLink=document.getElementById('cycle-link');
  if(cycleLink) cycleLink.textContent=cyclesOnly ? 'Exit cycle map' : 'Explore circular dependencies';
  const impactLink=document.getElementById('impact-link');
  if(impactLink) impactLink.textContent=impactMap ? 'Exit impact map' : 'Show impact map';
  const pageStatus=$('page-status');
  pageStatus.textContent=scoped.length>100 ? `${pageIndex*100+1}–${Math.min((pageIndex+1)*100,scoped.length)} of ${scoped.length}` : `${scoped.length} modules`;
  pageStatus.hidden=scoped.length<=100;
  ($('page-previous') as HTMLButtonElement).disabled=pageIndex===0;
  ($('page-next') as HTMLButtonElement).disabled=pageIndex>=pageCount-1;
  $('view-count').textContent=cyclesOnly ? `${visible.length} modules · ${cycleGroupIndex<0 ? `all ${cycleGroups.length} cycles` : `cycle ${cycleGroupIndex+1}/${cycleGroups.length}`}` : `${visible.length} / ${scoped.length} ${orphansOnly ? 'unreachable' : focused ? 'connected' : impacted ? 'affected' : 'matching'} modules`;
  $('view-description').textContent=cyclesOnly ? `${cycleGroupIndex<0 ? `${cycleGroups.length} circular groups` : `Cycle group ${cycleGroupIndex+1} of ${cycleGroups.length}`} · amber links are part of a cycle` : orphansOnly ? 'Outside paths from detected entry points · entry detection is heuristic' : impacted ? `Potential change impact for ${selected} · reverse imports` : focused ? `Direct neighborhood of ${selected}` : 'Click a connection for its code';
  const list=$('module-list'); list.replaceChildren();
  for (const m of visible) { const b=el('button',`${m.entry.length ? '● ' : ''}${m.id}`,selected===m.id ? 'selected' : ''); b.onclick=()=>choose(m.id); list.append(b); }
  if (!matches.length) list.append(el('p','No matching modules.'));
  const graph=$('graph'); graph.replaceChildren();
  const ids=new Set(visible.map(m=>m.id));
  const edges=internal.filter(e=>ids.has(e.source)&&ids.has(e.target)&&(!cyclesOnly||cycleByModule.get(e.source)===cycleByModule.get(e.target)));
  // Three stable columns: likely entry points, connecting modules, leaf modules.
  const buckets: Module[][]=[[],[],[]];
  for(const m of visible) buckets[m.entry.length ? 0 : modulesWithImports.has(m.id) ? 1 : 2].push(m);
  const labels=['ENTRY POINTS','MODULES','LEAVES'];
  const columns:{modules:Module[];label:string}[]=[];
  buckets.forEach((bucket,index)=>{for(let start=0;start<bucket.length;start+=20){const lane=start/20;columns.push({modules:bucket.slice(start,start+20),label:lane?`${labels[index]} · ${lane+1}`:labels[index]!});}});
  const circleCycles=cyclesOnly && visible.length>1 && visible.length<=10;
  const radius=circleCycles ? Math.max(150,250/(2*Math.sin(Math.PI/visible.length))) : 0;
  const width=circleCycles ? Math.max(920,2*(radius+160)) : Math.max(920,columns.length*300+20);
  const height=circleCycles ? Math.max(450,2*(radius+95)) : Math.max(450,Math.max(...columns.map(column=>column.modules.length),0)*88+90);
  graph.setAttribute('viewBox',`0 0 ${width} ${height}`); graph.setAttribute('width',String(width*zoom)); graph.setAttribute('height',String(height*zoom));
  const defs=svg('defs'), marker=svg('marker',{id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'}); marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#8190a8'}));defs.append(marker);graph.append(defs);
  const positions=new Map<string,{x:number;y:number}>();
  if(circleCycles){
    const label=svg('text',{x:25,y:30,class:'graph-label'});label.textContent=`CIRCULAR DEPENDENCY · ${visible.length} MODULES`;graph.append(label);
    visible.forEach((m,index)=>{const angle=-Math.PI/2+index*2*Math.PI/visible.length;positions.set(m.id,{x:width/2+radius*Math.cos(angle)-120,y:height/2+radius*Math.sin(angle)-29});});
  }else columns.forEach((column,col)=>{const label=svg('text',{x:col*300+25,y:30,class:'graph-label'});label.textContent=column.label;graph.append(label);column.modules.forEach((m,row)=>positions.set(m.id,{x:col*300+25,y:row*88+55}));});
  for (const edge of edges) {
    const a=positions.get(edge.source)!,b=positions.get(edge.target)!;
    let d:string;
    if(circleCycles){
      const ax=a.x+120,ay=a.y+29,bx=b.x+120,by=b.y+29,dx=bx-ax,dy=by-ay;
      const fromX=Math.abs(dx)>Math.abs(dy)?a.x+(dx>0?240:0):ax,fromY=Math.abs(dx)>Math.abs(dy)?ay:a.y+(dy>0?58:0);
      const toX=Math.abs(dx)>Math.abs(dy)?b.x+(dx>0?0:240):bx,toY=Math.abs(dx)>Math.abs(dy)?by:b.y+(dy>0?0:58);
      const vx=toX-fromX,vy=toY-fromY;
      d=`M ${fromX} ${fromY} C ${fromX+vx*.34} ${fromY+vy*.34}, ${toX-vx*.34} ${toY-vy*.34}, ${toX} ${toY}`;
    }else d=a.x===b.x ? `M ${a.x+240} ${a.y+27} C ${a.x+280} ${a.y+27}, ${b.x+280} ${b.y+27}, ${b.x+240} ${b.y+27}` : `M ${a.x+240} ${a.y+27} C ${a.x+275} ${a.y+27}, ${b.x-35} ${b.y+27}, ${b.x} ${b.y+27}`;
    const isCycle=cycleByModule.has(edge.source)&&cycleByModule.get(edge.source)===cycleByModule.get(edge.target);
    const description=`${edge.source} imports ${edge.target} at line ${edge.line}${isCycle?' · circular dependency':''}`;
    const p=svg('path',{d,class:`edge${isCycle?' cycle-edge':''}${selectedEdge===edge ? ' selected':''}`,'marker-end':'url(#arrow)','aria-hidden':'true'});
    const hit=svg('path',{d,class:'edge-hit',tabindex:0,role:'button','aria-label':description});
    hit.addEventListener('click',()=>edgeDetail(edge)); hit.addEventListener('keydown',(e)=>{if((e as KeyboardEvent).key==='Enter'||(e as KeyboardEvent).key===' ')edgeDetail(edge);}); graph.append(p,hit);
  }
  for(const m of visible) {
    const {x,y}=positions.get(m.id)!; const g=svg('g',{transform:`translate(${x},${y})`,class:`node${m.entry.length?' entry':''}${cycleByModule.has(m.id)?' cyclic':''}${reachability.unreachable.has(m.id)?' orphan':''}${selected===m.id?' selected':''}`,tabindex:0,role:'button','aria-label':`${m.id}${reachability.unreachable.has(m.id)?' · outside detected entry-point paths':''}${cycleByModule.has(m.id)?' · circular dependency':''}`});
    const title=svg('title');title.textContent=m.id;g.append(title,svg('rect',{width:240,height:58,rx:8}));
    const text=svg('text',{x:12,y:24}); const name=m.id.split('/').at(-1)!;text.textContent=(m.entry.length?'● ':'')+(name.length>28?name.slice(0,25)+'…':name);
    const meta=svg('text',{x:12,y:43,class:'meta'});meta.textContent=m.group.length>32?'…'+m.group.slice(-31):m.group;g.append(text,meta);
    g.addEventListener('click',()=>choose(m.id));g.addEventListener('keydown',(e)=>{if((e as KeyboardEvent).key==='Enter')choose(m.id);});graph.append(g);
  }
}
for(const id of ['page-previous','page-next']) $(id).addEventListener('click',()=>{pageIndex+=id==='page-next'?1:-1;draw();});
$('search').addEventListener('input',()=>{pageIndex=0;draw();});$('group').addEventListener('change',()=>{pageIndex=0;draw();});
$('entries').onclick=()=>{entriesOnly=!entriesOnly;orphansOnly=false;pageIndex=0;$('entries').classList.toggle('active',entriesOnly);$('entries').setAttribute('aria-pressed',String(entriesOnly));draw();};
$('orphans').onclick=()=>{if(reachability.known&&reachability.unreachable.size){orphansOnly=!orphansOnly;entriesOnly=false;focusMap=false;impactMap=false;cyclesOnly=false;pageIndex=0;draw();}};
$('impact').onclick=()=>{if(selected){impactMap=!impactMap;focusMap=false;cyclesOnly=false;orphansOnly=false;pageIndex=0;draw();}};
$('focus').onclick=()=>{if(selected){focusMap=!focusMap;impactMap=false;cyclesOnly=false;orphansOnly=false;pageIndex=0;draw();}};
$('cycles').onclick=()=>{cyclesOnly=!cyclesOnly;focusMap=false;impactMap=false;orphansOnly=false;pageIndex=0;draw();};
$('cycle-group').addEventListener('change',()=>{cycleGroupIndex=Number(($('cycle-group') as HTMLSelectElement).value);pageIndex=0;draw();});
$('reset').onclick=()=>{($('search') as HTMLInputElement).value='';($('group') as HTMLSelectElement).value='';entriesOnly=false;focusMap=false;impactMap=false;cyclesOnly=false;orphansOnly=false;cycleGroupIndex=0;pageIndex=0;selected=undefined;selectedEdge=undefined;zoom=1;$('entries').classList.remove('active');$('entries').setAttribute('aria-pressed','false');intro();draw();};
$('zoom-in').onclick=()=>{zoom=Math.min(2,zoom+0.2);draw();};$('zoom-out').onclick=()=>{zoom=Math.max(0.4,zoom-0.2);draw();};
document.addEventListener('keydown',e=>{if(e.key==='/' && !(e.target instanceof HTMLInputElement)){e.preventDefault();$('search').focus();}});
intro();draw();
