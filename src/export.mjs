import {toCanvas} from 'html-to-image';

export function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const filename = story => (story.title || '未命名故事').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 120);
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const css = `*{box-sizing:border-box}body{margin:0;background:#eee7dc;color:#231d1b;font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif}.story-document{width:900px;max-width:100%;margin:auto;padding:42px;background:#f8f3eb}h1{font-size:34px;line-height:1.45;margin:0 0 22px;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.story-piece{margin:0 0 22px;break-inside:avoid}.narration{font-size:20px;line-height:1.85;text-align:center;padding:22px 26px;border:1px solid #d8c2a8;background:#f4ecdf}.dialogue{display:flex;align-items:flex-start;gap:16px}.avatar{width:76px;height:76px;flex:0 0 76px;object-fit:cover;background:#342723;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px}.speech{flex:1;min-width:0;padding:16px 22px;background:#fdfcfa;border:1px solid #d8c2a8}.speaker{display:block;font-size:13px;color:#6d4c36;font-weight:bold;margin-bottom:8px}.speech p{font-size:20px;line-height:1.8}figure{margin:0}figure img{display:block;max-width:100%;max-height:620px;margin:auto;object-fit:contain}figcaption{white-space:pre-wrap;overflow-wrap:anywhere;text-align:center;margin-top:10px;font-size:14px;line-height:1.7}.print-controls{max-width:900px;margin:20px auto;padding:16px;font-size:14px}.print-controls button{padding:10px 20px;margin-right:10px;cursor:pointer}@page{size:A4;margin:16mm}@media print{body{background:#fff}.print-controls{display:none!important}.story-document{width:auto;max-width:none;padding:0;background:#fff}h1{font-size:24pt}.narration,.speech p{font-size:12pt}.narration{padding:12px 18px}.story-piece{break-inside:avoid}.story-piece.tall{break-inside:auto}.avatar{width:52px;height:52px;flex-basis:52px}figure img{max-height:235mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;

export function standaloneStory(story) {
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${esc(story.title||'故事')}</title><style>${css}</style></head><body>${storyHTML(story)}</body></html>`;
}
export function storyHTML(story) {
  const dialogue = line => {
    const c = story.characters.find(c => c.id === line.characterId);
    return `<article class="story-piece dialogue"><div class="avatar">${c?.avatar ? `<img class="avatar" src="${esc(c.avatar)}" alt="">` : esc((c?.name || '?').slice(0, 2))}</div><div class="speech"><span class="speaker">${esc(c?.name || '未指定角色')}</span><p>${esc(line.text)}</p></div></article>`;
  };
  return `<main class="story-document"><h1>${esc(story.title || '未命名故事')}</h1>${story.blocks.map(b => b.type === 'narration'
    ? `<article class="story-piece narration"><p>${esc(b.text)}</p></article>`
    : b.type === 'dialogue' ? dialogue(b)
    : b.type === 'dialogueGroup' ? (b.dialogues || []).map(dialogue).join('')
    : `<figure class="story-piece">${b.image ? `<img src="${esc(b.image)}" alt="${esc(b.caption)}">` : ''}${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`).join('')}</main>`;
}

export function printStory(story) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('浏览器拦截了导出窗口，请允许弹出窗口后重试。');
  win.opener = null;
  win.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>${esc(story.title || '故事正文')}</title><style>${css}</style></head><body><div class="print-controls"><button id="print">打印 / 保存为 PDF</button>在打印目标中选择“另存为 PDF”，关闭页眉和页脚即可。这里只导出标题和全部正文。</div>${storyHTML(story)}</body></html>`);
  win.document.close();
  const prepare = async () => {
    await Promise.all([...win.document.images].map(img => img.decode().catch(() => {})));
    await win.document.fonts.ready;
    win.document.querySelectorAll('.story-piece').forEach(e => { if (e.getBoundingClientRect().height > 850) e.classList.add('tall'); });
  };
  win.document.getElementById('print').onclick = async () => { await prepare(); win.print(); };
  prepare().then(() => { if (!win.closed) win.print(); });
}

export async function imageStory(story, onProgress = () => {}) {
  // An isolated document keeps the editor and its sticky controls out of the image.
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:940px;height:1000px;border:0';
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open(); doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${storyHTML(story)}</body></html>`); doc.close();
  try {
    await doc.fonts.ready;
    await Promise.all([...doc.images].map(img => img.decode()));
    const root = doc.querySelector('.story-document');
    const height = Math.ceil(root.getBoundingClientRect().height), width = 900;
    // Use bounded tiles; no canvas ever exceeds the reliable 16k dimension.
    const tileHeight = 12000, count = Math.ceil(height / tileHeight), results = [];
    for (let part = 0; part < count; part++) {
      onProgress(`正在生成长图 ${part + 1} / ${count}…`);
      const viewport = doc.createElement('div');
      viewport.style.cssText = `position:relative;width:${width}px;height:${Math.min(tileHeight, height - part * tileHeight)}px;overflow:hidden;background:#f8f3eb`;
      const clone = root.cloneNode(true);
      clone.style.cssText += `;position:absolute;left:0;top:${-part * tileHeight}px;width:900px;max-width:none;margin:0`;
      viewport.append(clone); doc.body.append(viewport);
      const canvas = await toCanvas(viewport, {pixelRatio: 1, width, height: Math.min(tileHeight, height - part * tileHeight), backgroundColor:'#f8f3eb', skipFonts:true});
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('长图生成失败，请改用 PDF 导出或减少图片尺寸。');
      results.push({blob, name:`${filename(story)}${count > 1 ? `-${String(part + 1).padStart(2,'0')}` : ''}.png`});
      viewport.remove(); canvas.width = 1; canvas.height = 1;
    }
    return results;
  } finally { frame.remove(); }
}

