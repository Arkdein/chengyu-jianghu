// Shape of everything the app remembers on this device, plus a sanitiser so a damaged
// or older backup never crashes the app.
import { BY_ID } from './data.js';
import { STRICTNESS } from './strictness.js';
import { SKILL } from './skills.js';

export { STRICTNESS };


export function defaultState() {
  return {
    v: 1,
    profile: { name: '', cls: '', menpai: 'H1', strict: 'std' },
    cards: {}, // idiom id -> SRS card (created when the idiom is learnt in 藏经阁)
    qi: 0, // banked 内力 (spent on the skill tree in Phase 2)
    runs: [], // last 60 runs: { day, mode, score, raw, strict, idioms, failed }
    best: {}, // mode -> best score
    skills: {}, // skill id -> day bought
    story: { intro: false, pro: [], beaten: [], hub: {}, queue: [] },
    outbox: [], // leaderboard/report posts waiting for a connection
  };
}

export function sanitize(s) {
  const d = defaultState();
  if (!s || typeof s !== 'object') return d;
  const p = s.profile || {};
  const out = {
    v: 1,
    profile: {
      name: String(p.name || '').slice(0, 40),
      cls: String(p.cls || '').slice(0, 20),
      menpai: p.menpai === 'H2' ? 'H2' : 'H1',
      strict: STRICTNESS[p.strict] ? p.strict : 'std',
    },
    cards: {},
    qi: Number.isFinite(s.qi) ? Math.max(0, Math.round(s.qi)) : 0,
    runs: Array.isArray(s.runs) ? s.runs.filter((r) => r && Number.isFinite(r.score)).slice(-60) : [],
    best: {},
  };
  for (const [id, c] of Object.entries(s.cards || {})) {
    if (BY_ID[id] && c && Number.isFinite(c.b) && Number.isFinite(c.due)) out.cards[id] = c;
  }
  for (const [m, v] of Object.entries(s.best || {})) if (Number.isFinite(v)) out.best[m] = v;
  out.skills = {};
  for (const [k, v] of Object.entries(s.skills || {})) if (SKILL[k]) out.skills[k] = Number(v) || 1;
  const st = s.story || {};
  const ints = (a) => (Array.isArray(a) ? a.filter(Number.isInteger) : []);
  out.story = {
    intro: !!st.intro,
    pro: ints(st.pro),
    beaten: ints(st.beaten),
    hub: st.hub && typeof st.hub === 'object' ? { ...st.hub } : {},
    queue: Array.isArray(st.queue) ? st.queue.slice(0, 6) : [],
  };
  out.outbox = Array.isArray(s.outbox) ? s.outbox.slice(-40) : [];
  return out;
}

/** Backup code: the whole state as compact base64 text the student can copy to another phone. */
export function exportCode(s) {
  const json = JSON.stringify(s);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return 'CYJH1.' + btoa(bin);
}

export function importCode(code) {
  const m = /^CYJH1\.([A-Za-z0-9+/=\s]+)$/.exec((code || '').trim());
  if (!m) throw new Error('bad code');
  const bin = atob(m[1].replace(/\s+/g, ''));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return sanitize(JSON.parse(new TextDecoder().decode(bytes)));
}
