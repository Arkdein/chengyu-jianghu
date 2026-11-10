import { useEffect, useState } from 'preact/hooks';

const BASE = import.meta.env.BASE_URL;
const clips = { w: new Set(), ex: new Set() };
let manifestPromise = null;
let current = null;
const subs = new Set();

export function loadAudioManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(`${BASE}audio/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m) {
          clips.w = new Set(m.w);
          clips.ex = new Set(m.ex);
        }
      })
      .catch(() => {})
      .finally(() => subs.forEach((f) => f()));
  }
  return manifestPromise;
}

const speech = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);
let zhVoice = null;
function pickVoice() {
  const s = speech();
  if (!s) return;
  const v = s.getVoices();
  zhVoice = v.find((x) => /zh[-_]CN|cmn-Hans/i.test(x.lang)) || v.find((x) => /^zh/i.test(x.lang)) || null;
  subs.forEach((f) => f());
}
if (speech()) {
  pickVoice();
  speech().onvoiceschanged = pickVoice;
}

export const hasClip = (id, part = 'w') => clips[part].has(id);
export const clipCount = () => clips.w.size + clips.ex.size;
/** True when we can actually produce Mandarin audio on this device. */
export const audioAvailable = () => clips.w.size > 0 || !!zhVoice;

export function stopAudio() {
  if (current) {
    current.pause();
    current = null;
  }
  speech()?.cancel();
}

/** part: 'w' (the headword) or 'ex' (its example sentence). */
export function play(item, part = 'w') {
  stopAudio();
  const text = part === 'w' ? item.w : item.ex;
  const key = part === 'w' ? item.id : `${item.id}-ex`;
  if (clips[part].has(item.id)) {
    current = new Audio(`${BASE}audio/${key}.mp3`);
    return current.play().catch(() => speak(text));
  }
  return speak(text);
}

function speak(text) {
  const s = speech();
  if (!s || !zhVoice) return Promise.resolve();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.voice = zhVoice;
  u.rate = 0.85;
  s.speak(u);
  return Promise.resolve();
}

/** Fetch every clip once so the service worker keeps them for offline use. */
export async function cacheAllAudio(onProgress) {
  await loadAudioManifest();
  const urls = [...clips.w].map((id) => `${BASE}audio/${id}.mp3`).concat([...clips.ex].map((id) => `${BASE}audio/${id}-ex.mp3`));
  let done = 0;
  const queue = urls.slice();
  const worker = async () => {
    while (queue.length) {
      const u = queue.pop();
      try {
        await fetch(u);
      } catch {
        /* offline or missing: skip */
      }
      onProgress?.(++done, urls.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return urls.length;
}

export function useAudioReady() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    loadAudioManifest();
    return () => subs.delete(f);
  }, []);
  return audioAvailable();
}
