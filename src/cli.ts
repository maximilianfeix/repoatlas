#!/usr/bin/env node
import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { analyze, githubURL } from './analyze.js';
import { render } from './render.js';
import { compareAtlases, parseAtlas } from './compare.js';
import { renderComparisonHtml } from './compare-render.js';
import { renderArchitectureCard, renderBoundarySvg, renderTextReport } from './report.js';
import { checkArchitecture, parseArchitectureConfig, renderGitHubAnnotations, renderRuleReport } from './rules.js';

const packageVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version as string;
async function loadSnapshot(file:string) {
  let contents:string;
  try{contents=await readFile(path.resolve(file),'utf8');}catch{throw new Error(`Could not read snapshot file: ${file}`);}
  let value:unknown;
  try{value=JSON.parse(contents);}catch{throw new Error(`Snapshot is not valid JSON: ${file}`);}
  return parseAtlas(value);
}
const program = new Command().name('repoatlas').version(packageVersion).description('Understand a TypeScript repo in one interactive map. Every edge has evidence.')
  .argument('[source]', 'GitHub HTTPS repository URL or local directory')
  .option('-o, --out <file>', 'write a standalone HTML map', 'repoatlas.html')
  .option('--json', 'emit the complete graph as JSON; do not write HTML')
  .option('--include-tests', 'include test files, fixtures and test directories')
  .option('--include-js', 'include JavaScript and JSX modules in mixed repositories')
  .option('--activity-days <days>', 'color modules by committed file changes within 1–365 days (optional Git history scan)')
  .option('--force', 'replace an existing output file')
  .option('--ref <ref>', 'Git branch or tag to clone')
  .action(async (source: string | undefined, opts) => {
    if (!source) { program.help(); return; }
    let temp: string | undefined;
    try {
      const activityDays=opts.activityDays===undefined?undefined:Number(opts.activityDays);
      if(activityDays!==undefined&&(!Number.isSafeInteger(activityDays)||activityDays<1||activityDays>365))throw new Error('--activity-days must be a whole number from 1 to 365.');
      let root = path.resolve(source), repository: string | undefined;
      if (/^[a-z]+:\/\//i.test(source)) {
        repository = githubURL(source);
        temp = await mkdtemp(path.join(tmpdir(),'repoatlas-'));
        root = path.join(temp,'repo');
        if (opts.ref && (opts.ref.startsWith('-') || /[\x00-\x20]/.test(opts.ref))) throw new Error('Invalid Git ref.');
        process.stderr.write(`Reading ${repository}…\n`);
        try {
          execFileSync('git',['-c','core.hooksPath=/dev/null','-c','protocol.file.allow=never','clone','--quiet','--depth',activityDays===undefined?'1':'2000','--single-branch',...(opts.ref ? ['--branch',opts.ref] : []),'--',repository,root], {stdio:['ignore','pipe','pipe'],timeout:120000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_LFS_SKIP_SMUDGE:'1'}});
        } catch { throw new Error('Could not clone repository. Check its URL, Git credentials, network and --ref.'); }
      } else if (opts.ref) throw new Error('--ref is supported only with a GitHub URL.');
      const atlas = await analyze(root, {includeTests: opts.includeTests,includeJS:opts.includeJs,repository,activityDays});
      if (opts.json) process.stdout.write(JSON.stringify(atlas,null,2)+'\n');
      else {
        const out = path.resolve(opts.out);
        await mkdir(path.dirname(out),{recursive:true});
        await writeFile(out,render(atlas),{flag:opts.force ? 'w':'wx'});
        process.stdout.write(`Map saved: ${out}\n${atlas.modules.length} modules · ${atlas.edges.length} evidenced dependencies\n`);
        for (const warning of atlas.warnings) process.stderr.write(`Note: ${warning}\n`);
      }
    } finally { if (temp) await rm(temp,{recursive:true,force:true}); }
  });
