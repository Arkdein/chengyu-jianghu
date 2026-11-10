// 蚀字之劫 — story progression. Pure functions; the story data is passed in so tests can load it directly.
//
// Story chapter c = the first chapter whose 心魔 has not been beaten. Its boss appears in runs once the
// student has learnt the matching 藏经阁 chapter (80%). Winning a run against it beats the chapter.
// Losing never blocks the story: every return to the 书院 plays a short scene, so even a student who keeps
// failing keeps hearing from the characters.
import { chapterDone } from './chapters.js';

export const storyChapter = (state, story) => {
  for (let c = 0; c < story.chapters.length; c++) if (!state.story.beaten.includes(c)) return c;
  return story.chapters.length; // all eight beaten: post-game
};

/** Who waits at the end of this run. */
export function bossFor(state, story, list) {
  const c = storyChapter(state, story);
  if (c >= story.chapters.length) return { kind: 'post', c, ...story.postgame };
  if (list[c] && chapterDone(state, list[c])) return { kind: 'story', c, ...story.chapters[c] };
  return { kind: 'plain', c, boss: '心魔', title: '心中杂念', taunts: ['写不出来了吧？'], defeat: '……你赢了这一回。' };
}

export const fill = (text, name) => text.replaceAll('{name}', name || '少侠');

/** "墨老：……" → { s, t } */
export function parseLine(str) {
  const i = str.indexOf('：');
  return i > 0 ? { s: str.slice(0, i), t: str.slice(i + 1) } : { s: '旁白', t: str };
}

/**
 * What the 书院 should play now, in order. Returns { key, title, lines } or null.
 * key tells markSeen() what to record once the student has read it.
 */
export function nextScene(state, story, list) {
  const st = state.story;
  if (!st.intro) return { key: 'intro', title: '序章 · 蚀字之劫', lines: story.intro };
  if (st.queue.length) return st.queue[0];
  const c = storyChapter(state, story);
  if (c < story.chapters.length && !st.pro.includes(c) && list[c] && chapterDone(state, list[c])) {
    const ch = story.chapters[c];
    return { key: `pro:${c}`, title: `第${c + 1}回 · ${ch.boss}`, lines: ch.prologue };
  }
  return null;
}

export function markSeen(state, scene) {
  const st = { ...state.story };
  if (scene.key === 'intro') st.intro = true;
  else if (scene.key.startsWith('pro:')) st.pro = [...st.pro, Number(scene.key.slice(4))];
  else st.queue = st.queue.slice(1);
  return { ...state, story: st };
}

/**
 * After a run: queue a reaction (fail line, or the chapter's epilogue and lesson if its 心魔 just fell),
 * then the next hub conversation for the current chapter.
 */
export function afterRun(state, story, { failed, boss }) {
  const st = { ...state.story, queue: [...state.story.queue], beaten: [...state.story.beaten], hub: { ...state.story.hub } };
  const c = boss.c;
  const chapter = c < story.chapters.length ? story.chapters[c] : story.postgame;
  if (failed) {
    const lines = chapter.fail;
    const n = state.runs.filter((r) => r.failed).length;
    st.queue.push({ key: 'fail', title: '回到书院', lines: [parseLine(lines[n % lines.length])] });
  } else if (boss.kind === 'story' && !st.beaten.includes(c)) {
    st.beaten.push(c);
    st.queue.push({ key: 'epi', title: `${boss.boss}已破`, lines: [...chapter.epilogue, { s: '心得', t: chapter.lesson }] });
  }
  const hubChapter = Math.min(storyChapter({ story: st }, story), story.chapters.length);
  const pool = hubChapter < story.chapters.length ? story.chapters[hubChapter].hub : story.postgame.hub;
  const i = st.hub[hubChapter] || 0;
  if (i < pool.length) {
    st.queue.push({ key: 'hub', title: '书院闲谈', lines: pool[i] });
    st.hub[hubChapter] = i + 1;
  }
  st.queue = st.queue.slice(-4);
  return { ...state, story: st };
}

/** Everything the student has unlocked, for the 剧情回顾 page. */
export function seenStory(state, story) {
  const out = [];
  if (state.story.intro) out.push({ title: '序章 · 蚀字之劫', lines: story.intro });
  story.chapters.forEach((ch, c) => {
    if (state.story.pro.includes(c)) out.push({ title: `第${c + 1}回 · ${ch.boss}`, lines: ch.prologue });
    if (state.story.beaten.includes(c)) out.push({ title: `第${c + 1}回 · ${ch.boss}已破`, lines: [...ch.epilogue, { s: '心得', t: ch.lesson }] });
  });
  return out;
}
