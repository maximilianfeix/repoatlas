import { buildBoundaryMatrix } from './boundaries.js';
import { analyzeReachability, findCycles } from './insights.js';
import type { Atlas, Edge } from './types.js';

export interface ArchitectureConfig {
  forbiddenImports?: { from: string; to: string }[];
  limits?: { cycleGroups?: number; unreachableModules?: number };
}

export interface RuleViolation {
  rule: 'forbidden-import' | 'max-cycle-groups' | 'max-unreachable-modules';
  message: string;
  source?: string;
  target?: string;
  edge?: Edge;
  actual?: number;
  maximum?: number;
  modules?: string[];
}

export interface RuleResult {
  passed: boolean;
  violations: RuleViolation[];
  metrics: { cycleGroups: number; unreachableModules: number | null };
  baseline?: { cycleGroups: number; unreachableModules: number | null; preExistingViolations: number };
}

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Parse a small, versioned-by-package JSON config without accepting ambiguous values. */
export function parseArchitectureConfig(value: unknown): ArchitectureConfig {
  if (!isRecord(value)) throw new Error('Invalid RepoAtlas config: expected a JSON object.');
  const allowed = new Set(['forbiddenImports', 'limits']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`Invalid RepoAtlas config: unknown property "${key}".`);
  const config: ArchitectureConfig = {};
  if ('forbiddenImports' in value) {
    if (!Array.isArray(value.forbiddenImports)) throw new Error('Invalid RepoAtlas config: forbiddenImports must be an array.');
    const seen = new Set<string>();
    config.forbiddenImports = value.forbiddenImports.map((item, index) => {
      if (!isRecord(item) || typeof item.from !== 'string' || !item.from.trim() || typeof item.to !== 'string' || !item.to.trim() || Object.keys(item).some(key => key !== 'from' && key !== 'to')) {
        throw new Error(`Invalid RepoAtlas config: forbiddenImports[${index}] requires only non-empty from and to strings.`);
      }
      const key = JSON.stringify([item.from, item.to]);
      if (seen.has(key)) throw new Error(`Invalid RepoAtlas config: duplicate forbiddenImports boundary pair at index ${index}.`);
      seen.add(key);
      return { from: item.from, to: item.to };
    });
  }
  if ('limits' in value) {
    if (!isRecord(value.limits)) throw new Error('Invalid RepoAtlas config: limits must be an object.');
    const limits: NonNullable<ArchitectureConfig['limits']> = {};
    for (const key of Object.keys(value.limits)) {
      if (key !== 'cycleGroups' && key !== 'unreachableModules') throw new Error(`Invalid RepoAtlas config: unknown limit "${key}".`);
      const count = value.limits[key];
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error(`Invalid RepoAtlas config: limits.${key} must be a non-negative integer.`);
      limits[key] = count;
    }
    config.limits = limits;
  }
  return config;
}

