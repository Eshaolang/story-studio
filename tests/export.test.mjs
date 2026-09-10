import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storyHTML} from '../src/export.mjs';
import {validateStory} from '../src/model.mjs';
test('exports escape user text and include complete dialogue groups beyond the editor page',()=>{
  const story=validateStory({id:'s',title:'<script>alert(1)</script>',characters:[{id:'c',name:'<b>角色</b>'}],blocks:[...Array.from({length:90},(_,i)=>({id:'b'+i,type:'narration',text:'段落'+i})),{id:'group',type:'dialogueGroup',dialogues:[{id:'d1',characterId:'c',text:'第一行\n第二行'},{id:'d2',characterId:'c',text:'最后一句'}]}]});
  const html=storyHTML(story);assert.ok(html.includes('段落89'));assert.ok(html.includes('最后一句'));assert.ok(html.includes('第一行\n第二行'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<b>'));
});
test('import rejects remote and executable image URLs',()=>{
  for(const image of ['https://example.com/track.png','javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=']) {
    assert.throws(()=>validateStory({characters:[],blocks:[{id:'b',type:'image',image}]}),/图片/);
  }
});
