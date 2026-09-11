import {readLink} from './static-share.mjs';
import {standaloneStory} from './export.mjs';
const frame=document.querySelector('iframe'),status=document.querySelector('[role=status]');
try{const story=await readLink(location.hash);document.title=story.title||'故事阅读';frame.srcdoc=standaloneStory(story);frame.hidden=false;status.textContent='只读故事快照 · 不会随作者后续修改自动更新';}
catch(e){status.textContent=e.message;}

