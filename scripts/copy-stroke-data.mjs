// Copies stroke-order data (hanzi-writer-data, Arphic Public License) for every character
// in src/data/idioms.json into public/strokes/<char>.json.  Run after rebuilding the data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { idioms } = JSON.parse(fs.readFileSync(path.join(root, 'src/data/idioms.json'), 'utf8'));
const src = path.join(root, 'node_modules/hanzi-writer-data');
const out = path.join(root, 'public/strokes');
fs.mkdirSync(out, { recursive: true });

const chars = new Set();
for (const it of idioms) for (const ch of it.w) if (/\p{Script=Han}/u.test(ch)) chars.add(ch);
const have = [];
const missing = [];
for (const ch of [...chars].sort()) {
  const f = path.join(src, `${ch}.json`);
  if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(out, `${ch}.json`)); have.push(ch); } else missing.push(ch);
}
fs.copyFileSync(path.join(src, 'ARPHICPL.TXT'), path.join(out, 'ARPHICPL.TXT'));
fs.writeFileSync(path.join(root, 'public/stroke-manifest.json'), JSON.stringify({ have, missing }));
console.log(`${have.length} characters copied, ${missing.length} missing${missing.length ? ': ' + missing.join('') : ''}`);
if (missing.length) process.exit(1);
