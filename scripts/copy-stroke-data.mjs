// Packs stroke-order data (hanzi-writer-data, Arphic Public License) for every character in
// src/data/idioms.json into 32 bucket files, public/strokes/b00.json … b31.json (bucket = code point % 32).
// Fewer, larger files load faster on a phone and keep the site small enough for hosts with file limits.
// Run after rebuilding the data:  node scripts/copy-stroke-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUCKETS = 32;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { idioms } = JSON.parse(fs.readFileSync(path.join(root, 'src/data/idioms.json'), 'utf8'));
const src = path.join(root, 'node_modules/hanzi-writer-data');
const out = path.join(root, 'public/strokes');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const chars = new Set();
for (const it of idioms) for (const ch of it.w) if (/\p{Script=Han}/u.test(ch)) chars.add(ch);
const have = [];
const missing = [];
const buckets = Array.from({ length: BUCKETS }, () => ({}));
for (const ch of [...chars].sort()) {
  const f = path.join(src, `${ch}.json`);
  if (fs.existsSync(f)) { buckets[ch.codePointAt(0) % BUCKETS][ch] = JSON.parse(fs.readFileSync(f, 'utf8')); have.push(ch); } else missing.push(ch);
}
buckets.forEach((b, i) => fs.writeFileSync(path.join(out, `b${String(i).padStart(2, '0')}.json`), JSON.stringify(b)));
fs.copyFileSync(path.join(src, 'ARPHICPL.TXT'), path.join(out, 'ARPHICPL.TXT'));
fs.writeFileSync(path.join(root, 'public/stroke-manifest.json'), JSON.stringify({ have, missing, buckets: BUCKETS }));
console.log(`${have.length} characters packed into ${BUCKETS} files, ${missing.length} missing${missing.length ? ': ' + missing.join('') : ''}`);
if (missing.length) process.exit(1);
