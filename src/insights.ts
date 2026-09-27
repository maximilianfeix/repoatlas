import type { Edge, Module } from './types.js';

export interface Reachability {
  known: boolean;
  reachable: Set<string>;
  unreachable: Set<string>;
}

/** Find modules reachable from recognized entry points over resolved internal imports. */
export function analyzeReachability(modules: Module[], edges: Edge[]): Reachability {
  const entries=modules.filter(module=>module.entry.length>0);
  const reachable=new Set<string>();
  if(!entries.length)return {known:false,reachable,unreachable:new Set()};
  const ids=new Set(modules.map(module=>module.id));
  const adjacency=new Map(modules.map(module=>[module.id,new Set<string>()]));
  for(const edge of edges){
    if(edge.resolution==='internal'&&ids.has(edge.source)&&ids.has(edge.target))adjacency.get(edge.source)!.add(edge.target);
  }
  const pending:string[]=[];
  for(const entry of entries)if(!reachable.has(entry.id)){reachable.add(entry.id);pending.push(entry.id);}
  while(pending.length){
    const id=pending.pop()!;
    for(const target of adjacency.get(id)??[])if(!reachable.has(target)){reachable.add(target);pending.push(target);}
  }
  const orderedReachable=new Set(modules.filter(module=>reachable.has(module.id)).map(module=>module.id));
  return {known:true,reachable:orderedReachable,unreachable:new Set(modules.filter(module=>!reachable.has(module.id)).map(module=>module.id))};
}

/** Return deterministic strongly connected groups that contain a real import cycle. */
export function findCycles(modules: Module[], edges: Edge[]): Module[][] {
  const ids = new Set(modules.map(module => module.id));
  const adjacency = new Map(modules.map(module => [module.id, new Set<string>()]));
  for (const edge of edges) {
    if (edge.resolution === 'internal' && ids.has(edge.source) && ids.has(edge.target)) {
      adjacency.get(edge.source)!.add(edge.target);
    }
  }

  let nextIndex = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  function enter(id: string) {
    index.set(id, nextIndex);
    low.set(id, nextIndex++);
    stack.push(id);
    onStack.add(id);
  }

  function collect(id: string) {
    if (low.get(id) === index.get(id)) {
      const component: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
      } while (member !== id);

      if (component.length > 1 || adjacency.get(id)!.has(id)) components.push(component);
    }
  }

  // Use explicit DFS frames: large (but allowed) repos can contain import chains
  // deeper than the JavaScript call stack.
  for (const module of modules) {
    if (index.has(module.id)) continue;
    enter(module.id);
    const frames: { id: string; targets: string[]; next: number; parent?: string }[] = [
      { id: module.id, targets: [...adjacency.get(module.id)!], next: 0 },
    ];

    while (frames.length) {
      const frame = frames[frames.length - 1]!;
      if (frame.next < frame.targets.length) {
        const target = frame.targets[frame.next++]!;
        if (!index.has(target)) {
          enter(target);
          frames.push({ id: target, targets: [...adjacency.get(target)!], next: 0, parent: frame.id });
        } else if (onStack.has(target)) {
          low.set(frame.id, Math.min(low.get(frame.id)!, index.get(target)!));
        }
        continue;
      }

      frames.pop();
      if (frame.parent) low.set(frame.parent, Math.min(low.get(frame.parent)!, low.get(frame.id)!));
      collect(frame.id);
    }
  }
  const order = new Map(modules.map((module, position) => [module.id, position]));
  return components
    .map(component => component.sort((a, b) => order.get(a)! - order.get(b)!))
    .sort((a, b) => order.get(a[0]!)! - order.get(b[0]!)!)
    .map(component => component.map(id => modules[order.get(id)!]!));
}
