// Stroke-order data lives in public/strokes/bNN.json buckets (hanzi-writer-data, Arphic Public License).
const BASE = import.meta.env.BASE_URL;
const BUCKETS = 32;
const bucketOf = (ch) => ch.codePointAt(0) % BUCKETS;
export const bucketUrl = (n) => `${BASE}strokes/b${String(n).padStart(2, '0')}.json`;
const loaded = {};

function bucket(n) {
  if (!loaded[n]) {
    loaded[n] = fetch(bucketUrl(n)).then((r) => {
      if (!r.ok) throw new Error('missing');
      return r.json();
    }).catch((e) => { delete loaded[n]; throw e; });
  }
  return loaded[n];
}

/** hanzi-writer charDataLoader */
export function charDataLoader(ch, onLoad, onError) {
  bucket(bucketOf(ch))
    .then((b) => (b[ch] ? onLoad(b[ch]) : onError(new Error('missing'))))
    .catch(onError);
}

/** Fetch every bucket once so the service worker keeps them for offline use. */
export async function cacheAllStrokes(onProgress) {
  let done = 0;
  await Promise.all(Array.from({ length: BUCKETS }, (_, n) => bucket(n).catch(() => null).then(() => onProgress?.(++done, BUCKETS))));
  return BUCKETS;
}
