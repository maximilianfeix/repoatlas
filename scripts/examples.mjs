import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const examples=[['hono','https://github.com/honojs/hono'],['zustand','https://github.com/pmndrs/zustand'],['ky','https://github.com/sindresorhus/ky']];
const manifest=[];
for(const [name,url] of examples){
  execFileSync(process.execPath,['dist/cli.js',url,'-o',`docs/examples/${name}.html`,'--force'],{stdio:'inherit'});
  const {readFile}=await import('node:fs/promises');
  const html=await readFile(`docs/examples/${name}.html`,'utf8');
  const data=JSON.parse(html.match(/<script id="atlas-data" type="application\/json">(.*?)<\/script>/s)[1]);
  manifest.push({name,url,commit:data.commit,modules:data.modules.length,connections:data.edges.filter(e=>e.resolution==='internal').length,warnings:data.warnings});
}
await writeFile('docs/examples/manifest.json',JSON.stringify(manifest,null,2)+'\n');
// Keep upstream license notices inside the shareable artifacts as well.
await import('./notices.mjs');
