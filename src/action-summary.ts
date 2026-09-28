import type { AtlasComparison } from './compare.js';

function validArtifactUrl(value:string):string {
  let parsed:URL;
  try{parsed=new URL(value);}catch{throw new Error('GitHub Actions did not provide a valid artifact URL.');}
  if(parsed.protocol!=='https:'||parsed.hostname!=='github.com'||parsed.username||parsed.password)throw new Error('Architecture artifact URL must use the GitHub HTTPS host.');
  parsed.search='';parsed.hash='';
  return parsed.href;
}

function commitLabel(value:string|undefined):string {
  return value&&/^[a-f0-9]{7,64}$/i.test(value)?value.slice(0,10):'unknown';
}

/** Render a source-free GitHub job summary that points reviewers to the HTML diff. */
export function renderActionSummary(comparison:AtlasComparison,artifactUrl:string):string {
  const artifact=validArtifactUrl(artifactUrl);
  const modules=comparison.modules,dependencies=comparison.dependencies,exports=comparison.exports;
  const impact=(side:'base'|'head')=>{const snapshot=comparison.impact[side];if(!snapshot.known)return 'unknown (no entry points detected)';const omittedSteps=snapshot.routes.reduce((total,route)=>total+route.omittedSteps,0);return `${snapshot.routes.length} reachable changed modules across ${snapshot.entryPoints} detected entr${snapshot.entryPoints===1?'y':'ies'} · ${snapshot.unreachableModules.length} outside entry paths · ${snapshot.omittedModules} modules and ${omittedSteps} path steps omitted`;};
  return [
    '## RepoAtlas architecture change',
    '',
    `- **Modules:** +${modules.added.length} added · −${modules.removed.length} removed`,
    `- **Imports:** +${dependencies.added.length} added · −${dependencies.removed.length} removed · ${dependencies.changedSpecifier.length} changed specifiers`,
    `- **Exports:** +${exports.added.length} added · −${exports.removed.length} removed · ${exports.unavailableModules.length} unavailable`,
    `- **Imported bindings:** +${comparison.importBindings.added.length} added · −${comparison.importBindings.removed.length} removed · ${comparison.importBindings.unavailableSnapshots.length} snapshots unavailable`,
    `- **Changed-module entry paths:** base ${impact('base')} · head ${impact('head')}`,
    `- **Snapshots:** \`${commitLabel(comparison.base.commit)}\` → \`${commitLabel(comparison.head.commit)}\``,
    '',
    `[Download the interactive, source-linked HTML diff](<${artifact}>)`,
    '',
    '> Paths follow resolved static imports, not runtime execution. Export counts describe syntax-level names, not type compatibility or semver safety.',
    '',
  ].join('\n');
}
