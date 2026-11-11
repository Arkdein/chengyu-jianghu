import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planRun, makeGrid, gridSize, bossIdioms, score, outcome, priority, MIN_LEARNT } from '../src/lib/run.js';
import { newCard } from '../src/lib/srs.js';

// progress.js imports data.js, which imports JSON via Vite; load the data directly here instead.
const { idioms, chapters } = JSON.parse(fs.readFileSync(new URL('../src/data/idioms.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(idioms.map((i) => [i.id, i]));

function stateWith(ids, today = 100) {
  const cards = {};
  ids.forEach((id) => { cards[id] = newCard(today); });
  return { cards, profile: { strict: 'std' } };
}

test('a student with only chapter 1 gets a playable short run', () => {
  const s = stateWith(chapters[0].ids);
  assert.equal(chapters[0].ids.length, MIN_LEARNT);
  for (let seed = 1; seed <= 20; seed++) {
    const run = planRun(s, 100, idioms, seed, 'short');
    assert.deepEqual(run.layers.map((l) => l.map((n) => n.type).join('|')), ['duel', 'inn|encounter', 'duel', 'boss']);
    const order = run.order.map((id) => byId[id]);
    const used = new Set();
    for (let k = 0; k < 2; k++) {
      const g = makeGrid(order, used, gridSize('short', 'duel', 10), seed + k);
      assert.ok(g.words.length >= 4, `grid has ${g.words.length}`);
      g.words.forEach((w) => { assert.ok(s.cards[w.id], `${w.w} not learnt`); used.add(w.id); });
    }
    assert.equal(bossIdioms(s, order, 2, used).length, 2);
  }
});

test('full runs offer real choices and always reach the boss', () => {
  const s = stateWith(chapters.slice(0, 3).flatMap((c) => c.ids));
  for (let seed = 1; seed <= 30; seed++) {
    for (const menpai of ['H1', 'H2']) {
      const run = planRun(s, 100, idioms, seed, 'full', menpai);
      assert.equal(run.layers.length, 6);
      assert.equal(run.layers.at(-1)[0].type, 'boss');
      for (const layer of run.layers.slice(1, 5)) {
        assert.equal(layer.length, 2);
        assert.notEqual(layer[0].type, layer[1].type);
        assert.ok(layer.some((n) => n.type === 'duel' || n.type === 'elite'));
        if (menpai === 'H1') assert.ok(layer.every((n) => n.type !== 'library'));
      }
    }
  }
  const order = idioms.slice(0, 40);
  const g = makeGrid(order, new Set(), gridSize('full', 'elite', 40), 5);
  assert.ok(g.words.length >= 7, `elite grid has ${g.words.length}`);
});

test('due and weak idioms come first', () => {
  const s = stateWith(idioms.slice(0, 30).map((i) => i.id));
  const weak = idioms[20].id;
  s.cards[weak] = { ...s.cards[weak], bad: 5, due: 90 };
  for (const id of Object.keys(s.cards)) if (id !== weak) s.cards[id] = { ...s.cards[id], due: 120, b: 3 };
  assert.equal(priority(s, 100, idioms, 3)[0].id, weak);
});

test('skills change the score as advertised', () => {
  const base = { charsWritten: 20, perfectChars: 10, idiomsSolved: 8, perfectIdioms: 3, hp: 80, secs: 200, reveals: 0, bossPerfect: 2, strict: 'std' };
  const plain = score(base);
  const all = score(base, { wai1: 1, wai2: 1, wai3: 1 });
  assert.equal(all.raw - plain.raw, 10 * 5 + 3 * 50 + 150);
});

test('score applies the strictness multiplier', () => {
  const base = { charsWritten: 20, idiomsSolved: 8, hp: 80, secs: 200, reveals: 0, bossPerfect: 2 };
  const std = score({ ...base, strict: 'std' });
  assert.equal(std.raw, 200 + 800 + 160 + 200 + 150 + 300);
  assert.equal(std.total, std.raw);
  assert.equal(score({ ...base, strict: 'loose' }).total, Math.round(std.raw * 0.9));
  assert.equal(score({ ...base, strict: 'strict' }).total, Math.round(std.raw * 1.15));
});

test('outcome grades idioms for review', () => {
  assert.equal(outcome({ solved: true, reveals: 0, hints: 0, traces: 0, mistakes: 1 }), 'good');
  assert.equal(outcome({ solved: true, reveals: 0, hints: 1, traces: 0, mistakes: 0 }), 'hint');
  assert.equal(outcome({ solved: true, reveals: 1, hints: 0, traces: 0, mistakes: 0 }), 'again');
  assert.equal(outcome({ solved: false, reveals: 0, hints: 0, traces: 0, mistakes: 0 }), 'again');
});

test('every idiom has the fields the screens need', () => {
  for (const it of idioms) {
    for (const k of ['id', 'w', 'py', 'clue', 'def', 'en', 'ex', 'hint', 'ctx']) assert.ok(it[k], `${it.w} missing ${k}`);
    assert.equal(it.py.split(' ').length, it.w.length, `${it.w} pinyin syllables`);
    for (const ch of it.w) assert.ok(!it.clue.includes(ch), `${it.w} clue leaks ${ch}`);
  }
  assert.equal(Object.keys(byId).length, idioms.length);
});

test('new 外功 skills raise idiom and boss points', () => {
  const st = { charsWritten: 8, perfectChars: 8, idiomsSolved: 2, perfectIdioms: 0, hp: 50, secs: 9999, reveals: 1, bossPerfect: 1, strict: 'std' };
  const base = score(st, {});
  const up = score(st, { wai4: 1, wai6: 1 });
  assert.equal(up.parts.idioms - base.parts.idioms, 40);
  assert.equal(up.parts.boss - base.parts.boss, 75);
});