program.command('doctor').description('Check runtime and Git; local analysis needs no authentication').action(() => {
  let git = false;
  try { execFileSync('git',['--version'],{stdio:'ignore'}); git = true; } catch {}
  const result = {node:process.version,git,offline:true,auth:'Git credential helper for private repositories; not required for local/public repositories'};
  console.log(program.opts().json ? JSON.stringify(result) : `Node ${result.node}\nGit: ${git ? 'available':'missing (needed for GitHub URLs)'}\nLocal analysis: ready, no auth required`);
});
program.command('compare').description('Compare two RepoAtlas JSON snapshots for architecture drift')
  .argument('<base>', 'baseline RepoAtlas JSON file')
  .argument('<head>', 'current RepoAtlas JSON file')
  .option('--json', 'emit machine-readable JSON instead of text')
  .option('--format <format>', 'text, json, or interactive html', 'text')
  .option('--output <file>', 'write HTML to a standalone file (requires --format html)')
  .option('--overwrite', 'replace an existing --output file')
  .action(async (baseFile:string,headFile:string,opts) => {
    if(!['text','json','html'].includes(opts.format))throw new Error('--format must be text, json, or html.');
    if(opts.overwrite&&!opts.output)throw new Error('--overwrite requires --output.');
    if(opts.output&&opts.format!=='html')throw new Error('--output is supported only with --format html.');
    if(opts.format==='html'&&!opts.output)throw new Error('--format html requires --output <file>.');
    if((opts.json||program.opts().json||process.argv.includes('--json'))&&opts.format!=='text')throw new Error('Choose either --json or --format, not both.');
    const [base,head]=await Promise.all([loadSnapshot(baseFile),loadSnapshot(headFile)]);
    const comparison=compareAtlases(base,head);
    if(opts.format==='html'){
      const output=path.resolve(opts.output);await writeFile(output,renderComparisonHtml(comparison),{flag:opts.overwrite?'w':'wx'});
      process.stdout.write(`Architecture diff saved: ${output}\n`);return;
    }
    if(opts.json||opts.format==='json'||program.opts().json||process.argv.includes('--json')){process.stdout.write(JSON.stringify(comparison,null,2)+'\n');return;}
    const baseCommit=comparison.base.commit?` (${comparison.base.commit.slice(0,10)})`:'';
    const headCommit=comparison.head.commit?` (${comparison.head.commit.slice(0,10)})`:'';
    process.stdout.write(`Architecture drift: ${comparison.base.name}${baseCommit} → ${comparison.head.name}${headCommit}\n`);
    process.stdout.write(`Modules: +${comparison.modules.added.length} added · −${comparison.modules.removed.length} removed\n`);
    process.stdout.write(`Dependencies: +${comparison.dependencies.added.length} added · −${comparison.dependencies.removed.length} removed · ${comparison.dependencies.changedSpecifier.length} changed specifiers\n`);
    process.stdout.write(`Public exports: +${comparison.exports.added.length} added · −${comparison.exports.removed.length} removed · ${comparison.exports.unavailableModules.length} modules unavailable\n`);
    process.stdout.write(`Imported bindings: +${comparison.importBindings.added.length} added · −${comparison.importBindings.removed.length} removed · ${comparison.importBindings.unavailableSnapshots.length} snapshots unavailable\n`);
    for(const side of ['base','head'] as const){const impact=comparison.impact[side];if(!impact.known){process.stdout.write(`Entry paths (${side}): unknown (no detected entry points)\n`);continue;}const omittedSteps=impact.routes.reduce((total,route)=>total+route.omittedSteps,0);process.stdout.write(`Entry paths (${side}): ${impact.routes.length} reachable changed modules across ${impact.entryPoints} detected entr${impact.entryPoints===1?'y':'ies'} · ${impact.unreachableModules.length} outside entry paths · ${impact.omittedModules} modules and ${omittedSteps} path steps omitted\n`);}
    for(const id of comparison.modules.added.slice(0,20))process.stdout.write(`  + module ${id}\n`);
    for(const id of comparison.modules.removed.slice(0,20))process.stdout.write(`  − module ${id}\n`);
    for(const edge of comparison.dependencies.added.slice(0,20))process.stdout.write(`  + ${edge.source} → ${edge.target} (${edge.resolution})\n`);
    for(const edge of comparison.dependencies.removed.slice(0,20))process.stdout.write(`  − ${edge.source} → ${edge.target} (${edge.resolution})\n`);
    for(const change of comparison.dependencies.changedSpecifier.slice(0,20))process.stdout.write(`  ~ ${change.before.source}: ${change.before.specifier} → ${change.after.specifier}\n`);
    for(const item of comparison.exports.added.slice(0,20))process.stdout.write(`  + export ${item.moduleId}:${item.line} ${item.name} (${item.kind})\n`);
    for(const item of comparison.exports.removed.slice(0,20))process.stdout.write(`  − export ${item.moduleId}:${item.line} ${item.name} (${item.kind})\n`);
    for(const item of comparison.importBindings.added.slice(0,20))process.stdout.write(`  + binding ${item.sourceModule}:${item.line} ${item.name}${item.name===item.localName?'':` as ${item.localName}`} → ${item.targetModule}\n`);
    for(const item of comparison.importBindings.removed.slice(0,20))process.stdout.write(`  − binding ${item.sourceModule}:${item.line} ${item.name}${item.name===item.localName?'':` as ${item.localName}`} → ${item.targetModule}\n`);
    for(const side of ['base','head'] as const){const impact=comparison.impact[side];for(const route of impact.routes.slice(0,8))process.stdout.write(`  ${side}: entry path ${route.entry} → ${route.moduleId} (${route.totalSteps} imports${route.omittedSteps?`; ${route.omittedSteps} intermediate edges omitted`:''})\n`);}
    const omitted=Math.max(0,comparison.modules.added.length-20)+Math.max(0,comparison.modules.removed.length-20)+Math.max(0,comparison.dependencies.added.length-20)+Math.max(0,comparison.dependencies.removed.length-20)+Math.max(0,comparison.dependencies.changedSpecifier.length-20)+Math.max(0,comparison.exports.added.length-20)+Math.max(0,comparison.exports.removed.length-20)+Math.max(0,comparison.importBindings.added.length-20)+Math.max(0,comparison.importBindings.removed.length-20)+comparison.impact.base.omittedModules+comparison.impact.head.omittedModules+comparison.impact.base.routes.reduce((total,route)=>total+route.omittedSteps,0)+comparison.impact.head.routes.reduce((total,route)=>total+route.omittedSteps,0)+Math.max(0,comparison.impact.base.routes.length-8)+Math.max(0,comparison.impact.head.routes.length-8);
    if(omitted)process.stdout.write(`  … ${omitted} more changes or path steps omitted; --json includes exact omission counts.\n`);
  });
