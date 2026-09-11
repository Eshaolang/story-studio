import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/reader.mjs'],bundle:true,format:'esm',outfile:'dist/reader.js',minify:true});
await writeFile('dist/read.html','<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>故事阅读</title><style>body{margin:0;background:#eee7dc;font-family:sans-serif}p{margin:0;padding:12px 20px;font-size:14px}iframe{display:block;width:100%;height:calc(100dvh - 60px);border:0}iframe[hidden]{display:none}</style></head><body><p role="status">正在读取故事…</p><iframe hidden sandbox title="只读故事"></iframe><script type="module" src="./reader.js"></script></body></html>');
await build({entryPoints:['src/legacy.js'],bundle:true,format:'esm',outfile:'dist/app.js',minify:true,define:{__STORY_CLOUD_ORIGIN__:JSON.stringify(process.env.STORY_CLOUD_ORIGIN || '')}});
await writeFile('dist/app.css',(await readFile('src/legacy.css','utf8'))+'\n'+await readFile('src/tools.css','utf8'));
await writeFile('dist/index.html',`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>故事创作工具</title><link rel="stylesheet" href="./app.css"></head><body><div id="root"></div><script type="module" src="./app.js"></script></body></html>`);
console.log('Built Story Studio into dist/');

