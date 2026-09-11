import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shareLink,readLink} from '../src/static-share.mjs';
import {standaloneStory} from '../src/export.mjs';
const story={id:'sample',title:'<script>alert(1)</script>',characters:[],blocks:[{id:'b',type:'narration',text:'第一行\n第二行'}],updatedAt:1};
test('static link roundtrip, project path and escaped content',async()=>{
 const url=new URL(await shareLink(story,'https://eshaolang.github.io/story-studio/'));
 assert.equal(url.pathname,'/story-studio/read.html');assert.equal(url.search,'');
 assert.equal((await readLink(url.hash)).blocks[0].text,story.blocks[0].text);
 assert.ok(!standaloneStory(await readLink(url.hash)).includes('<script>'));
 await assert.rejects(readLink('#read=broken'));
});
test('oversize links reject without truncating story',async()=>{
 const text=Array.from(crypto.getRandomValues(new Uint8Array(20000)),n=>n.toString(16).padStart(2,'0')).join('');
 await assert.rejects(shareLink({...story,blocks:[{id:'b',type:'narration',text}]},'https://studio.test/'),/链接过长/);
});

