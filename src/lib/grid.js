// Crossword generator for idioms. Pure functions, no DOM, so it can be unit-tested in Node.
//
// A grid is { rows, cols, words: [{ id, w, r, c, d }], cells: { "r,c": { ch, words: [i], given } } }
// d is 'A' (across, left to right) or 'D' (down, top to bottom).
// Words only touch where they cross on a shared character; parallel words never sit side by side,
// and nothing touches a word's ends. Idioms that cannot cross anything are placed as separate
// "islands" so a grid always holds the idioms it was asked for when there is room.

export const MAX_COLS = 9;
export const MAX_ROWS = 11;

/** Small seeded PRNG (mulberry32) so a run can be replayed from its seed. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const key = (r, c) => `${r},${c}`;

// Work on a large board, then crop. W x H must exceed the final limits.
const BW = 24;
const BH = 24;

function canPlace(board, w, r, c, d) {
  const dr = d === 'D' ? 1 : 0;
  const dc = d === 'A' ? 1 : 0;
  const n = w.length;
  if (r < 0 || c < 0 || r + dr * (n - 1) >= BH || c + dc * (n - 1) >= BW) return -1;
  // cells just before the start and just after the end must be empty
  if (board.has(key(r - dr, c - dc)) || board.has(key(r + dr * n, c + dc * n))) return -1;
  let cross = 0;
  for (let i = 0; i < n; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const g = board.get(key(rr, cc));
    if (g) {
      if (g.ch !== w[i] || g.dirs.has(d)) return -1;
      cross++;
    } else {
      // the two side neighbours must be empty, or the word would run alongside another
      if (board.has(key(rr + dc, cc + dr)) || board.has(key(rr - dc, cc - dr))) return -1;
    }
  }
  if (cross === n) return -1;
  return cross;
}

function place(board, words, item, r, c, d) {
  const dr = d === 'D' ? 1 : 0;
  const dc = d === 'A' ? 1 : 0;
  const idx = words.length;
  for (let i = 0; i < item.w.length; i++) {
    const k = key(r + dr * i, c + dc * i);
    const g = board.get(k) || { ch: item.w[i], dirs: new Set(), words: [] };
    g.dirs.add(d);
    g.words.push(idx);
    board.set(k, g);
  }
  words.push({ id: item.id, w: item.w, r, c, d });
}

function bounds(board) {
  let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
  for (const k of board.keys()) {
    const [r, c] = k.split(',').map(Number);
    r0 = Math.min(r0, r); r1 = Math.max(r1, r);
    c0 = Math.min(c0, c); c1 = Math.max(c1, c);
  }
  return { r0, r1, c0, c1 };
}

function fits(board, w, r, c, d, b = bounds(board)) {
  const dr = d === 'D' ? 1 : 0;
  const dc = d === 'A' ? 1 : 0;
  const r1 = Math.max(b.r1, r + dr * (w.length - 1));
  const c1 = Math.max(b.c1, c + dc * (w.length - 1));
  const r0 = Math.min(b.r0, r);
  const c0 = Math.min(b.c0, c);
  return r1 - r0 + 1 <= MAX_ROWS && c1 - c0 + 1 <= MAX_COLS;
}

/** One greedy attempt. `items` are in priority order (shuffled lightly by the caller). */
function attempt(items, target, rand) {
  const board = new Map();
  const words = [];
  const pool = items.slice();
  const first = pool.shift();
  const r0 = 10;
  const c0 = Math.max(0, Math.floor((BW - first.w.length) / 2));
  place(board, words, first, r0, c0, 'A');
  let crossings = 0;

  // 1) keep adding the idiom with the most crossings (ties go to the higher-priority idiom)
  while (words.length < target) {
    let best = null;
    const bb = bounds(board);
    // Only positions that put one of the idiom's characters on a matching board cell can cross,
    // so try just those anchors instead of every square.
    pool.forEach((it, pi) => {
      for (const [k, g] of board) {
        const [br, bc] = k.split(',').map(Number);
        for (let i = 0; i < it.w.length; i++) {
          if (it.w[i] !== g.ch) continue;
          for (const d of ['A', 'D']) {
            if (g.dirs.has(d)) continue;
            const r = d === 'D' ? br - i : br;
            const c = d === 'A' ? bc - i : bc;
            const x = canPlace(board, it.w, r, c, d);
            if (x < 1 || !fits(board, it.w, r, c, d, bb)) continue;
            const score = x * 100 - pi * 3 + rand();
            if (!best || score > best.score) best = { score, it, pi, r, c, d, x };
          }
        }
      }
    });
    if (!best) break;
    place(board, words, best.it, best.r, best.c, best.d);
    crossings += best.x;
    pool.splice(best.pi, 1);
  }

  // 2) islands: place remaining idioms that cross nothing, in priority order, if there is room
  for (const it of pool.slice()) {
    if (words.length >= target) break;
    const spots = [];
    const bb = bounds(board);
    for (let r = 0; r < BH; r++) {
      for (let c = 0; c < BW; c++) {
        for (const d of ['A', 'D']) {
          if (fits(board, it.w, r, c, d, bb) && canPlaceIsland(board, it.w, r, c, d)) spots.push({ r, c, d });
        }
      }
    }
    if (!spots.length) continue;
    // prefer spots close to the existing words, so the grid stays compact
    const b = bounds(board);
    const cr = (b.r0 + b.r1) / 2;
    const cc = (b.c0 + b.c1) / 2;
    spots.sort((p, q) => Math.hypot(p.r - cr, p.c - cc) - Math.hypot(q.r - cr, q.c - cc) || rand() - 0.5);
    const s = spots[0];
    place(board, words, it, s.r, s.c, s.d);
    pool.splice(pool.indexOf(it), 1);
  }
  return { board, words, crossings };
}

