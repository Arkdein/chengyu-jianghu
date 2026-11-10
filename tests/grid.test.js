import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildGrid, MAX_COLS, MAX_ROWS } from '../src/lib/grid.js';

const { idioms, chapters } = JSON.parse(fs.readFileSync(new URL('../src/data/idioms.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(idioms.map((i) => [i.id, i]));

function check(g, wanted) {
  assert.ok(g.rows <= MAX_ROWS && g.cols <= MAX_COLS, `grid ${g.rows}x${g.cols} too big`);
  const occupied = new Map();
  for (const w of g.words) {
    w.cells.forEach((k, i) => {
      assert.equal(g.cells[k].ch, w.w[i], `${w.w} cell ${k}`);
      occupied.set(k, (occupied.get(k) || 0) + 1);
    });
    assert.ok(w.cells.some((k) => g.cells[k].given), `${w.w} has no given character`);
    assert.ok(w.cells.some((k) => !g.cells[k].given), `${w.w} is fully given`);
    // nothing directly before the start or after the end
    const [r, c] = w.cells[0].split(',').map(Number);
    const [r2, c2] = w.cells.at(-1).split(',').map(Number);
    const before = w.d === 'A' ? `${r},${c - 1}` : `${r - 1},${c}`;
    const after = w.d === 'A' ? `${r2},${c2 + 1}` : `${r2 + 1},${c2}`;
    assert.ok(!g.cells[before] && !g.cells[after], `${w.w} touches another word at an end`);
  }
  // every occupied cell belongs to the words that claim it
  for (const [k, n] of occupied) assert.equal(g.cells[k].words.length, n, `cell ${k}`);
  assert.equal(Object.keys(g.cells).length, occupied.size);
  // every cell's horizontal run and vertical run (length > 1) must be one of the words
  const runs = (d) => {
    const out = [];
    for (const k of Object.keys(g.cells)) {
      const [r, c] = k.split(',').map(Number);
      const prev = d === 'A' ? `${r},${c - 1}` : `${r - 1},${c}`;
      if (g.cells[prev]) continue;
      let s = '';
      let rr = r, cc = c;
      while (g.cells[`${rr},${cc}`]) { s += g.cells[`${rr},${cc}`].ch; d === 'A' ? cc++ : rr++; }
      if (s.length > 1) out.push(s);
    }
    return out;
  };
  const words = new Set(g.words.map((w) => w.w));
  for (const s of [...runs('A'), ...runs('D')]) assert.ok(words.has(s), `stray run ${s}`);
  if (wanted) assert.equal(g.words.length, wanted);
}

test('chapter 1 alone makes a valid 6-idiom grid', () => {
  const items = chapters[0].ids.map((id) => byId[id]);
  for (let seed = 1; seed <= 30; seed++) check(buildGrid(items, 6, seed), 6);
});

test('every chapter-sized learnt set gives valid 4–6 idiom grids', () => {
  let learnt = [];
  for (const ch of chapters) {
    learnt = learnt.concat(ch.ids.map((id) => byId[id]));
    for (let seed = 1; seed <= 10; seed++) {
      const g = buildGrid(learnt.slice().reverse(), 5, seed);
      check(g);
      assert.ok(g.words.length >= 4, `only ${g.words.length} idioms`);
    }
  }
});

test('same seed gives the same grid', () => {
  const items = idioms.slice(0, 30);
  assert.deepEqual(buildGrid(items, 6, 42), buildGrid(items, 6, 42));
});

test('fast enough for a phone', () => {
  const t = Date.now();
  for (let s = 0; s < 10; s++) buildGrid(idioms, 6, s);
  const per = (Date.now() - t) / 10;
  assert.ok(per < 400, `${per} ms per grid`);
});

test('grids actually cross most of the time', () => {
  const items = idioms;
  let crossings = 0;
  for (let s = 0; s < 20; s++) crossings += buildGrid(items, 6, s).crossings;
  assert.ok(crossings / 20 >= 3, `average crossings ${crossings / 20}`);
});
