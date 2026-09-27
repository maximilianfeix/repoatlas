import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
const examples=JSON.parse(await readFile('docs/examples/manifest.json','utf8'));
let markdown='# Third-party notices\n\nThe example maps contain short source excerpts from these MIT-licensed projects. The following upstream notices apply to those excerpts.\n';
for (const item of examples) {
  const repo=item.url.replace('https://github.com/','');
  const result=JSON.parse(execFileSync('gh',['api',`repos/${repo}/license?ref=${item.commit}`],{encoding:'utf8'}));
  const license=Buffer.from(result.content,'base64').toString('utf8');
  markdown+=`\n## ${repo}\n\nSource: ${item.url}/tree/${item.commit}\n\n\`\`\`text\n${license}\n\`\`\`\n`;
  const file=`docs/examples/${item.name}.html`;
  let html=await readFile(file,'utf8');
  const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  html=html.replace('</footer>',`<details><summary>Example source license: ${repo}</summary><pre>${escape(license)}</pre></details></footer>`);
  await writeFile(file,html);
}
await writeFile('THIRD_PARTY_NOTICES.md',markdown);