function canPlaceIsland(board, w, r, c, d) {
  const dr = d === 'D' ? 1 : 0;
  const dc = d === 'A' ? 1 : 0;
  const n = w.length;
  if (r < 0 || c < 0 || r + dr * (n - 1) >= BH || c + dc * (n - 1) >= BW) return false;
  // the island and a one-cell margin around it must be empty
  for (let i = -1; i <= n; i++) {
    for (let s = -1; s <= 1; s++) {
      const rr = r + dr * i + dc * s;
      const cc = c + dc * i + dr * s;
      if (board.has(key(rr, cc))) return false;
    }
  }
  return true;
}

/**
 * Build a crossword.
 *   items   – idioms in priority order ({ id, w }); the first ones are the ones the run most wants
 *   target  – how many idioms the grid should hold
 *   seed    – integer; same seed + same items = same grid
 *   tries   – random restarts; the best attempt (most idioms, then most crossings, then smallest) wins
 */
export function buildGrid(items, target, seed = 1, tries = 40) {
  const rand = rng(seed);
  const usable = items.filter((it) => it.w.length <= MAX_COLS);
  let best = null;
  for (let t = 0; t < tries; t++) {
    // keep the top-priority idioms near the front but vary the order between attempts
    const order = usable
      .map((it, i) => ({ it, k: i + rand() * Math.max(2, usable.length / 3) }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.it);
    const a = attempt(order, target, rand);
    const b = bounds(a.board);
    const area = (b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1);
    const score = a.words.length * 10000 + a.crossings * 100 - area;
    if (!best || score > best.score) best = { ...a, score };
  }
  return finish(best, rand);
}

function finish({ board, words, crossings }, rand) {
  const b = bounds(board);
  const cells = {};
  for (const [k, g] of board) {
    const [r, c] = k.split(',').map(Number);
    cells[key(r - b.r0, c - b.c0)] = { ch: g.ch, words: g.words.slice(), given: false };
  }
  const ws = words.map((w) => ({ ...w, r: w.r - b.r0, c: w.c - b.c0 }));
  ws.forEach((w) => { w.cells = cellsOf(w); });
  pickGivens(cells, ws, rand);
  return { rows: b.r1 - b.r0 + 1, cols: b.c1 - b.c0 + 1, words: ws, cells, crossings };
}

export function cellsOf(w) {
  const out = [];
  for (let i = 0; i < w.w.length; i++) out.push(key(w.r + (w.d === 'D' ? i : 0), w.c + (w.d === 'A' ? i : 0)));
  return out;
}

/**
 * One given character per idiom. A character that repeats inside its own idiom (自 in 自给自足)
 * is the first choice, because writing it twice teaches nothing; then a crossing cell, so one given
 * helps two idioms; otherwise a random cell. Never more than half of an idiom is given.
 */
function pickGivens(cells, words, rand) {
  for (const w of words) {
    const ks = w.cells;
    if (ks.some((k) => cells[k].given)) continue;
    const counts = {};
    for (const ch of w.w) counts[ch] = (counts[ch] || 0) + 1;
    const repeated = ks.filter((k) => counts[cells[k].ch] > 1);
    // a cell may be given only if no idiom through it ends up more than half given (一心一意 gives
    // both 一; a crossing on 心 or 意 must not fill in the rest)
    const room = (k) => cells[k].words.every((i) => {
      const wc = words[i].cells;
      return wc.filter((x) => cells[x].given).length + 1 <= Math.floor(wc.length / 2);
    });
    const crossing = ks.filter((k) => cells[k].words.length > 1 && room(k));
    let pick;
    if (repeated.length) {
      // give every copy of the repeated character (still at most half the idiom)
      repeated.slice(0, Math.floor(ks.length / 2)).forEach((k) => { cells[k].given = true; });
      continue;
    } else if (crossing.length) pick = crossing[Math.floor(rand() * crossing.length)];
    else {
      const free = ks.filter((k) => cells[k].words.length === 1);
      const pool = free.length ? free : ks;
      pick = pool[Math.floor(rand() * pool.length)];
    }
    cells[pick].given = true;
  }
}
