import {imageStory, printStory, download, filename} from './export.mjs';
import {validateStory, inviteFromHash, id} from './model.mjs';
import {requestRoom, rememberRoom, savedRooms, inviteURL} from './cloud.mjs';
import {StorySync} from './sync.mjs';

export function StudioTools({React:R, story, setState, select, preview}) {
  const h = R.createElement;
  const [rooms,setRooms] = R.useState(savedRooms), [status,setStatus] = R.useState(''), [busy,setBusy] = R.useState(false);
  const [conflict,setConflict] = R.useState(null), [images,setImages] = R.useState([]), [showShare,setShowShare] = R.useState(false), [pendingInvite,setPendingInvite] = R.useState(null);
  const sync = R.useRef(null), latest = R.useRef(story), actionLock = R.useRef(false);
  latest.current = story;
  R.useEffect(() => { const warn=e=>setStatus(e.detail);window.addEventListener('studio-storage',warn);return()=>window.removeEventListener('studio-storage',warn); },[]);
  const session = story && rooms[story.id];
  const saveSession = (storyId, value) => { rememberRoom(storyId,value); setRooms(all => ({...all,[storyId]:value})); };
  const replace = value => setState(all => ({...all,stories:all.stories.map(s => s.id === value.id ? value : s)}));
  const add = value => { setState(all => ({...all,stories:[value,...all.stories]})); select(value.id); };
  const run = async action => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true);
    try { await action(); } catch(e) { setStatus(e.message || '操作失败，请重试'); }
    finally { actionLock.current = false; setBusy(false); }
  };
  R.useEffect(() => {
    let alive = true;
    const join = async () => {
      const invitation = inviteFromHash(location.hash);
      if (!invitation) return;
      try {
        setStatus('正在打开邀请…');
        const result = await requestRoom(`/api/rooms/${invitation.room}`,{token:invitation.token});
        if (!alive) return;
        setPendingInvite({invitation,result});
        setStatus('邀请已验证，请确认后打开故事');
      } catch(e) { if (alive) setStatus(e.message); }
    };
    join(); window.addEventListener('hashchange',join);
    return () => { alive = false; window.removeEventListener('hashchange',join); };
  },[]);
  R.useEffect(() => {
    setConflict(null);
    if (!session || !story) { sync.current = null; return; }
    const storyId = story.id;
    const controller = new StorySync({session,request:requestRoom,onStory:replace,
      onSession:s => saveSession(storyId,s),onStatus:setStatus,onConflict:setConflict});
    sync.current = controller; controller.update(story); controller.tick();
    const timer = setInterval(() => controller.tick(),4000);
    return () => { clearInterval(timer); controller.stop(); };
  },[story?.id,session?.room,session?.token]);
  R.useEffect(() => { setShowShare(false); setImages([]); },[story?.id]);
  R.useEffect(() => { sync.current?.update(story); },[story]);
  R.useEffect(() => () => images.forEach(x => URL.revokeObjectURL(x.url)),[images]);

  const button = (label,action,disabled=false) => h('button',{type:'button',className:'button-light',disabled:busy || disabled,onClick:()=>run(action)},label);
  const preserveAndLoad = async () => {
    const local = latest.current;
    const result = await requestRoom(`/api/rooms/${session.room}`,{token:session.token});
    const draft = {...local,id:id('story'),title:`${local.title || '未命名故事'}（冲突前本地副本）`};
    const remote = {...validateStory(result.story),id:local.id};
    setState(all => ({...all,stories:[draft,...all.stories.map(s => s.id === local.id ? remote : s)]}));
    const fresh = {...session,revision:result.revision,role:result.role,ackUpdatedAt:remote.updatedAt};
    saveSession(local.id,fresh);
    const controller = sync.current;
    controller.session = fresh; controller.update(remote); controller.conflict = false;
    setConflict(null); setStatus('已保存本地副本，并载入共享版本');
  };
  const backup = () => download(new Blob([JSON.stringify(validateStory(story),null,2)],{type:'application/json'}),`${filename(story)}.story.json`);
  const acceptInvite = () => {
    if (!pendingInvite) return;
    const {invitation,result} = pendingInvite;
    const value = {...validateStory(result.story),id:id('story')};
    saveSession(value.id,{...invitation,revision:result.revision,role:result.role,ackUpdatedAt:value.updatedAt});
    add(value); preview(result.role === 'reader');
    history.replaceState(null,'',location.pathname + location.search);
    setPendingInvite(null); setStatus(result.role === 'reader' ? '已进入只读共享；本地副本可另存' : '已加入共享故事');
  };
  const declineInvite = () => { setPendingInvite(null); history.replaceState(null,'',location.pathname + location.search); setStatus('已取消打开邀请'); };
  const links = session?.keys;
  return h('aside',{className:'studio-tools','aria-label':'故事导出与共享'},
    pendingInvite && h('div',{className:'studio-invite',role:'dialog','aria-labelledby':'studio-invite-title'},
      h('div',{className:'studio-invite-mark'},'STORY STUDIO'),
      h('h2',{id:'studio-invite-title'},'你收到一个故事邀请'),
      h('p',{className:'studio-invite-title'},pendingInvite.result.story.title || '未命名故事'),
      h('p',null,`权限：${pendingInvite.result.role === 'reader' ? '只读' : '可编辑'}`),
      h('p',{className:'studio-invite-note'},'这是故事创作工具的私密邀请。接受后会在当前浏览器创建一个本地副本；故事作者不会因此获得你的其他文件或浏览器资料。请只接受你认识的人发来的链接。'),
      h('div',{className:'studio-actions'},h('button',{type:'button',className:'button-dark',onClick:acceptInvite},'接受邀请并打开'),h('button',{type:'button',className:'button-light',onClick:declineInvite},'取消'))
    ),
    h('div',{className:'studio-actions'},
      story && button('导出图片',async()=>{const result = await imageStory(story,setStatus); setImages(result.map(x=>({...x,url:URL.createObjectURL(x.blob)}))); setStatus('图片已生成，请点击下方下载');}),
      story && button('导出 PDF',()=>printStory(story)),
      story && button('备份故事',backup),
      h('label',{className:'button-light'},'导入故事',h('input',{type:'file',accept:'.json',disabled:busy,style:{display:'none'},onChange:e=>{const f=e.target.files?.[0];e.target.value='';if(f)run(async()=>{if(f.size>16*1024*1024)throw Error('文件超过 16 MB，请压缩图片后重试');const value={...validateStory(JSON.parse(await f.text())),id:id('story')};add(value);preview(false);setStatus('故事已导入');});}})),
      story && button(session ? '共享设置' : '邀请共享',async()=>{
        if(session) {setShowShare(!showShare);return;}
        const result=await requestRoom('/api/rooms',{method:'POST',data:{story}});
        saveSession(story.id,{room:result.room,token:result.keys.owner,keys:result.keys,role:'owner',revision:result.revision,ackUpdatedAt:story.updatedAt});
        setShowShare(true);setStatus('共享已开启');
      }),
      session && button('立即同步',()=>sync.current?.tick(),!!conflict)
    ),
    status && h('p',{role:'status',className:'studio-status'},status),
    h('div',{className:'studio-actions'},...images.map(x=>h('a',{key:x.url,className:'button-light',href:x.url,download:x.name},`下载 ${x.name}`))),
    conflict && h('div',{role:'alert',className:'studio-conflict'},h('p',null,'共享故事已有其他修改。你的内容仍保留在本地，请先保留副本再继续。'),button('保留本地副本并载入共享版本',preserveAndLoad),button('下载本地备份',backup)),
    showShare && session && h('div',{className:'studio-share'},
      h('p',null,session.role==='owner' ? '持有编辑链接的人可以修改故事；只读链接只能查看。请只发给信任的朋友，转发链接也会转交访问权限。' : `当前权限：${session.role==='reader'?'只读':'编辑'}`),
      ...['editor','reader'].filter(role=>links?.[role]).map(role=>h('label',{key:role},role==='editor'?'编辑邀请':'只读邀请',h('input',{readOnly:true,value:inviteURL(session.room,links[role]),onFocus:e=>e.target.select()}),button('复制链接',async()=>{await navigator.clipboard.writeText(inviteURL(session.room,links[role]));setStatus('链接已复制');}))),
      session.role==='owner' && button('更换邀请链接',async()=>{const r=await requestRoom(`/api/rooms/${session.room}/invites`,{method:'POST',token:session.token});const fresh={...session,keys:r.keys};saveSession(story.id,fresh);sync.current.session.keys=r.keys;setStatus('旧邀请已失效，新链接已生成');}),
      session.role==='owner' && button('关闭共享',async()=>{if(!confirm('关闭后，所有邀请链接将失效。本地故事会保留。'))return;await requestRoom(`/api/rooms/${session.room}`,{method:'DELETE',token:session.token});sync.current?.stop();saveSession(story.id,null);setShowShare(false);setStatus('共享已关闭，本地故事已保留');})
    )
  );
}
