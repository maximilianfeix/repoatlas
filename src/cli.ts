#!/usr/bin/env node
import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { analyze, githubURL } from './analyze.js';
import { render } from './render.js';

const program = new Command().name('repoatlas').version('0.1.0').description('Understand a TypeScript repo in one interactive map. Every edge has evidence.')
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
program.configureOutput({outputError: (str, write) => write(process.argv.includes('--json') ? JSON.stringify({error:str.trim()})+'\n' : str)});
program.parseAsync().catch((error: Error) => {
  const message = 'code' in error && error.code === 'EEXIST' ? 'Output exists. Choose another --out path or pass --force.' : error.message;
  console.error(process.argv.includes('--json') ? JSON.stringify({error:message}) : `repoatlas: ${message}`);
  process.exitCode = 1;
});
