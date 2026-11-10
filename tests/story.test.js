import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nextScene, markSeen, afterRun, bossFor, storyChapter, seenStory } from '../src/lib/story.js';
import { chaptersForList } from '../src/lib/chapters.js';
import { SKILLS } from '../src/lib/skills.js';
import { newCard } from '../src/lib/srs.js';

const story = JSON.parse(fs.readFileSync(new URL('../src/data/story.json', import.meta.url), 'utf8'));
const { chapters, idioms } = JSON.parse(fs.readFileSync(new URL('../src/data/idioms.json', import.meta.url), 'utf8'));
const fresh = () => ({ cards: {}, runs: [], story: { intro: false, pro: [], beaten: [], hub: {}, queue: [] } });

test('story data is complete', () => {
  assert.equal(story.chapters.length, 8);
  for (const ch of story.chapters) {
    for (const k of ['boss', 'flaw', 'prologue', 'epilogue', 'lesson', 'hub', 'fail', 'taunts', 'defeat']) assert.ok(ch[k], `${ch.boss} missing ${k}`);
    assert.equal(ch.hub.length, 3);
  }
});

test('a student walks through the story by learning, failing and winning', () => {
  const list = chaptersForList(chapters, 'H1');
  let s = fresh();
  let scene = nextScene(s, story, list);
  assert.equal(scene.key, 'intro');
  s = markSeen(s, scene);
  assert.equal(nextScene(s, story, list), null); // nothing until chapter 1 is learnt
  assert.equal(bossFor(s, story, list).kind, 'plain');
  list[0].ids.forEach((id) => { s.cards[id] = newCard(1); });
  scene = nextScene(s, story, list);
  assert.equal(scene.key, 'pro:0');
  s = markSeen(s, scene);
  const boss = bossFor(s, story, list);
  assert.equal(boss.kind, 'story');
  assert.equal(boss.boss, '惰魔·蜷石');
  // a failed run: a fail line and a hub chat, story not advanced
  s = afterRun({ ...s, runs: [{ failed: true }] }, story, { failed: true, boss });
  assert.deepEqual(s.story.queue.map((q) => q.key), ['fail', 'hub']);
  assert.equal(storyChapter(s, story), 0);
  while (nextScene(s, story, list)) s = markSeen(s, nextScene(s, story, list));
  // a win: epilogue with the lesson, chapter beaten
  s = afterRun(s, story, { failed: false, boss });
  assert.equal(s.story.queue[0].key, 'epi');
  assert.equal(s.story.queue[0].lines.at(-1).s, '心得');
  assert.equal(storyChapter(s, story), 1);
  assert.equal(seenStory(s, story).length, 3);
});

test('H2 students get H2 chapters woven in; H1 students never see them', () => {
  const h1 = chaptersForList(chapters, 'H1');
  const h2 = chaptersForList(chapters, 'H2');
  assert.ok(h1.every((c) => c.track !== 'H2'));
  assert.equal(h2.length, chapters.length);
  assert.equal(h2[2].track, 'H2');
  const byId = Object.fromEntries(idioms.map((i) => [i.id, i]));
  for (const c of h2.filter((c) => c.track === 'H2')) for (const id of c.ids) assert.ok(byId[id].wenyan, `${byId[id].w} lacks 原文`);
});

test('skill tree prerequisites exist and names are unique', () => {
  const ids = new Set(SKILLS.map((s) => s.id));
  assert.equal(new Set(SKILLS.map((s) => s.name)).size, SKILLS.length);
  for (const s of SKILLS) if (s.req) assert.ok(ids.has(s.req));
});
