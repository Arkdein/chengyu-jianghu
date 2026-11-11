// Background music: original loops per setting, off by default, quiet under the word audio.
// Each loop file carries 2 s past its loop point (a copy of its opening), so two copies can be
// crossfaded over that overlap: the join is seamless whatever padding the MP3 decoder adds.
import { useEffect, useState } from 'preact/hooks';

const BASE = import.meta.env.BASE_URL;
const KEY = 'cyjh:music';
const XF = 1.5; // crossfade inside the 2 s overlap
const LEVEL = 0.8; // with the default volume the music sits about 5 dB under the word audio

let pref = (() => {
  try { return { on: false, vol: 0.7, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { on: false, vol: 0.7 }; }
})();
const subs = new Set();
let ctx = null;
let master = null;
let duckNode = null;
let manifest = null;
const buffers = new Map();
let want = null;
let cur = null;
let pending = null;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch { /* private mode */ }
  subs.forEach((f) => f(pref));
}

/** iPhone: Web Audio obeys the silent switch unless the page asks for playback. The student turned music on, so ask. */
function session() {
  try { if (navigator.audioSession) navigator.audioSession.type = pref.on ? 'playback' : 'auto'; } catch { /* not supported */ }
}

function ensure() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    duckNode = ctx.createGain();
    master.gain.value = pref.vol * LEVEL;
    master.connect(duckNode).connect(ctx.destination);
    // iOS only lets Web Audio make sound once a buffer has been started inside a tap.
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ctx.destination);
    s.start(0);
  }
  session();
  if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {});
  return ctx;
}

async function getManifest() {
  if (!manifest) manifest = fetch(`${BASE}music/manifest.json`).then((r) => r.json()).catch(() => ({}));
  return manifest;
}

function decode(ab) {
  return new Promise((ok, bad) => {
    const p = ctx.decodeAudioData(ab, ok, bad);
    if (p && p.then) p.then(ok, bad);
  });
}

function load(name) {
  if (!buffers.has(name)) {
    buffers.set(name, fetch(`${BASE}music/${name}.mp3`).then((r) => r.arrayBuffer()).then(decode).catch((e) => { buffers.delete(name); throw e; }));
  }
  return buffers.get(name);
}

function fadeOut(state, secs = 0.8) {
  if (!state) return;
  state.stop = true;
  clearTimeout(state.timer);
  const t = ctx.currentTime;
  state.g.gain.cancelScheduledValues(t);
  state.g.gain.setValueAtTime(state.g.gain.value, t);
  state.g.gain.linearRampToValueAtTime(0, t + secs);
  setTimeout(() => { state.srcs.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }); state.g.disconnect(); }, secs * 1000 + 100);
}

function startLoop(name, buf, loop) {
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(master);
  const t0 = ctx.currentTime + 0.05;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(1, t0 + 1.2);
  const state = { name, g, srcs: [], stop: false, timer: null };
  const schedule = (at, first) => {
    if (state.stop) return;
    const s = ctx.createBufferSource();
    const sg = ctx.createGain();
    s.buffer = buf;
    s.connect(sg).connect(g);
    sg.gain.setValueAtTime(first ? 1 : 0, at);
    if (!first) sg.gain.linearRampToValueAtTime(1, at + XF);
    sg.gain.setValueAtTime(1, at + loop);
    sg.gain.linearRampToValueAtTime(0, at + loop + XF);
    s.start(at);
    s.stop(at + loop + XF + 0.05);
    state.srcs = [...state.srcs.slice(-1), s];
    state.timer = setTimeout(() => schedule(at + loop, false), Math.max(0, at + loop - ctx.currentTime - 4) * 1000);
  };
  schedule(t0, true);
  return state;
}

async function sync() {
  if (!pref.on || !want) { if (cur) { fadeOut(cur); cur = null; } return; }
  if (!ensure()) return;
  if ((cur && cur.name === want) || pending === want) return;
  const name = want;
  pending = name;
  if (cur) { fadeOut(cur); cur = null; }
  try {
    const [m, buf] = await Promise.all([getManifest(), load(name)]);
    if (want !== name || !pref.on || (cur && cur.name === name)) return;
    if (cur) fadeOut(cur);
    cur = startLoop(name, buf, m[name]?.loop || buf.duration - 2);
  } catch { /* offline and not cached yet: stay silent */ } finally { if (pending === name) pending = null; }
}

/** The loop this screen wants (null = silence). */
export function setMusic(name) {
  want = name;
  sync();
}

/** A one-shot (win / lose): the loop fades, the sting plays once. */
export async function playSting(name) {
  want = null;
  if (cur) { fadeOut(cur, 0.4); cur = null; }
  if (!pref.on || !ensure()) return;
  try {
    const buf = await load(name);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(master);
    s.start(ctx.currentTime + 0.1);
  } catch { /* ignore */ }
}

/** Lower the music while a word or sentence is being read aloud. */
export function duck(on) {
  if (!ctx || !duckNode) return;
  const t = ctx.currentTime;
  duckNode.gain.cancelScheduledValues(t);
  duckNode.gain.setValueAtTime(duckNode.gain.value, t);
  duckNode.gain.linearRampToValueAtTime(on ? 0.25 : 1, t + (on ? 0.15 : 0.6));
}

export function setMusicOn(on) {
  pref = { ...pref, on };
  save();
  session();
  if (on) ensure();
  sync();
}

export function setMusicVol(vol) {
  pref = { ...pref, vol };
  save();
  if (master) master.gain.setTargetAtTime(vol * LEVEL, ctx.currentTime, 0.05);
}

export function useMusic() {
  const [p, setP] = useState(pref);
  useEffect(() => { subs.add(setP); return () => subs.delete(setP); }, []);
  return p;
}

if (typeof document !== 'undefined') {
  // Browsers only allow sound after a tap: the first one starts the music if it was left on.
  const kick = () => { if (pref.on) { ensure(); sync(); } };
  document.addEventListener('pointerdown', kick, { capture: true });
  document.addEventListener('keydown', kick, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (pref.on) ctx.resume().catch(() => {});
  });
}
