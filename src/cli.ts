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

const packageVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version as string;
const program = new Command().name('repoatlas').version(packageVersion).description('Understand a TypeScript repo in one interactive map. Every edge has evidence.')
  .argument('[source]', 'GitHub HTTPS repository URL or local directory')
  .option('-o, --out <file>', 'write a standalone HTML map', 'repoatlas.html')
  .option('--json', 'emit the complete graph as JSON; do not write HTML')
  .option('--include-tests', 'include test files, fixtures and test directories')
  .option('--force', 'replace an existing output file')
  .option('--ref <ref>', 'Git branch or tag to clone')
  .action(async (source: string | undefined, opts) => {
    if (!source) { program.help(); return; }
    let temp: string | undefined;
    try {
      let root = path.resolve(source), repository: string | undefined;
      if (/^[a-z]+:\/\//i.test(source)) {
        repository = githubURL(source);
        temp = await mkdtemp(path.join(tmpdir(),'repoatlas-'));
        root = path.join(temp,'repo');
        if (opts.ref && (opts.ref.startsWith('-') || /[\x00-\x20]/.test(opts.ref))) throw new Error('Invalid Git ref.');
        process.stderr.write(`Reading ${repository}…\n`);
        try {
          execFileSync('git',['-c','core.hooksPath=/dev/null','-c','protocol.file.allow=never','clone','--quiet','--depth','1','--single-branch',...(opts.ref ? ['--branch',opts.ref] : []),'--',repository,root], {stdio:['ignore','pipe','pipe'],timeout:120000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_LFS_SKIP_SMUDGE:'1'}});
        } catch { throw new Error('Could not clone repository. Check its URL, Git credentials, network and --ref.'); }
      } else if (opts.ref) throw new Error('--ref is supported only with a GitHub URL.');
      const atlas = await analyze(root, {includeTests: opts.includeTests,repository});
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
  .action(async (baseFile:string,headFile:string,opts) => {
    const loadSnapshot=async(file:string)=>{
      let contents:string;
      try{contents=await readFile(path.resolve(file),'utf8');}catch{throw new Error(`Could not read snapshot file: ${file}`);}
      let value:unknown;
      try{value=JSON.parse(contents);}catch{throw new Error(`Snapshot is not valid JSON: ${file}`);}
      return parseAtlas(value);
    };
    const [base,head]=await Promise.all([loadSnapshot(baseFile),loadSnapshot(headFile)]);
    const comparison=compareAtlases(base,head);
    if(opts.json||program.opts().json||process.argv.includes('--json')){process.stdout.write(JSON.stringify(comparison,null,2)+'\n');return;}
    const baseCommit=comparison.base.commit?` (${comparison.base.commit.slice(0,10)})`:'';
    const headCommit=comparison.head.commit?` (${comparison.head.commit.slice(0,10)})`:'';
    process.stdout.write(`Architecture drift: ${comparison.base.name}${baseCommit} → ${comparison.head.name}${headCommit}\n`);
    process.stdout.write(`Modules: +${comparison.modules.added.length} added · −${comparison.modules.removed.length} removed\n`);
    process.stdout.write(`Dependencies: +${comparison.dependencies.added.length} added · −${comparison.dependencies.removed.length} removed · ${comparison.dependencies.changedSpecifier.length} changed specifiers\n`);
    for(const id of comparison.modules.added.slice(0,20))process.stdout.write(`  + module ${id}\n`);
    for(const id of comparison.modules.removed.slice(0,20))process.stdout.write(`  − module ${id}\n`);
    for(const edge of comparison.dependencies.added.slice(0,20))process.stdout.write(`  + ${edge.source} → ${edge.target} (${edge.resolution})\n`);
    for(const edge of comparison.dependencies.removed.slice(0,20))process.stdout.write(`  − ${edge.source} → ${edge.target} (${edge.resolution})\n`);
    for(const change of comparison.dependencies.changedSpecifier.slice(0,20))process.stdout.write(`  ~ ${change.before.source}: ${change.before.specifier} → ${change.after.specifier}\n`);
    const omitted=Math.max(0,comparison.modules.added.length-20)+Math.max(0,comparison.modules.removed.length-20)+Math.max(0,comparison.dependencies.added.length-20)+Math.max(0,comparison.dependencies.removed.length-20)+Math.max(0,comparison.dependencies.changedSpecifier.length-20);
    if(omitted)process.stdout.write(`  … ${omitted} more changes (use --json for the full report)\n`);
  });
program.configureOutput({outputError: (str, write) => write(process.argv.includes('--json') ? JSON.stringify({error:str.trim()})+'\n' : str)});
program.parseAsync().catch((error: Error) => {
  const message = 'code' in error && error.code === 'EEXIST' ? 'Output exists. Choose another --out path or pass --force.' : error.message;
  console.error(process.argv.includes('--json') ? JSON.stringify({error:message}) : `repoatlas: ${message}`);
  process.exitCode = 1;
});