/** Check static architecture rules against the same resolved graph used by the map. */
export function checkArchitecture(atlas: Atlas, config: ArchitectureConfig, baseline?: Atlas): RuleResult {
  const matrix = buildBoundaryMatrix(atlas.modules, atlas.edges);
  const groupIds = new Set(matrix.groups.map(group => group.id));
  for (const rule of config.forbiddenImports ?? []) {
    if (!groupIds.has(rule.from)) throw new Error(`Invalid RepoAtlas config: unknown boundary "${rule.from}".`);
    if (!groupIds.has(rule.to)) throw new Error(`Invalid RepoAtlas config: unknown boundary "${rule.to}".`);
  }
  const violations: RuleViolation[] = [];
  const baselineMatrix=baseline?buildBoundaryMatrix(baseline.modules,baseline.edges):undefined;
  const baselineForbidden=new Map<string,number>();
  for(const cell of baselineMatrix?.cells??[])for(const edge of cell.edges){
    const identity=JSON.stringify([cell.source,cell.target,edge.source,edge.target,edge.specifier,edge.kind]);
    baselineForbidden.set(identity,(baselineForbidden.get(identity)??0)+1);
  }
  const consumeBaselineEdge=(identity:string)=>{const count=baselineForbidden.get(identity)??0;if(!count)return false;baselineForbidden.set(identity,count-1);return true;};
  let preExistingViolations=0;
  for (const rule of config.forbiddenImports ?? []) {
    for (const cell of matrix.cells) {
      if (cell.source !== rule.from || cell.target !== rule.to) continue;
      for (const edge of cell.edges) {
        const identity=JSON.stringify([cell.source,cell.target,edge.source,edge.target,edge.specifier,edge.kind]);
        const alreadyExisted=baseline?consumeBaselineEdge(identity):false;
        if(alreadyExisted){preExistingViolations++;continue;}
        violations.push({
          rule: 'forbidden-import', source: rule.from, target: rule.to,
          message: `${rule.from} must not import ${rule.to}: ${edge.source}:${edge.line} imports ${edge.target}.`, edge,
        });
      }
    }
  }
  const cycles = findCycles(atlas.modules, atlas.edges);
  const reachability = analyzeReachability(atlas.modules, atlas.edges);
  const baselineCycles=baseline?findCycles(baseline.modules,baseline.edges):undefined;
  const cycleKey=(group:typeof cycles[number])=>JSON.stringify(group.map(module=>module.id).sort());
  const oldCycleKeys=new Set((baselineCycles??[]).map(cycleKey));
  const addedCycles=baseline?cycles.filter(group=>!oldCycleKeys.has(cycleKey(group))):cycles;
  if (config.limits?.cycleGroups !== undefined && addedCycles.length > config.limits.cycleGroups) {
    violations.push({ rule: 'max-cycle-groups', message: baseline?`Found ${addedCycles.length} new cycle groups; maximum new groups is ${config.limits.cycleGroups}.`:`Found ${cycles.length} cycle groups; maximum is ${config.limits.cycleGroups}.`, actual: baseline?addedCycles.length:cycles.length, maximum: config.limits.cycleGroups, modules: (baseline?addedCycles:cycles).flat().map(module => module.id) });
  }
  const baselineReachability=baseline?analyzeReachability(baseline.modules,baseline.edges):undefined;
  const comparableReachability=reachability.known&&(!baseline||baselineReachability?.known);
  const newlyUnreachable=baseline&&baselineReachability?.known?[...reachability.unreachable].filter(id=>!baselineReachability.unreachable.has(id)):[...reachability.unreachable];
  if (config.limits?.unreachableModules !== undefined && reachability.known && comparableReachability && newlyUnreachable.length > config.limits.unreachableModules) {
    const modules = baseline?newlyUnreachable:[...reachability.unreachable];
    violations.push({ rule: 'max-unreachable-modules', message: baseline?`Found ${modules.length} newly unreachable modules; maximum new modules is ${config.limits.unreachableModules}.`:`Found ${modules.length} modules outside detected entry paths; maximum is ${config.limits.unreachableModules}.`, actual: modules.length, maximum: config.limits.unreachableModules, modules });
  }
  if(baseline){
    const existingCycles=cycles.length-addedCycles.length;
    const cycleDebt=Math.max(0,existingCycles-(config.limits?.cycleGroups??Number.POSITIVE_INFINITY));
    const existingOrphans=baselineReachability?.known?[...reachability.unreachable].filter(id=>baselineReachability.unreachable.has(id)).length:0;
    const orphanDebt=Math.max(0,existingOrphans-(config.limits?.unreachableModules??Number.POSITIVE_INFINITY));
    preExistingViolations+=cycleDebt+orphanDebt;
  }
  const result:RuleResult={ passed: violations.length === 0, violations, metrics: { cycleGroups: cycles.length, unreachableModules: reachability.known ? reachability.unreachable.size : null } };
  if(baseline)result.baseline={cycleGroups:baselineCycles?.length??0,unreachableModules:baselineReachability?.known?baselineReachability.unreachable.size:null,preExistingViolations};
  return result;
}

export function renderRuleReport(result: RuleResult): string {
  const unreachable = result.metrics.unreachableModules === null ? 'unknown (no entry points detected)' : String(result.metrics.unreachableModules);
  const lines = [`Architecture checks: ${result.passed ? 'passed' : 'failed'}`, `Metrics: ${result.metrics.cycleGroups} cycle groups · ${unreachable} modules outside detected entry paths`];
  if(result.baseline)lines.push(`Baseline: ${result.baseline.cycleGroups} cycle groups · ${result.baseline.unreachableModules===null?'unknown (no entry points detected)':`${result.baseline.unreachableModules} modules outside detected entry paths`} · ${result.baseline.preExistingViolations} pre-existing violations ignored`);
  if (!result.violations.length) lines.push('No rule violations.');
  else for (const violation of result.violations) lines.push(`FAIL ${violation.message}`);
  return lines.join('\n') + '\n';
}

/** Render GitHub workflow commands with all untrusted paths/messages safely escaped. */
export function renderGitHubAnnotations(result: RuleResult): string {
  const escapeProperty=(value:string)=>value.replace(/[%\r\n:,]/g,char=>({ '%':'%25','\r':'%0D','\n':'%0A',':':'%3A',',':'%2C' }[char]!));
  const escapeData=(value:string)=>value.replace(/[%\r\n]/g,char=>({ '%':'%25','\r':'%0D','\n':'%0A' }[char]!));
  return result.violations.map(violation=>{
    const properties=violation.edge?` file=${escapeProperty(violation.edge.source)},line=${violation.edge.line},title=RepoAtlas forbidden import`:' title=RepoAtlas architecture rule';
    return `::error${properties}::${escapeData(violation.message)}`;
  }).join('\n')+(result.violations.length?'\n':'');
}
