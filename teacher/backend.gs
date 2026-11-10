/**
 * 成语江湖 — leaderboard and progress-report backend.
 *
 * Setup (about 5 minutes, on a computer):
 *  1. Open the Google Sheet "成语江湖 擂台榜与报告" (tabs Runs, Reports, Config).
 *  2. Extensions → Apps Script. Delete the sample code, paste this whole file, Save.
 *  3. Deploy → New deployment → type "Web app".
 *       Execute as: Me      Who has access: Anyone
 *     Authorise when asked, then copy the Web app URL (ends in /exec).
 *  4. Put that URL and the class code from Config!B2 into public/config.json of the app (or send them to Claude).
 *
 * Students never see this Sheet. Runs and reports only arrive when they carry the class code.
 * Delete any row in Runs to remove a score from the board.
 */
const TZ = 'Asia/Singapore';

function doPost(e) {
  const ss = SpreadsheetApp.getActive();
  const code = String(ss.getSheetByName('Config').getRange('B2').getValue()).trim();
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad json' }); }
  if (!code || String(d.code || '').trim() !== code) return json({ ok: false, error: 'wrong class code' });
  const now = new Date();
  const name = clean(d.name, 40), cls = clean(d.cls, 20);
  if (d.type === 'run') {
    if (!plausible(d)) return json({ ok: false, error: 'implausible score' });
    ss.getSheetByName('Runs').appendRow([now, name, cls, d.mode, d.score, d.raw, d.strict, d.idioms, d.chars, d.secs,
      d.reveals, d.boss || '', d.device || '', JSON.stringify(d.parts || {})]);
  } else if (d.type === 'report') {
    ss.getSheetByName('Reports').appendRow([now, name, cls, d.menpai, d.learnt, d.secure, d.bestShort, d.bestFull,
      d.runs, d.runsWeek, d.qi, d.story, (d.weak || []).join('、'), d.strict, d.device || '']);
  }
  return json({ ok: true });
}

function doGet(e) {
  const p = e.parameter || {};
  const ss = SpreadsheetApp.getActive();
  const code = String(ss.getSheetByName('Config').getRange('B2').getValue()).trim();
  if (!code || String(p.code || '').trim() !== code) return json({ rows: [], error: 'wrong class code' });
  const mode = p.mode === 'full' ? 'full' : 'short';
  const since = p.board === 'week' ? mondaySGT() : new Date(0);
  const values = ss.getSheetByName('Runs').getDataRange().getValues().slice(1);
  const best = {};
  values.forEach((r) => {
    const [at, name, cls, m, score, , strict] = r;
    if (m !== mode || !(at instanceof Date) || at < since || !name) return;
    const k = name + '|' + cls;
    if (!best[k] || score > best[k].score) best[k] = { name, cls, score, strict, date: Utilities.formatDate(at, TZ, 'MM-dd') };
  });
  const rows = Object.values(best).sort((a, b) => b.score - a.score).slice(0, 30);
  return json({ rows, updated: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') });
}

// Rough sanity check: the score must match its parts and the parts must be possible.
function plausible(d) {
  const p = d.parts || {};
  const sum = ['chars', 'idioms', 'hp', 'speed', 'noReveal', 'boss', 'perfect'].reduce((a, k) => a + (Number(p[k]) || 0), 0);
  if (Math.abs(sum - d.raw) > 1) return false;
  if (d.idioms > 60 || d.chars > d.idioms * 5 || (p.hp || 0) > 220 || (p.speed || 0) > 450) return false;
  const mult = { loose: 0.9, std: 1, strict: 1.15 }[d.strict];
  return !!mult && Math.abs(Math.round(d.raw * mult) - d.score) <= 1;
}

function mondaySGT() {
  const now = new Date();
  const s = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const day = Number(Utilities.formatDate(now, TZ, 'u')); // 1 = Monday
  const d = new Date(s + 'T00:00:00+08:00');
  d.setDate(d.getDate() - (day - 1));
  return d;
}

function clean(s, n) { return String(s || '').replace(/^[=+\-@]+/, '').slice(0, n); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
