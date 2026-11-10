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

/**
 * A short run (小试身手): 比武 → fork (客栈 or 奇遇) → 比武 → 心魔.
 * Grid sizes grow a little as the student learns more idioms.
 */
export function planRun(state, today, idioms, seed) {
  const order = priority(state, today, idioms, seed);
  const size = order.length >= 30 ? 6 : order.length >= 16 ? 5 : 4;
  const g1 = buildGrid(order, size, seed);
  const used = new Set(g1.words.map((w) => w.id));
  let rest = order.filter((it) => !used.has(it.id));
  if (rest.length < size + 2) rest = shuffle(order, rng(seed + 7));
  const g2 = buildGrid(rest, size, seed + 1);
  g2.words.forEach((w) => used.add(w.id));
  const learnt = idioms.filter((it) => state.cards[it.id]);
  let boss = hardest(state, learnt, 2, used);
  if (boss.length < 2) boss = hardest(state, learnt, 2);
  return {
    seed,
    nodes: [
      { type: 'duel', grid: g1 },
      { type: 'fork', options: ['inn', 'encounter'] },
      { type: 'duel', grid: g2 },
      { type: 'boss', ids: boss.map((it) => it.id) },
    ],
  };
}

/** Multiple-choice questions for 客栈 and 奇遇: the right idiom plus distractors from what the student knows. */
export function quiz(target, pool, n, rand) {
  const others = shuffle(pool.filter((it) => it.id !== target.id), rand).slice(0, n - 1);
  return shuffle([target, ...others], rand);
}

/**
 * Run score. `stats` = { charsWritten, idiomsSolved, hp, secs, reveals, bossPerfect, strict }.
 * The stroke-strictness multiplier keeps the pure-score leaderboard fair across settings.
 */
export function score(stats) {
  const parts = {
    chars: stats.charsWritten * POINTS.char,
    idioms: stats.idiomsSolved * POINTS.idiom,
    hp: Math.max(0, stats.hp) * POINTS.hp,
    speed: Math.max(0, POINTS.speedMax - Math.floor(stats.secs / 2)),
    noReveal: stats.reveals === 0 ? POINTS.noReveal : 0,
    boss: stats.bossPerfect * POINTS.bossPerfect,
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
