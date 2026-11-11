import { useState } from 'preact/hooks';
import { hallOf } from '../lib/menpai.js';
import { useStore, update } from '../lib/store.js';
import { useToday } from '../lib/hooks.js';
import { chaptersFor, IDIOMS, STORY } from '../lib/data.js';
import { chapterDone } from '../lib/chapters.js';
import { statusOf } from '../lib/srs.js';
import { MODES } from '../lib/run.js';
import { STRICTNESS } from '../lib/progress.js';
import { nextScene, markSeen, storyChapter, bossFor } from '../lib/story.js';
import { RANKS, rankOf } from '../lib/skills.js';
import { sceneSrc, figSrc, FIGURE, ptSrc } from '../lib/art.js';
import { Dialogue } from '../components/Dialogue.jsx';
import { MusicToggle } from '../components/Bits.jsx';

/** Who greets the student when no scene is playing: a different 书院 resident each day. */
const HOSTS = ['墨老', '青岚', '小砚'];
function greeting(who, { name, due, learnt, boss }) {
  const n = name || '少侠';
  if (who === '墨老') {
    if (!learnt) return `${n}，先去藏经阁学第一卷。字记在心里，它就偷不走。`;
    if (due) return `今日有 ${due} 个成语该温习了。温故而知新。`;
    return '今日的功课做完了。多学一卷，江湖路就宽一分。';
  }
  if (who === '青岚') {
    if (boss) return `${boss}就在江湖路尽头。${n}，擂台上见！`;
    return '比武不靠运气，靠的是每天写的那几个字。';
  }
  if (!learnt) return `${n}，藏经阁的灯还暗着，我们一起去点亮它吧！`;
  return '你写回来的那几页，在藏经阁里发着光呢！';
}

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
  const [speaker, setSpeaker] = useState(null);

  // Rank progress: secure idioms towards the next 境界.
  const ri = RANKS.findLastIndex(([n]) => secure >= n);
  const [lo] = RANKS[ri];
  const hi = RANKS[ri + 1]?.[0];
  const pct = hi ? Math.round(((secure - lo) / (hi - lo)) * 100) : 100;

  // Main 闯关 button: the longer mode once it is open, otherwise the short one.
  const main = learnt >= MODES.full.min ? 'full' : 'short';
  const other = main === 'full' ? 'short' : 'full';
  const open = (m) => learnt >= MODES[m].min;

  const host = scene ? (FIGURE[speaker] ? speaker : null) : HOSTS[today % HOSTS.length];
  const final = c >= STORY.chapters.length;
  const revealed = final || s.story.pro.includes(c) || boss.kind === 'story';
  const bossName = final ? '蚀字魔·残影' : STORY.chapters[c].boss;

  return (
    <div class="wrap home">
      <section class="hall">
        <div class="hall-bg" style={{ backgroundImage: `url("${new URL(sceneSrc('bg-hub'), document.baseURI).href}")` }} aria-hidden="true" />

        <MusicToggle class="hall-mtog" />
        <header class="plaque">
          <span class="roller" aria-hidden="true" />
          <div class="plaque-in">
            <h1 class="brush">文渊书院</h1>
            <div class="plaque-sub">{s.profile.name || '少侠'} · {hallOf(s.profile.menpai).name}</div>
          </div>
          <span class="roller" aria-hidden="true" />
        </header>

        <div class="hall-hud">
          <div class="realm">
            <div class="realm-k"><b>{rankOf(secure)}</b><span>{hi ? `熟练 ${secure} / ${hi}` : `熟练 ${secure}`}</span></div>
            <div class="realm-bar"><i style={{ width: `${pct}%` }} /></div>
          </div>
          <div class="chips">
            <span class="chip-q" title="内力"><em>内力</em>{s.qi}</span>
            <span class="chip-q" title="已学成语"><em>已学</em>{learnt}<small>/{total}</small></span>
          </div>
        </div>

        {host && <img key={host} class="hall-fig" src={figSrc(FIGURE[host])} alt={host} />}
        {host && !scene && <div class="hall-say serif"><b>{host}</b>{greeting(host, { name: s.profile.name, due, learnt, boss: boss.kind === 'story' ? bossName : '' })}</div>}

        <nav class="gems" aria-label="书院">
          <a class="gem" href={`#/library${next ? `/${next.n}` : ''}`}><span>藏经阁</span></a>
          <a class="gem" href="#/skills"><span>武学</span></a>
          <a class="gem" href="#/story"><span>剧情</span></a>
        </nav>

        {!scene && (
          <div class="go-wrap">
            {open(main) ? (
              <a class="go" href={`#/run/${main}`}>
                <span class="go-in"><b class="brush">闯关</b><small>{MODES[main].name}</small></span>
                {due > 0 && <i class="badge" aria-label={`${due} 个待复习`}>{due}</i>}
              </a>
            ) : (
              <a class="go locked" href={`#/library${next ? `/${next.n}` : ''}`}>
                <span class="go-in"><b class="brush">闯关</b><small>再学 {MODES.short.min - learnt} 个</small></span>
              </a>
            )}
            {open(other) && <a class="go-alt" href={`#/run/${other}`}>{MODES[other].name}</a>}
          </div>
        )}

        {scene && (
          <div class="hall-dlg">
            <Dialogue key={scene.key + scene.title + s.story.queue.length} scene={scene} name={s.profile.name}
              bare onSpeaker={setSpeaker} onDone={() => { setSpeaker(null); update((st) => markSeen(st, scene)); }} />
          </div>
        )}
      </section>

      <a class={`banner ${revealed ? '' : 'veiled'}`} href="#/story"
        style={{ backgroundImage: `url("${new URL(sceneSrc(`boss-${final ? 9 : c + 1}`), document.baseURI).href}")` }}>
        <span class="ribbon">{final ? '终章之后' : `蚀字之劫 · 第${c + 1}回`}</span>
        <div class="banner-txt">
          <b class="brush">{revealed ? bossName : '？？？'}</b>
          <small>
            {final ? '八大心魔已破。新卷入阁时，残影还会回来。'
              : boss.kind === 'story' ? `「${STORY.chapters[c].title}」已在江湖路尽头等你。`
                : `学会藏经阁「${list[c]?.name || ''}」八成的成语，它才会现身。`}
          </small>
        </div>
        {revealed && <img class="banner-pt" src={ptSrc(`boss-${final ? 9 : c + 1}`)} alt="" />}
      </a>

      <div class="modes">
        {Object.entries(MODES).map(([m, info]) => (
          <div class="card mode" key={m}>
            <div class="grow">
              <h3>{info.name} <span class="small mute">· {m === 'short' ? '5–8 分钟 · 4 站' : '15–20 分钟 · 6 站'}</span></h3>
              <p class="small mute" style={{ margin: 0 }}>
                {m === 'short' ? '两场比武，一处客栈或奇遇，最后对决心魔。' : '岔路自选：比武、大擂台、客栈、奇遇' + (s.profile.menpai === 'H2' ? '、藏书楼' : '') + '，终点三连心魔。'}
                {open(m) ? ` 最高分 ${s.best[m] || 0}` : ` 学会 ${info.min} 个成语后开放。`}
              </p>
            </div>
            {open(m) && <a class={`btn ${m === 'short' ? 'primary' : 'gold'}`} href={`#/run/${m}`}>出发</a>}
          </div>
        ))}
      </div>

      {next && (
        <div class="card">
          <h3 style={{ margin: '0 0 4px' }}>藏经阁 · {next.name}</h3>
          <p class="small mute" style={{ margin: '0 0 10px' }}>这一卷还有 {next.ids.filter((id) => !s.cards[id]).length} 个成语没学。熟练 {secure} 个。</p>
          <a class="btn" href={`#/library/${next.n}`}>继续学习</a>
        </div>
      )}
      <div class="foot">门派：{hallOf(s.profile.menpai).name}（{s.profile.menpai}） · 笔顺判定：{STRICTNESS[s.profile.strict].label} · <a href="#/settings">设置</a></div>
    </div>
  );
}

