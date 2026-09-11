import {imageStory,printStory,download,filename,standaloneStory} from './export.mjs';
import {validateStory,id} from './model.mjs';
import {shareLink} from './static-share.mjs';
export function StudioTools({React:R,story,setState,select,preview}){
 const h=R.createElement,[status,setStatus]=R.useState(''),[busy,setBusy]=R.useState(false),[images,setImages]=R.useState([]),[link,setLink]=R.useState('');
 const lock=R.useRef(false);
 R.useEffect(()=>()=>images.forEach(x=>URL.revokeObjectURL(x.url)),[images]);
 R.useEffect(()=>{setImages([]);setLink('');setStatus('');},[story?.id]);
 const run=async action=>{if(lock.current)return;lock.current=true;setBusy(true);try{await action();}catch(e){setStatus(e.message||'操作失败');}finally{lock.current=false;setBusy(false);}};
 const button=(label,action)=>h('button',{type:'button',className:'button-light',disabled:busy,onClick:()=>run(action)},label);
 return h('aside',{className:'studio-tools','aria-label':'故事导出与只读分享'},h('div',{className:'studio-actions'},
  story&&button('分享只读链接',async()=>{setLink('');setLink(await shareLink(story,location.href));setStatus('阅读链接已生成。持有完整链接的人能阅读此快照。');}),
  story&&button('导出只读网页',()=>{download(new Blob([standaloneStory(validateStory(story))],{type:'text/html;charset=utf-8'}),filename(story)+'.html');setStatus('文件已导出，发给朋友后用浏览器打开即可阅读。');}),
  story&&button('导出图片',async()=>{const result=await imageStory(story,setStatus);setImages(result.map(x=>({...x,url:URL.createObjectURL(x.blob)})));setStatus('图片已生成，请点击下方下载。');}),
  story&&button('导出 PDF',()=>printStory(story)),
  story&&button('备份故事',()=>download(new Blob([JSON.stringify(validateStory(story),null,2)],{type:'application/json'}),filename(story)+'.story.json')),
  h('label',{className:'button-light'},'导入故事',h('input',{type:'file',accept:'.json',disabled:busy,style:{display:'none'},onChange:e=>{const f=e.target.files?.[0];e.target.value='';if(f)run(async()=>{if(f.size>16*1024*1024)throw Error('文件超过 16 MB');const value={...validateStory(JSON.parse(await f.text())),id:id('story')};setState(all=>({...all,stories:[value,...all.stories]}));select(value.id);preview(false);setStatus('故事已导入');});}}))),
  status&&h('p',{role:'status',className:'studio-status'},status),
  link&&h('div',{className:'studio-share'},h('label',null,'完整阅读链接',h('input',{readOnly:true,value:link,onFocus:e=>e.target.select()})),button('复制链接',async()=>{try{await navigator.clipboard.writeText(link);setStatus('阅读链接已复制');}catch{setStatus('请选中上方链接手动复制');}}),h('a',{href:link,target:'_blank',rel:'noopener noreferrer',className:'button-light'},'打开阅读页'),h('p',null,'这是静态快照，发出后无法撤销。修改故事后请重新生成链接。')),
  h('div',{className:'studio-actions'},...images.map(x=>h('a',{key:x.url,href:x.url,download:x.name,className:'button-light'},'下载 '+x.name))));
}

