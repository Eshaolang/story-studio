import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StorySync} from '../src/sync.mjs';
const story={id:'s',title:'original',description:'',characters:[],blocks:[],updatedAt:1};
function controller(request) {
  const events={stories:[],conflicts:[],sessions:[]};
  const c=new StorySync({session:{room:'r',token:'t',revision:1,role:'editor',ackUpdatedAt:1},request,onStory:s=>events.stories.push(s),onConflict:x=>events.conflicts.push(x),onSession:s=>events.sessions.push(s),onStatus:()=>{}});
  c.update(story);return {c,events};
}
test('edits made while upload runs are retained and uploaded on next tick',async()=>{
  let done;const {c,events}=controller(()=>new Promise(r=>done=r));
  c.update({...story,title:'first',updatedAt:2});const tick=c.tick();
  c.update({...story,title:'second',updatedAt:3});done({story:{...story,title:'first',updatedAt:99},revision:2,role:'editor'});await tick;
  assert.equal(events.stories.length,0);assert.equal(c.story.title,'second');assert.equal(c.session.ackUpdatedAt,2);
});
test('remote update arriving during local edit pauses without acknowledging remote revision',async()=>{
  let done;const {c,events}=controller(()=>new Promise(r=>done=r));const tick=c.tick();
  c.update({...story,title:'local',updatedAt:2});done({story:{...story,title:'remote',updatedAt:3},revision:2,role:'editor'});await tick;
  assert.equal(events.conflicts.length,1);assert.equal(c.session.revision,1);assert.equal(c.story.title,'local');
});
test('stopped session cannot replace another opened story',async()=>{
  let done;const {c,events}=controller(()=>new Promise(r=>done=r));const tick=c.tick();c.stop();done({story,revision:1,role:'editor'});await tick;assert.equal(events.stories.length,0);
});
test('409 pauses future writes until conflict resolved',async()=>{
  let calls=0;const {c,events}=controller(async()=>{calls++;throw Object.assign(Error('conflict'),{status:409,data:{revision:2}});});
  c.update({...story,updatedAt:2});await c.tick();await c.tick();assert.equal(calls,1);assert.equal(events.conflicts.length,1);
});
