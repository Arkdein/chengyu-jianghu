import { useStore } from '../lib/store.js';
import { STORY } from '../lib/data.js';
import { seenStory, fill } from '../lib/story.js';
import { Top, Portrait } from '../components/Bits.jsx';

export function Story() {
  const s = useStore();
  const parts = seenStory(s, STORY);
  return (
    <div class="wrap">
      <Top title="剧情回顾" sub="蚀字之劫 · 已解锁的章节" back="#/" />
      {parts.length === 0 && <p class="small mute">还没有解锁剧情。</p>}
      {parts.map((p, i) => (
        <div class="card" key={i}>
          <h3 class="serif">{p.title}</h3>
          {p.lines.map((l, j) => (
            <p key={j} class="serif" style={{ margin: '6px 0', lineHeight: 1.7 }}>
              {l.s === '心得' ? <span class="tip" style={{ display: 'block' }}><b>心得</b>　{fill(l.t, s.profile.name)}</span>
                : <>{l.s !== '旁白' && <b>{l.s}：</b>}{fill(l.t, s.profile.name)}</>}
            </p>
          ))}
        </div>
      ))}
      <div class="card">
        <h3>心魔谱</h3>
        {STORY.chapters.map((ch, c) => (
          <div class="idiom-row" key={c}>
            {s.story.beaten.includes(c) || s.story.pro.includes(c)
              ? <Portrait k={`boss-${c + 1}`} size="xs" alt="" />
              : <span class={`dot ${s.story.beaten.includes(c) ? 'secure' : ''}`} />}
            <span class="grow serif">{s.story.beaten.includes(c) || s.story.pro.includes(c) ? `${ch.boss}（${ch.flaw}）` : '？？？'}</span>
            <span class="small mute">{s.story.beaten.includes(c) ? ch.lesson.split('：')[0] : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
