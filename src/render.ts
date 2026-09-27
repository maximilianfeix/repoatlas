import { readFileSync } from 'node:fs';
import type { Atlas } from './types.js';
export function render(atlas: Atlas): string {
  const template = readFileSync(new URL('./template.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('./ui.js', import.meta.url), 'utf8');
  const data = JSON.stringify(atlas).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return template.replace('/*ATLAS_DATA*/', () => data).replace('/*ATLAS_SCRIPT*/', () => script);
}
