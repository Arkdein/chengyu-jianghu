import { useEffect, useState } from 'preact/hooks';
import { useStore } from '../lib/store.js';
import { useToday } from '../lib/hooks.js';
import { BY_ID, STORY } from '../lib/data.js';
import { statusOf } from '../lib/srs.js';
import { STRICTNESS } from '../lib/progress.js';
import { MODES } from '../lib/run.js';
import { isoFromDay } from '../lib/dates.js';
import { fetchBoard, loadNetConfig, boardOpen } from '../lib/net.js';
import { Top } from '../components/Bits.jsx';

export function Records() {
  const s = useStore();
  const today = useToday();
  const cards = Object.entries(s.cards);
  const by = { learning: 0, reviewing: 0, secure: 0 };
  cards.forEach(([, c]) => { by[statusOf(c)] += 1; });
  const weak = cards
    .filter(([, c]) => (c.bad || 0) + (c.lapses || 0) > 0)
    .sort((a, b) => (b[1].bad + b[1].lapses * 2) - (a[1].bad + a[1].lapses * 2))
    .slice(0, 8);
  const runs = s.runs.slice().reverse().slice(0, 12);
  return (
    <div class="wrap">
      <Top title="战绩" sub="擂台榜、修为与心魔" />
      <Board s={s} />
      <div class="stats3">
        <div class="stat"><div class="k">小试身手</div><div class="v red">{s.best.short || 0}</div></div>
        <div class="stat"><div class="k">闯荡江湖</div><div class="v red">{s.best.full || 0}</div></div>
        <div class="stat"><div class="k">心魔已破</div><div class="v">{s.story.beaten.length}<span class="small mute"> / {STORY.chapters.length}</span></div></div>
      </div>
      <div class="card">
        <h3>修为</h3>
        <p class="small" style={{ margin: 0 }}>初学 {by.learning} · 复习中 {by.reviewing} · 熟练 {by.secure}</p>
        <p class="small mute" style={{ margin: '6px 0 0' }}>闯关时写对、不靠帮助，成语就往“熟练”走一步；点穴揭字会让它退回去。</p>
      </div>
      {weak.length > 0 && (
        <div class="card">
          <h3>心魔榜 · 最常出错</h3>
          {weak.map(([id, c]) => (
            <a class="idiom-row" href={`#/learn/${id}`} key={id}>
              <span class="w grow">{BY_ID[id].w}</span>
              <span class="small mute">错 {c.bad} 次</span>
            </a>
          ))}
        </div>
      )}
      <div class="card">
        <h3>最近闯关</h3>
        {runs.length === 0 ? <p class="small mute">还没有闯关记录。</p> : (
          <table class="t">
            <thead><tr><th>日期</th><th>模式</th><th>分数</th><th>成语</th><th>判定</th></tr></thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i}>
                  <td>{isoFromDay(r.day).slice(5)}</td>
                  <td>{MODES[r.mode]?.name.slice(0, 2) || ''}</td>
                  <td>{r.failed ? <span class="mute">走火入魔</span> : <b>{r.score}</b>}</td>
                  <td>{r.idioms}</td>
                  <td>{STRICTNESS[r.strict]?.label || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p class="small mute" style={{ margin: '8px 0 0' }}>本周已闯 {s.runs.filter((r) => r.day > today - 7).length} 局。</p>
      </div>
    </div>
  );
}

function Board({ s }) {
  const [mode, setMode] = useState('short');
  const [range, setRange] = useState('week');
  const [data, setData] = useState(undefined);
  const [open, setOpen] = useState(null);
  useEffect(() => { loadNetConfig().then((c) => setOpen(boardOpen(c))); }, []);
  useEffect(() => {
    if (!open) return;
    setData(undefined);
    fetchBoard(mode, range).then(setData);
  }, [open, mode, range]);
  return (
    <div class="card">
      <h3>擂台榜</h3>
      {open === false && <p class="small mute" style={{ margin: 0 }}>老师还没有开通全班擂台榜。开通后，这里会显示本周和历史最高分（纯分数排名，标明笔顺判定）。</p>}
      {open && (
        <>
          <div class="tabs">
            {Object.entries(MODES).map(([m, i]) => <button class={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{i.name}</button>)}
            <button class={range === 'week' ? 'on' : ''} onClick={() => setRange('week')}>本周</button>
            <button class={range === 'all' ? 'on' : ''} onClick={() => setRange('all')}>总榜</button>
          </div>
          {data === undefined && <p class="small mute">载入中……</p>}
          {data && (data.rows || []).length === 0 && <p class="small mute">还没有人上榜。第一个就是你！</p>}
          {data && (data.rows || []).length > 0 && (
            <table class="t">
              <thead><tr><th>#</th><th>侠客</th><th>班级</th><th>分数</th><th>判定</th></tr></thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i} style={r.name === s.profile.name && r.cls === s.profile.cls ? { background: 'var(--gold-soft)' } : {}}>
                    <td>{i + 1}</td><td>{r.name}</td><td>{r.cls}</td><td><b>{r.score}</b></td><td>{STRICTNESS[r.strict]?.label || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data?.stale && <p class="small mute">离线中，显示的是上次的榜单。</p>}
        </>
      )}
    </div>
  );
}
