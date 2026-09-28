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
  const modules=comparison.modules,dependencies=comparison.dependencies;
  return [
    '## RepoAtlas architecture change',
    '',
    `- **Modules:** +${modules.added.length} added · −${modules.removed.length} removed`,
    `- **Imports:** +${dependencies.added.length} added · −${dependencies.removed.length} removed · ${dependencies.changedSpecifier.length} changed specifiers`,
    `- **Snapshots:** \`${commitLabel(comparison.base.commit)}\` → \`${commitLabel(comparison.head.commit)}\``,
    '',
    `[Download the interactive, source-linked HTML diff](<${artifact}>)`,
    '',
    '> Counts describe resolved static source imports; they do not infer runtime behavior.',
    '',
  ].join('\n');
}
