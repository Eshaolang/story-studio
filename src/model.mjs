export const BLOCKS_PER_PAGE = 80;
export const STORIES_PER_PAGE = 36;
export const id = (prefix = 'item') => `${prefix}-${crypto.randomUUID()}`;

// Preserve every code point, including spaces and paragraph separators.
export function splitNarration(text, target = 240) {
  target = Math.max(40, Math.min(2000, Number(target) || 240));
  const points = Array.from(text);
  const parts = [];
  while (points.length > target) {
    let cut = -1;
    for (let i = target - 1; i >= Math.floor(target * .4); i--) {
      if (/[\n。！？!?；;]/u.test(points[i])) { cut = i + 1; break; }
    }
    if (cut < 0) {
      for (let i = target - 1; i >= Math.floor(target * .4); i--) {
        if (/[\s，,、]/u.test(points[i])) { cut = i + 1; break; }
      }
    }
    cut = cut < 0 ? target : cut;
    while (cut < points.length && /[”’」』）]/u.test(points[cut])) cut++;
    parts.push(points.splice(0, cut).join(''));
  }
  if (points.length) parts.push(points.join(''));
  return parts.length ? parts : [''];
}

export function splitBlock(story, blockId, parts) {
  return {...story, blocks: story.blocks.flatMap(b => b.id === blockId
    ? parts.map((text, i) => ({...b, id: i ? id('block') : b.id, text})) : [b])};
}

export function validateStory(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.blocks) || !Array.isArray(value.characters)) throw new Error('故事文件格式不正确。');
  const str = (v, max = 1000000) => {
    if (v === undefined || v === null) return '';
    if (typeof v !== 'string' || v.length > max) throw new Error('故事中的文字格式或长度不正确。');
    return v;
  };
  const asset = v => {
    v = str(v, 12000000);
    if (v && !/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=\r\n]+$/.test(v)) throw new Error('图片须为 PNG、JPEG、WebP 或 GIF。');
    return v || undefined;
  };
  if (value.blocks.length > 10000 || value.characters.length > 1000) throw new Error('故事包含的段落或角色过多。');
  const unique = items => { if (new Set(items.map(b => b.id)).size !== items.length) throw new Error('故事包含重复编号。'); return items; };
  const characters = unique(value.characters.map(c => ({id: str(c.id, 200) || id('character'), name: str(c.name, 500), avatar: asset(c.avatar)})));
  const blocks = unique(value.blocks.map(b => {
    if (!['narration', 'dialogue', 'dialogueGroup', 'image'].includes(b.type)) throw new Error('不支持的段落类型。');
    const out = {id: str(b.id, 200) || id('block'), type: b.type, text: str(b.text)};
    if (b.characterId) out.characterId = str(b.characterId, 200);
    if (b.type === 'image') { out.image = asset(b.image); out.caption = str(b.caption); }
    if (b.type === 'dialogueGroup') {
      if (!Array.isArray(b.dialogues) || b.dialogues.length > 10000) throw new Error('对白组格式不正确。');
      out.dialogues = unique(b.dialogues.map(d => ({id: str(d.id, 200) || id('dialogue'), text: str(d.text), characterId: str(d.characterId, 200) || undefined})));
    }
    return out;
  }));
  return {id: str(value.id, 200) || id('story'), title: str(value.title, 1000), description: str(value.description, 100000), characters, blocks, updatedAt: Number(value.updatedAt) || Date.now()};
}

export function plainStory(story) { return validateStory(story); }
export function storyEqual(a, b) {
  if (!a || !b) return a === b;
  return JSON.stringify({...plainStory(a), updatedAt: 0}) === JSON.stringify({...plainStory(b), updatedAt: 0});
}

export function inviteFromHash(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const room = p.get('room'), token = p.get('key');
  return /^[a-f0-9-]{36}$/.test(room || '') && /^[a-f0-9]{64}$/.test(token || '') ? {room, token} : null;
}
