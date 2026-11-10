import { useStore } from '../lib/store.js';
import { useToday } from '../lib/hooks.js';
import { CHAPTERS, IDIOMS } from '../lib/data.js';
import { statusOf } from '../lib/srs.js';
import { MIN_LEARNT } from '../lib/run.js';
import { STRICTNESS } from '../lib/progress.js';

export function Home() {
  const s = useStore();
  const today = useToday();
  const learnt = Object.keys(s.cards).length;
  const secure = Object.values(s.cards).filter((c) => statusOf(c) === 'secure').length;
  const due = Object.values(s.cards).filter((c) => c.due <= today).length;
  const next = CHAPTERS.find((ch) => ch.ids.some((id) => !s.cards[id]));
  const nextLeft = next ? next.ids.filter((id) => !s.cards[id]).length : 0;
  const canRun = learnt >= MIN_LEARNT;
  const name = s.profile.name;
  return (
    <div class="wrap">
      <div class="hero">
        <h1 class="big brush">成语江湖</h1>
        <p>看意思，想成语，一笔一画亲手写。</p>
        {name && <p style={{ color: 'var(--ink2)' }}>{name}，欢迎回来。</p>}
      </div>
      <div class="stats3">
        <div class="stat"><div class="k">已学成语</div><div class="v">{learnt}<span class="small mute"> / {IDIOMS.length}</span></div></div>
        <div class="stat"><div class="k">内力（累计）</div><div class="v gold">{s.qi}</div></div>
        <div class="stat"><div class="k">最高分</div><div class="v red">{s.best.short || 0}</div></div>
      </div>

      <div class="card">
        <h2>小试身手 <span class="small mute">· 5–8 分钟</span></h2>
        <p class="small mute" style={{ margin: '0 0 10px' }}>两场比武，一处客栈或奇遇，最后对决心魔。</p>
        {canRun ? (
          <a class="btn primary big" href="#/run/short">出发行走江湖</a>
        ) : (
          <>
            <p class="small" style={{ margin: '0 0 10px' }}>先到藏经阁学完第一卷（{MIN_LEARNT} 个成语），才能闯关。还差 {MIN_LEARNT - learnt} 个。</p>
            <a class="btn primary" href="#/library/0">去藏经阁</a>
          </>
        )}
        <p class="small mute" style={{ margin: '10px 0 0' }}>笔顺判定：{STRICTNESS[s.profile.strict].label}（得分 ×{STRICTNESS[s.profile.strict].mult}）· <a href="#/settings">更改</a></p>
      </div>

      {next && (
        <div class="card">
          <h2>藏经阁 · {next.name}</h2>
          <p class="small mute" style={{ margin: '0 0 10px' }}>这一卷还有 {nextLeft} 个成语没学。</p>
          <a class="btn" href={`#/library/${next.n}`}>继续学习</a>
        </div>
      )}

      {learnt > 0 && (
        <div class="card">
          <h3>修为</h3>
          <p class="small" style={{ margin: 0 }}>熟练 {secure} 个 · 今天该复习 {due} 个。闯关时会优先出现该复习、常写错的成语。</p>
        </div>
      )}
      <div class="foot">门派：{s.profile.menpai === 'H2' ? 'H2 华文与文学' : 'H1 华文'} · <a href="#/settings">设置</a></div>
    </div>
  );
}
