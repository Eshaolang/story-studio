import {storyEqual} from './model.mjs';

// One request at a time; revisions prevent silent replacement of remote work.
export class StorySync {
  constructor({session, request, onStory, onSession, onStatus, onConflict}) {
    Object.assign(this, {session, request, onStory, onSession, onStatus, onConflict});
    this.stopped = false; this.busy = false; this.conflict = false;
  }
  update(story) { this.story = story; }
  stop() { this.stopped = true; }
  async tick() {
    if (this.busy || this.stopped || this.conflict || !this.story) return;
    this.busy = true;
    const snapshot = this.story, s = this.session;
    const dirty = snapshot.updatedAt !== s.ackUpdatedAt;
    try {
      this.onStatus(dirty && s.role !== 'reader' ? '正在同步…' : '正在检查更新…');
      const result = await this.request(`/api/rooms/${s.room}`, {
        token:s.token, ...(dirty && s.role !== 'reader' ? {method:'PUT', data:{story:snapshot,revision:s.revision}} : {})
      });
      if (this.stopped) return;
      const unchanged = storyEqual(this.story, snapshot);
      if (!unchanged && !dirty && result.revision !== s.revision) {
        this.conflict = true; this.onConflict(result); this.onStatus('发现同时修改，已暂停同步'); return;
      }
      if (dirty && s.role === 'reader' && !storyEqual(snapshot, result.story)) {
        this.conflict = true; this.onConflict(result); return;
      }
      if (unchanged) { this.story = {...result.story,id:snapshot.id}; this.onStory(this.story); }
      this.session = {...s,revision:result.revision,role:result.role,ackUpdatedAt:unchanged ? result.story.updatedAt : snapshot.updatedAt};
      this.onSession(this.session); this.onStatus(unchanged ? '已同步' : '本地修改等待同步');
    } catch (error) {
      if (this.stopped) return;
      if (error.status === 409) { this.conflict = true; this.onConflict(error.data || {}); this.onStatus('发现同时修改，已暂停同步'); }
      else { this.onStatus(error.message || '暂时无法连接，修改仍保留在本机'); }
    } finally { this.busy = false; }
  }
}
