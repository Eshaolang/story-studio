import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import worker from './worker.mjs';

export class FileStore {
  constructor(directory) { this.directory=resolve(directory); this.queue=Promise.resolve(); }
  path(key) { if(!/^rooms\/[a-f0-9-]{36}\.json$/.test(key))throw Error('Invalid storage key');return resolve(this.directory,key); }
  async get(key) {
    try { const text=await readFile(this.path(key),'utf8');return {etag:createHash('sha256').update(text).digest('hex'),json:async()=>JSON.parse(text)}; }
    catch(e){if(e.code==='ENOENT')return null;throw e;}
  }
  put(key,text,options={}) {
    const operation=this.queue.then(async()=>{
      const old=await this.get(key);
      if(options.onlyIf && old?.etag!==options.onlyIf.etagMatches)return null;
      await mkdir(resolve(this.directory,'rooms'),{recursive:true});
      const path=this.path(key),temp=path+'.'+randomUUID()+'.tmp';
      await writeFile(temp,text,{mode:0o600});await rename(temp,path);
      return {etag:createHash('sha256').update(text).digest('hex')};
    });
    this.queue=operation.catch(()=>{});return operation;
  }
}

export function createServer({directory='.local',assets='dist',store=new FileStore(directory)}={}) {
  const root=resolve(assets);
  return http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,`http://${req.headers.host}`);
      let response;
      if(url.pathname.startsWith('/api/')) {
        const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
        response=await worker.fetch(request,{STORIES:store});
      } else {
        const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
        if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
        const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[extname(path)];
        if(!type){res.writeHead(404);res.end();return;}
        response=new Response(await readFile(path),{headers:{'Content-Type':type,'Cache-Control':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
      }
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch(e) {res.writeHead(e.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'});res.end(e.code==='ENOENT'?'页面不存在':'服务暂时不可用');}
  });
}
