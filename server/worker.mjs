import {validateStory} from '../src/model.mjs';

const MAX_BYTES = 16 * 1024 * 1024;
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'}});
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2,'0')).join('');
async function body(request) {
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) throw new Error('请求格式不正确。');
  if (Number(request.headers.get('content-length')) > MAX_BYTES) throw new Error('故事超过云端保存上限（16 MB），请压缩图片后重试。');
  let size = 0;
  const reader = request.body?.getReader(), chunks = [];
  if (!reader) throw new Error('缺少故事内容。');
  while (true) {
    const {value, done} = await reader.read(); if (done) break;
    size += value.length;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('故事超过云端保存上限（16 MB），请压缩图片后重试。'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function roles() {
  const keys = {owner:token(), editor:token(), reader:token()};
  return {keys, hashes:Object.fromEntries(await Promise.all(Object.entries(keys).map(async ([role,key]) => [role, await digest(key)])))};
}

export async function api(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/health') return json({ok:!!env.STORIES});
  if (!env.STORIES) return json({error:'云端共享尚未启用，本地编辑和导出仍可使用。'}, 503);
  if (url.pathname === '/api/rooms' && request.method === 'POST') {
    const input = await body(request), story = validateStory(input.story);
    const room = crypto.randomUUID(), {keys,hashes} = await roles();
    const stored = {story, hashes, revision:1, updatedAt:Date.now()};
    await env.STORIES.put(`rooms/${room}.json`, JSON.stringify(stored));
    return json({room, keys, story, revision:1, role:'owner'}, 201);
  }
  const match = url.pathname.match(/^\/api\/rooms\/([a-f0-9-]{36})(\/invites)?$/);
  if (!match) return json({error:'页面不存在。'}, 404);
  const key = `rooms/${match[1]}.json`, obj = await env.STORIES.get(key);
  if (!obj) return json({error:'共享已关闭，或此邀请不存在。'}, 404);
  const stored = await obj.json();
  const bearer = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[a-f0-9]{64}$/.test(bearer)) return json({error:'请使用有效的邀请链接。'}, 403);
  const hash = await digest(bearer), role = Object.keys(stored.hashes).find(role => stored.hashes[role] === hash);
  if (!role || stored.closed) return json({error:'邀请已失效，请向故事作者索取新链接。'}, 403);
  if (request.method === 'GET' && !match[2]) return json({story:stored.story, revision:stored.revision, role});
  if (match[2] && request.method === 'POST') {
    if (role !== 'owner') return json({error:'只有故事所有者可以管理邀请。'},403);
    const fresh = await roles();
    const result = await env.STORIES.put(key, JSON.stringify({...stored, hashes:{...fresh.hashes, owner:stored.hashes.owner}}), {onlyIf:{etagMatches:obj.etag}});
    if (!result) return json({error:'故事刚刚发生更新，请重试。'},409);
    return json({keys:{editor:fresh.keys.editor,reader:fresh.keys.reader}, revision:stored.revision});
  }
  if (request.method === 'DELETE' && !match[2]) {
    if (role !== 'owner') return json({error:'只有故事所有者可以关闭共享。'},403);
    const result = await env.STORIES.put(key, JSON.stringify({closed:true, hashes:stored.hashes, revision:stored.revision + 1}), {onlyIf:{etagMatches:obj.etag}});
    return result ? json({closed:true}) : json({error:'故事刚刚发生更新，请重试。'},409);
  }
  if (request.method === 'PUT' && !match[2]) {
    if (role === 'reader') return json({error:'这个链接只能阅读，不能修改云端故事。'},403);
    const input = await body(request);
    if (input.revision !== stored.revision) return json({error:'另一位作者已更新故事。', story:stored.story, revision:stored.revision, role},409);
    const story = validateStory(input.story);
    story.id = stored.story.id; story.updatedAt = Date.now();
    const revision = stored.revision + 1;
    const result = await env.STORIES.put(key, JSON.stringify({...stored,story,revision,updatedAt:Date.now()}), {onlyIf:{etagMatches:obj.etag}});
    if (!result) return json({error:'另一位作者同时更新了故事，请保留草稿并重新读取。'},409);
    return json({story,revision,role});
  }
  return json({error:'不支持这个操作。'},405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Story Studio', {status:200});
    const origin = request.headers.get('origin');
    const allowed = !origin || origin === url.origin || origin === 'https://eshaolang.github.io';
    if (!allowed) return json({error:'不允许从此网站调用共享服务。'},403);
    let response;
    try { response = request.method === 'OPTIONS' ? new Response(null,{status:204}) : await api(request,env); }
    catch (error) { response = json({error:error instanceof SyntaxError ? '无法读取故事文件。' : (error.message || '保存失败，请重试。')},400); }
    const headers = new Headers(response.headers);
    if (origin) {
      headers.set('Access-Control-Allow-Origin',origin);
      headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');
      headers.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
      headers.set('Vary','Origin');
    }
    return new Response(response.body,{status:response.status,headers});
  }
};
