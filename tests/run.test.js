import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planRun, score, outcome, priority, MIN_LEARNT } from '../src/lib/run.js';
import { newCard } from '../src/lib/srs.js';

// progress.js imports data.js, which imports JSON via Vite; load the data directly here instead.
const { idioms, chapters } = JSON.parse(fs.readFileSync(new URL('../src/data/idioms.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(idioms.map((i) => [i.id, i]));

function stateWith(ids, today = 100) {
  const cards = {};
  ids.forEach((id) => { cards[id] = newCard(today); });
  return { cards, profile: { strict: 'std' } };
}

test('a student with only chapter 1 gets a full run', () => {
  const s = stateWith(chapters[0].ids);
  assert.equal(chapters[0].ids.length, MIN_LEARNT);
  for (let seed = 1; seed <= 20; seed++) {
    const run = planRun(s, 100, idioms, seed);
    assert.deepEqual(run.nodes.map((n) => n.type), ['duel', 'fork', 'duel', 'boss']);
    for (const n of run.nodes.filter((n) => n.type === 'duel')) {
      assert.ok(n.grid.words.length >= 4, `grid has ${n.grid.words.length}`);
      for (const w of n.grid.words) assert.ok(s.cards[w.id], `${w.w} not learnt`);
    }
    assert.equal(run.nodes[3].ids.length, 2);
  }
});

test('due and weak idioms come first', () => {
  const s = stateWith(idioms.slice(0, 30).map((i) => i.id));
  const weak = idioms[20].id;
  s.cards[weak] = { ...s.cards[weak], bad: 5, due: 90 };
  for (const id of Object.keys(s.cards)) if (id !== weak) s.cards[id] = { ...s.cards[id], due: 120, b: 3 };
  assert.equal(priority(s, 100, idioms, 3)[0].id, weak);
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
