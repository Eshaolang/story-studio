export const CLOUD_ORIGIN = typeof __STORY_CLOUD_ORIGIN__ === 'undefined' ? '' : __STORY_CLOUD_ORIGIN__;
const STORAGE_KEY = 'story-studio-invitations-v2';
export function savedRooms() {
  try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');return value && typeof value==='object' && !Array.isArray(value)?value:{}; } catch { return {}; }
}
export function rememberRoom(storyId, room) {
  const all = savedRooms();
  if (room) all[storyId] = room; else delete all[storyId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
export async function requestRoom(path, {method='GET', token, data, signal}={}) {
  const response = await fetch(`${CLOUD_ORIGIN}${path}`, {method, signal:signal || AbortSignal.timeout(15000), cache:'no-store', headers:{...(token ? {'Authorization':`Bearer ${token}`} : {}), ...(data ? {'Content-Type':'application/json'} : {})}, body:data ? JSON.stringify(data) : undefined});
  let result;
  try { result = await response.json(); } catch { throw new Error(response.status===404 && !CLOUD_ORIGIN ? '当前页面尚未连接共享服务；本地编辑、图片和 PDF 导出仍可使用。' : '共享服务暂时不可用，请稍后重试；你的修改仍保留在本地。'); }
  if (!response.ok) { const err = new Error(result.error || '同步失败，请重试。'); err.status = response.status; err.data = result; throw err; }
  return result;
}
export const inviteURL = (room, key) => `${location.origin}${location.pathname}#room=${room}&key=${key}`;
