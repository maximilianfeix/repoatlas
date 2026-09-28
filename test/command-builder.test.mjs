import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCommand, parseRepository } from '../docs/command-builder.js';

test('repository input accepts canonical GitHub URLs, short names, and .git URLs', () => {
  assert.deepEqual(parseRepository('https://github.com/pmndrs/zustand'), { owner: 'pmndrs', name: 'zustand' });
  assert.deepEqual(parseRepository('honojs/hono'), { owner: 'honojs', name: 'hono' });
  assert.deepEqual(parseRepository('github.com/sindresorhus/ky.git/'), { owner: 'sindresorhus', name: 'ky' });
});

test('command output only contains validated owner and repository names', () => {
  assert.equal(createCommand('https://github.com/honojs/hono'), "npx --yes --package=github:maximilianfeix/repoatlas#v2.33.0 -- repoatlas-cli 'https://github.com/honojs/hono' -o 'hono-architecture.html'");
});

test('repository input rejects non-GitHub hosts, credentials, extra paths, and shell syntax', () => {
  for (const value of [
    'https://github.com.attacker/alice/repo',
    'https://alice@github.com/alice/repo',
    'https://github.com/alice/repo/tree/main',
    'https://github.com/alice/repo?download=1',
    'alice/repo; touch pwned',
    '--help/repo',
  ]) assert.throws(() => createCommand(value));
});

test('homepage makes browser analysis the URL form action and keeps CLI generation secondary', async () => {
  const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
  assert.match(html, /<form id="repo-command-form">[\s\S]*?<button id="browser-analyze" class="button primary" type="submit">Build interactive map/);
  assert.match(html, /id="build-cli-command" class="button" type="button">Need a CLI command instead\?/);
  assert.match(html, /id="command-preview"[^>]*hidden/);
  assert.doesNotMatch(html, /id="browser-analyze"[^>]*type="button"/);
});

test('landing motion is progressive, scroll-triggered, and disabled for reduced-motion preferences', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('../docs/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../docs/command-builder.js', import.meta.url), 'utf8'),
  ]);
  assert.match(script, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(script, /'IntersectionObserver' in window/);
  assert.match(script, /observer\.unobserve\(entry\.target\)/);
  assert.match(html, /html\.motion-ready \.showcase\.is-visible/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)[\s\S]*?html\.motion-ready \.showcase:not\(\.is-visible\)[\s\S]*?opacity:1/);
});

test('the landing-page star action and live README stars badge link to the project', async () => {
  const [html, readme] = await Promise.all([
    readFile(new URL('../docs/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /href="https:\/\/github\.com\/maximilianfeix\/repoatlas" aria-label="Star RepoAtlas on GitHub">Star on GitHub/);
  assert.match(html, /\.github-link::before\{content:"★"/);
  assert.match(readme, /href="https:\/\/github\.com\/maximilianfeix\/repoatlas\/stargazers"><img alt="GitHub stars" src="https:\/\/img\.shields\.io\/github\/stars\/maximilianfeix\/repoatlas/);
});

test('hero and README lead with mapping the visitor\'s repository before the sample map', async () => {
  const [html, readme] = await Promise.all([
    readFile(new URL('../docs/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /<a class="button primary" href="#make-a-map">Map your repository ↓<\/a><a class="button" href="examples\/hono\.html">Explore the Hono map/);
  assert.ok(readme.indexOf('PASTE%20A%20REPO') < readme.indexOf('OPEN%20LIVE%20MAP'));
});
