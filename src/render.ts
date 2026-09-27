import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Atlas } from './types.js';
export function render(atlas: Atlas): string {
  const template = readFileSync(new URL('./template.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('./ui.js', import.meta.url), 'utf8');
  const data = JSON.stringify(atlas).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const style = template.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  if (style === undefined) throw new Error('HTML template is missing its inline stylesheet.');
  const hash = (value: string) => `'sha256-${createHash('sha256').update(value).digest('base64')}'`;
  const csp = `default-src 'none'; script-src ${hash(script)}; style-src ${hash(style)}; img-src data:; base-uri 'none'; form-action 'none'; object-src 'none'`;
  return template.replace("default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'", csp)
    .replace('/*ATLAS_DATA*/', () => data).replace('/*ATLAS_SCRIPT*/', () => script);
}
