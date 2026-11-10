import { useStore, update } from '../lib/store.js';
import { useToday } from '../lib/hooks.js';
import { chaptersFor, IDIOMS, STORY } from '../lib/data.js';
import { chapterDone } from '../lib/chapters.js';
import { statusOf } from '../lib/srs.js';
import { MODES } from '../lib/run.js';
import { STRICTNESS } from '../lib/progress.js';
import { nextScene, markSeen, storyChapter, bossFor } from '../lib/story.js';
import { rankOf } from '../lib/skills.js';
import { Dialogue } from '../components/Dialogue.jsx';
import { Seal } from '../components/Bits.jsx';

export function Home() {
  const s = useStore();
  const today = useToday();
  const list = chaptersFor(s.profile.menpai);
  const learnt = Object.keys(s.cards).length;
  const secure = Object.values(s.cards).filter((c) => statusOf(c) === 'secure').length;
  const due = Object.values(s.cards).filter((c) => c.due <= today).length;
  const next = list.find((ch) => !chapterDone(s, ch));
  const scene = nextScene(s, STORY, list);
  const c = storyChapter(s, STORY);
  const boss = bossFor(s, STORY, list);
  const total = IDIOMS.filter((it) => s.profile.menpai === 'H2' || it.tracks.includes('H1')).length;
  return (
    <div class="wrap">
      <div class="top">
        <div>
          <h1 class="brush">文渊书院</h1>
          <div class="sub">{s.profile.name || '少侠'} · <span class="rank">{rankOf(secure)}</span></div>
        </div>
        <Seal />
      </div>

      {scene && <Dialogue key={scene.key + scene.title + s.story.queue.length} scene={scene} name={s.profile.name} onDone={() => update((st) => markSeen(st, scene))} />}

      {!scene && (
        <div class="card" style={{ borderLeft: '4px solid var(--seal)' }}>
          {c < STORY.chapters.length ? (
            <>
              <div class="small mute">蚀字之劫 · 第{c + 1}回</div>
              <h2 class="brush" style={{ fontSize: '28px', margin: '2px 0', color: 'var(--seal)' }}>{STORY.chapters[c].boss}</h2>
              <p class="small" style={{ margin: 0 }}>
                {boss.kind === 'story'
                  ? `「${STORY.chapters[c].title}」已在江湖路尽头等你。闯关到最后的心魔，就能击败它。`
                  : `学会藏经阁「${list[c]?.name || ''}」八成的成语，它才会现身。`}
              </p>
            </>
          ) : (
            <>
              <div class="small mute">蚀字之劫 · 终章之后</div>
              <h2 class="brush" style={{ fontSize: '28px', margin: '2px 0' }}>守字人</h2>
              <p class="small" style={{ margin: 0 }}>八大心魔已破。新卷入阁时，蚀字魔的残影还会回来。</p>
            </>
          )}
          <p class="small" style={{ margin: '8px 0 0' }}><a href="#/story">剧情回顾</a></p>
        </div>
      )}

      <div class="stats3">
        <div class="stat"><div class="k">已学成语</div><div class="v">{learnt}<span class="small mute"> / {total}</span></div></div>
        <div class="stat"><div class="k">内力</div><div class="v gold">{s.qi}</div></div>
        <div class="stat"><div class="k">今日待复习</div><div class="v red">{due}</div></div>
      </div>

      {Object.entries(MODES).map(([m, info]) => {
        const ok = learnt >= info.min;
        return (
          <div class="card" key={m}>
            <h2>{info.name} <span class="small mute">· {m === 'short' ? '5–8 分钟 · 4 站' : '15–20 分钟 · 6 站，自选路线'}</span></h2>
            <p class="small mute" style={{ margin: '0 0 10px' }}>
              {m === 'short' ? '两场比武，一处客栈或奇遇，最后对决心魔。' : '一路岔路自己选：比武、大擂台、客栈、奇遇' + (s.profile.menpai === 'H2' ? '、藏书楼' : '') + '，终点是三连心魔。'}
              最高分 {s.best[m] || 0}
            </p>
            {ok ? <a class={`btn ${m === 'short' ? 'primary' : 'gold'} big`} href={`#/run/${m}`}>出发</a>
              : <p class="small" style={{ margin: 0 }}>学会 {info.min} 个成语后开放（还差 {info.min - learnt} 个）。<a href={`#/library/${next ? next.n : 0}`}>去藏经阁</a></p>}
          </div>
        );
      })}

      {next && (
        <div class="card">
          <h2>藏经阁 · {next.name}</h2>
          <p class="small mute" style={{ margin: '0 0 10px' }}>这一卷还有 {next.ids.filter((id) => !s.cards[id]).length} 个成语没学。熟练 {secure} 个。</p>
          <a class="btn" href={`#/library/${next.n}`}>继续学习</a>
        </div>
      )}
      <div class="foot">门派：{s.profile.menpai === 'H2' ? 'H2 华文与文学' : 'H1 华文'} · 笔顺判定：{STRICTNESS[s.profile.strict].label} · <a href="#/settings">设置</a></div>
    </div>
  );
}
