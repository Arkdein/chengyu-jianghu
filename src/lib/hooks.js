import { useEffect, useState } from 'preact/hooks';
import { dayNumber } from './dates.js';

export function parseRoute(hash) {
  const [a, b, c] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!a) return { name: 'home' };
  if (a === 'library') return { name: 'library', ch: b != null ? Number(b) : null };
  if (a === 'learn') return { name: 'learn', id: b, ch: c != null ? Number(c) : null };
  if (a === 'run') return { name: 'run', mode: b || 'short' };
  if (a === 'records') return { name: 'records' };
  if (a === 'settings') return { name: 'settings' };
  if (a === 'skills') return { name: 'skills' };
  if (a === 'story') return { name: 'story' };
  return { name: 'home' };
}

export function useRoute() {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const f = () => {
      setH(location.hash);
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return parseRoute(h);
}

export const go = (path) => {
  location.hash = path;
};

export function useToday() {
  const [d, setD] = useState(dayNumber());
  useEffect(() => {
    const f = () => setD(dayNumber());
    document.addEventListener('visibilitychange', f);
    const t = setInterval(f, 60000);
    return () => {
      document.removeEventListener('visibilitychange', f);
      clearInterval(t);
    };
  }, []);
  return d;
}
