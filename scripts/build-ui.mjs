import { build } from 'esbuild';
import { copyFile, chmod } from 'node:fs/promises';
await build({entryPoints:['src/ui.ts'],bundle:true,minify:true,format:'iife',outfile:'dist/ui.js',target:'es2022'});
await copyFile('src/template.html','dist/template.html');
await chmod('dist/cli.js',0o755);
