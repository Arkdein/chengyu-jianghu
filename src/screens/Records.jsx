import { useStore } from '../lib/store.js';
import { useToday } from '../lib/hooks.js';
import { BY_ID } from '../lib/data.js';
import { statusOf } from '../lib/srs.js';
import { STRICTNESS } from '../lib/progress.js';
import { isoFromDay } from '../lib/dates.js';
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
  const runs = s.runs.slice().reverse().slice(0, 15);
  const week = s.runs.filter((r) => r.day > today - 7 && !r.failed);
  const weekBest = week.reduce((m, r) => Math.max(m, r.score), 0);
  return (
    <div class="wrap">
      <Top title="战绩" sub="分数、修为与心魔" />
      <div class="stats3">
        <div class="stat"><div class="k">历史最高分</div><div class="v red">{s.best.short || 0}</div></div>
        <div class="stat"><div class="k">本周最高分</div><div class="v">{weekBest}</div></div>
        <div class="stat"><div class="k">内力（累计）</div><div class="v gold">{s.qi}</div></div>
      </div>
      <div class="card">
        <h3>修为</h3>
        <p class="small" style={{ margin: 0 }}>初学 {by.learning} · 复习中 {by.reviewing} · 熟练 {by.secure}</p>
        <p class="small mute" style={{ margin: '6px 0 0' }}>闯关时写对、不靠帮助，成语就会往“熟练”走一步；点穴揭字会让它退回去。</p>
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
            <thead><tr><th>日期</th><th>分数</th><th>成语</th><th>判定</th></tr></thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i}>
                  <td>{isoFromDay(r.day).slice(5)}</td>
                  <td>{r.failed ? <span class="mute">走火入魔</span> : <b>{r.score}</b>}</td>
                  <td>{r.idioms}</td>
                  <td>{STRICTNESS[r.strict]?.label || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p class="small mute">全班擂台榜会在下一阶段上线，分数按“纯分数”排名，并标明笔顺判定设置。</p>
    </div>
  );
}
