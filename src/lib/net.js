// Leaderboard and teacher report, through a Google Apps Script web app bound to the teacher's Sheet
// (teacher/backend.gs). public/config.json holds its URL and the class code. Until the teacher fills those in,
// everything here quietly does nothing and the app says the board is not open yet.
import { getState, update } from './store.js';

const BASE = import.meta.env.BASE_URL;
let cfgPromise = null;
export function loadNetConfig() {
  if (!cfgPromise) {
    cfgPromise = fetch(`${BASE}config.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return cfgPromise;
}

export const boardOpen = (cfg) => !!(cfg && cfg.endpoint);

/** Queue a post (run result or report) and try to send everything queued. */
export function post(item) {
  update((s) => ({ ...s, outbox: [...s.outbox, { ...item, at: Date.now() }].slice(-40) }));
  return flush();
}

let flushing = false;
export async function flush() {
  const cfg = await loadNetConfig();
  if (!boardOpen(cfg) || flushing || !navigator.onLine) return false;
  flushing = true;
  try {
    for (const item of getState().outbox.slice()) {
      // no-cors + text/plain is the only cross-origin POST Apps Script accepts without a preflight.
      // The response is opaque, so "sent" means the request left the device without a network error.
      await fetch(cfg.endpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ ...item, code: cfg.classCode || '' }) });
      update((s) => ({ ...s, outbox: s.outbox.filter((x) => x.at !== item.at) }));
    }
    return true;
  } catch {
    return false;
  } finally {
    flushing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flush());
  setTimeout(() => flush(), 3000);
}

const CACHE = 'cyjh:board:';
/** { rows: [{ name, cls, score, strict, date }], updated } — falls back to the last copy when offline. */
export async function fetchBoard(mode, range) {
  const cfg = await loadNetConfig();
  if (!boardOpen(cfg)) return null;
  const key = `${CACHE}${mode}:${range}`;
  try {
    const u = `${cfg.endpoint}?board=${encodeURIComponent(range)}&mode=${encodeURIComponent(mode)}&code=${encodeURIComponent(cfg.classCode || '')}`;
    const r = await fetch(u);
    const data = await r.json();
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
    return data;
  } catch {
    try { return { ...JSON.parse(localStorage.getItem(key)), stale: true }; } catch { return { rows: [], stale: true }; }
  }
}
