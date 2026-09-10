import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/legacy.js'],bundle:true,format:'esm',outfile:'dist/app.js',minify:true,define:{__STORY_CLOUD_ORIGIN__:JSON.stringify(process.env.STORY_CLOUD_ORIGIN || '')}});
await writeFile('dist/app.css',(await readFile('src/legacy.css','utf8'))+'\n'+await readFile('src/tools.css','utf8'));
await writeFile('dist/index.html',`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>故事创作工具</title><link rel="stylesheet" href="./app.css"></head><body><div id="root"></div><script type="module" src="./app.js"></script></body></html>`);
console.log('Built Story Studio into dist/');
