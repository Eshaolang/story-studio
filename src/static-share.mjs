import {validateStory} from './model.mjs';
const MAX=16000;
export async function shareLink(story,base){
 const raw=new TextEncoder().encode(JSON.stringify(validateStory(story)));
 if(raw.length>16*1024*1024)throw Error('故事超过 16 MB。');
 const data=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 let binary='';for(const b of data)binary+=String.fromCharCode(b);
 const url=new URL('read.html',base);url.hash='read='+btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 if(url.href.length>MAX)throw Error('阅读链接过长，请改用“导出只读网页”，把文件发给朋友，或导出图片 / PDF。');
 return url.href;
}
export async function readLink(hash){
 const value=new URLSearchParams(hash.replace(/^#/,'')).get('read');
 if(!value||value.length>MAX||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('阅读链接不完整，请向作者索取新链接。');
 try{
  const raw=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
  const reader=new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16*1024*1024){await reader.cancel();throw Error();}chunks.push(value);}
  return validateStory(JSON.parse(await new Blob(chunks).text()));
 }catch{throw Error('无法读取故事，链接可能被截断或内容不受支持。');}
}

