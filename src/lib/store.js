import { useEffect, useState } from 'preact/hooks';
import { defaultState, sanitize } from './progress.js';

const KEY = 'cyjh:v1';
let state = load();
const listeners = new Set();
let timer = null;
let storageOk = true;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : defaultState();
  } catch {
    storageOk = false;
    return defaultState();
  }
}

function persist() {
  clearTimeout(timer);
  timer = setTimeout(flush, 150);
}

function flush() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    storageOk = false;
  }
}

export const getState = () => state;
export const storageWorks = () => storageOk;

export function update(fn) {
  state = fn(state);
  persist();
  listeners.forEach((l) => l(state));
}

export function replaceState(next) {
  state = sanitize(next);
  persist();
  listeners.forEach((l) => l(state));
}

export function resetState() {
  state = defaultState();
  persist();
  listeners.forEach((l) => l(state));
}

export function useStore() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    return () => listeners.delete(setS);
  }, []);
  return s;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}
