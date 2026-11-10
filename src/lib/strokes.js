// Stroke-order data lives in public/strokes/<char>.json (hanzi-writer-data, Arphic Public License).
const BASE = import.meta.env.BASE_URL;
let manifest = null;

export const strokeUrl = (ch) => `${BASE}strokes/${encodeURIComponent(ch)}.json`;

export function loadStrokeManifest() {
  if (!manifest) {
    manifest = fetch(`${BASE}stroke-manifest.json`)
      .then((r) => (r.ok ? r.json() : { have: [], missing: [] }))
      .catch(() => ({ have: [], missing: [] }));
  }
  return manifest;
}

/** hanzi-writer charDataLoader: fetch (and let the service worker cache) one character. */
export function charDataLoader(ch, onLoad, onError) {
  fetch(strokeUrl(ch))
    .then((r) => {
      if (!r.ok) throw new Error('missing');
      return r.json();
    })
    .then(onLoad)
    .catch(onError);
}

/** Fetch every character once so the service worker keeps them for offline use. */
export async function cacheAllStrokes(onProgress) {
  const { have } = await loadStrokeManifest();
  const queue = have.slice();
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const ch = queue.pop();
      try { await fetch(strokeUrl(ch)); } catch { /* offline: skip */ }
      onProgress?.(++done, have.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return have.length;
}
