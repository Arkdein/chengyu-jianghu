// Planning and scoring a 行走江湖 run. Pure functions, unit-tested in Node.
import { buildGrid, rng, shuffle } from './grid.js';
import { STRICTNESS } from './strictness.js';

export const MIN_LEARNT = 10;
export const START_HP = 100;
export const START_QI = 30;

export const COST = { hint: 5, reveal: 15, trace: 8, stroke: 2 };
export const GAIN = { idiomQi: 10, innHeal: 25, innQi: 5, encounterQi: 15, encounterHurt: 10 };
export const POINTS = { char: 10, idiom: 100, hp: 2, speedMax: 300, noReveal: 150, bossPerfect: 150 };

export const learntIds = (state) => Object.keys(state.cards);

/**
 * Learnt idioms in the order a run should use them: due for review first (oldest due first),
 * then the ones with the most misses, then the rest in random order.
 */
export function priority(state, today, idioms, seed) {
  const rand = rng(seed);
  const learnt = idioms.filter((it) => state.cards[it.id]);
  const scored = learnt.map((it) => {
    const c = state.cards[it.id];
    const due = c.due <= today;
    const weak = (c.bad || 0) + (c.lapses || 0) * 2 + (c.hint || 0) * 0.5;
    return { it, k: (due ? 0 : 1000) + (due ? c.due - today : 0) * 1 - weak * 10 + rand() * 30 - c.b * 5 };
  });
  return scored.sort((a, b) => a.k - b.k).map((x) => x.it);
}

/** The idioms this student finds hardest: most misses, lowest box. */
export function hardest(state, items, n, exclude = new Set()) {
  return items
    .filter((it) => !exclude.has(it.id))
    .map((it) => {
      const c = state.cards[it.id];
      return { it, k: (c.bad || 0) * 3 + (c.lapses || 0) * 4 + (c.hint || 0) - c.b * 2 };
    })
    .sort((a, b) => b.k - a.k)
    .slice(0, n)
    .map((x) => x.it);
}

export const MODES = {
  short: { name: '小试身手', min: 10, boss: 2 },
  full: { name: '闯荡江湖', min: 20, boss: 3 },
};

/**
 * A run is a list of layers; each layer offers one or more nodes and the student picks one.
 *   short (小试身手): 比武 → 客栈|奇遇 → 比武 → 心魔
 *   full  (闯荡江湖): 比武 → four forks of two (比武, 大擂台, 客栈, 奇遇, H2 藏书楼) → 心魔
 * Grids are built when a 比武 node is entered, from the idioms not used yet in this run.
 */
export function planRun(state, today, idioms, seed, mode = 'short', menpai = 'H1') {
  const order = priority(state, today, idioms, seed);
  const rand = rng(seed + 101);
  let layers;
  if (mode === 'full') {
    layers = [[{ type: 'duel' }]];
    for (let i = 1; i <= 4; i++) {
      const pool = ['duel', 'duel', 'inn', 'encounter'];
      if (i >= 2) pool.push('elite');
      if (menpai === 'H2') pool.push('library');
      let pick;
      do pick = shuffle(pool, rand).slice(0, 2);
      while (pick[0] === pick[1] || !pick.some((t) => t === 'duel' || t === 'elite'));
      layers.push(pick.map((type) => ({ type })));
    }
    layers.push([{ type: 'boss' }]);
  } else {
    layers = [[{ type: 'duel' }], [{ type: 'inn' }, { type: 'encounter' }], [{ type: 'duel' }], [{ type: 'boss' }]];
  }
  return { seed, mode, layers, order: order.map((it) => it.id) };
}

export function gridSize(mode, kind, learnt) {
  if (kind === 'elite') return learnt >= 30 ? 8 : 7;
  if (mode === 'full') return learnt >= 30 ? 6 : 5;
  return learnt >= 30 ? 6 : learnt >= 16 ? 5 : 4;
}

/** A crossword for the next 比武, preferring idioms this run has not used yet. */
export function makeGrid(order, used, size, seed) {
  let rest = order.filter((it) => !used.has(it.id));
  if (rest.length < size + 2) rest = shuffle(order, rng(seed + 7));
  return buildGrid(rest, size, seed);
}

/** The 心魔's idioms: the student's hardest, avoiding ones already met in this run when possible. */
export function bossIdioms(state, learnt, n, used) {
  let out = hardest(state, learnt, n, used);
  if (out.length < n) out = hardest(state, learnt, n);
  return out;
}

/** Multiple-choice questions for 客栈 and 奇遇: the right idiom plus distractors from what the student knows. */
export function quiz(target, pool, n, rand) {
  const others = shuffle(pool.filter((it) => it.id !== target.id), rand).slice(0, n - 1);
  return shuffle([target, ...others], rand);
}

/**
 * Run score. `stats` = { charsWritten, perfectChars, idiomsSolved, perfectIdioms, hp, secs, reveals, bossPerfect, strict }.
 * `skills` = the student's 武学 (入木三分, 百步穿杨 and 运斤成风 change the score).
 * The stroke-strictness multiplier keeps the pure-score leaderboard fair across settings.
 */
export function score(stats, skills = {}) {
  const parts = {
    chars: stats.charsWritten * POINTS.char + (skills.wai1 ? (stats.perfectChars || 0) * 5 : 0),
    idioms: stats.idiomsSolved * POINTS.idiom,
    hp: Math.max(0, stats.hp) * POINTS.hp,
    speed: Math.max(0, (skills.wai3 ? 450 : POINTS.speedMax) - Math.floor(stats.secs / 2)),
    noReveal: stats.reveals === 0 ? POINTS.noReveal : 0,
    boss: stats.bossPerfect * POINTS.bossPerfect,
    perfect: skills.wai2 ? (stats.perfectIdioms || 0) * 50 : 0,
  };
  const raw = Object.values(parts).reduce((a, b) => a + b, 0);
  const mult = (STRICTNESS[stats.strict] || STRICTNESS.std).mult;
  return { parts, raw, mult, total: Math.round(raw * mult) };
}

/**
 * How an idiom went in a run, for spaced repetition.
 * 'again' if any character was revealed or it was left unsolved, 'hint' if it needed help
 * (a paid clue, tracing, or 3+ wrong strokes), otherwise 'good'.
 */
export function outcome(rec) {
  if (!rec.solved || rec.reveals > 0) return 'again';
  if (rec.hints > 0 || rec.traces > 0 || rec.mistakes >= 3) return 'hint';
  return 'good';
}