program.command('report').description('Export a text report, boundary SVG, or README architecture card')
  .argument('<snapshot>', 'RepoAtlas JSON snapshot')
  .option('--format <format>', 'text, svg, or card', 'text')
  .option('--output <file>', 'write the report to a file instead of stdout')
  .option('--overwrite', 'replace an existing --output file')
  .action(async (snapshotFile:string,opts) => {
    if(!['text','svg','card'].includes(opts.format))throw new Error('--format must be text, svg, or card.');
    if(opts.overwrite&&!opts.output)throw new Error('--overwrite requires --output.');
    const atlas=await loadSnapshot(snapshotFile);
    const content=opts.format==='svg'?renderBoundarySvg(atlas):opts.format==='card'?renderArchitectureCard(atlas):renderTextReport(atlas);
    if(opts.output){
      const output=path.resolve(opts.output);await writeFile(output,content,{flag:opts.overwrite?'w':'wx'});
      process.stdout.write(`Report saved: ${output}\n`);
    }else process.stdout.write(content);
  });
program.command('check').description('Fail CI when configured architecture rules are violated or worsened from a baseline')
  .argument('<snapshot>', 'RepoAtlas JSON snapshot')
  .requiredOption('-c, --config <file>', 'JSON architecture rules configuration')
  .option('--baseline <snapshot>', 'ignore configured violations already present in a baseline snapshot')
  .option('--json', 'emit machine-readable results')
  .option('--format <format>', 'text, json, or GitHub Actions annotations', 'text')
  .action(async (snapshotFile:string,opts) => {
    if(!['text','json','github'].includes(opts.format))throw new Error('--format must be text, json, or github.');
    let configText:string;
    try{configText=await readFile(path.resolve(opts.config),'utf8');}catch{throw new Error(`Could not read config file: ${opts.config}`);}
    let configValue:unknown;
    try{configValue=JSON.parse(configText);}catch{throw new Error(`Config is not valid JSON: ${opts.config}`);}
    const [snapshot,baseline]=await Promise.all([loadSnapshot(snapshotFile),opts.baseline?loadSnapshot(opts.baseline):Promise.resolve(undefined)]);
    const result=checkArchitecture(snapshot,parseArchitectureConfig(configValue),baseline);
    const json=opts.json||program.opts().json||process.argv.includes('--json');
    if(json&&opts.format!=='text')throw new Error('Choose either --json or --format, not both.');
    if(json||opts.format==='json')process.stdout.write(JSON.stringify(result,null,2)+'\n');
    else if(opts.format==='github')process.stdout.write(renderGitHubAnnotations(result));
    else process.stdout.write(renderRuleReport(result));
    if(!result.passed)process.exitCode=1;
  });
program.command('schema').description('Print a published JSON Schema for a RepoAtlas file format')
  .argument('<format>', 'snapshot or config')
  .action((format:string) => {
    if(format!=='snapshot'&&format!=='config')throw new Error('Schema format must be either snapshot or config.');
    const schema=readFileSync(new URL(`../schemas/${format}.schema.json`,import.meta.url),'utf8');
    process.stdout.write(schema.trimEnd()+'\n');
  });
program.command('mcp').description('Expose local architecture evidence to an MCP-compatible coding agent')
  .argument('[path]', 'local TypeScript project directory', '.')
  .option('--include-tests', 'include test files, fixtures and test directories')
  .option('--include-js', 'include JavaScript and JSX modules in mixed repositories')
  .action(async (source:string,opts) => {
    if(/^[a-z]+:\/\//i.test(source))throw new Error('The MCP server reads a local directory. Clone the repository first.');
    const {runMcpServer}=await import('./mcp.js');
    await runMcpServer(path.resolve(source),packageVersion,{includeTests:opts.includeTests,includeJS:opts.includeJs});
  });
program.configureOutput({outputError: (str, write) => write(process.argv.includes('--json') ? JSON.stringify({error:str.trim()})+'\n' : str)});
program.parseAsync().catch((error: Error) => {
  const message = 'code' in error && error.code === 'EEXIST' ? 'Output exists. Choose another --out path or pass --force.' : error.message;
  console.error(process.argv.includes('--json') ? JSON.stringify({error:message}) : `repoatlas: ${message}`);
  process.exitCode = 1;
});
