import { useStore } from '../lib/store.js';
import { CHAPTERS, BY_ID, chaptersFor } from '../lib/data.js';
import { chapterDone } from '../lib/chapters.js';
import { statusOf } from '../lib/srs.js';
import { Top } from '../components/Bits.jsx';

const STATUS = { new: '未学', learning: '初学', reviewing: '复习中', secure: '熟练' };

/** i = position in the student's own chapter list */
export function unlocked(s, list, i) {
  return i <= 0 || chapterDone(s, list[i - 1]);
}

export function Library({ ch }) {
  const s = useStore();
  const list = chaptersFor(s.profile.menpai);
  if (ch != null && CHAPTERS[ch]) return <Chapter s={s} ch={CHAPTERS[ch]} pos={list.indexOf(CHAPTERS[ch])} />;
  return (
    <div class="wrap">
      <Top title="藏经阁" sub="学新成语：意思、读音、笔顺、典故" />
      {list.map((c, i) => {
        const done = c.ids.filter((id) => s.cards[id]).length;
        const open = unlocked(s, list, i);
        return (
          <a class={`card ch ${open ? '' : 'locked'}`} href={open ? `#/library/${c.n}` : undefined} key={c.n}>
            <div class="no">{c.name.replace('溯源·', '').slice(0, 2)}</div>
            <div class="grow">
              <h3>{c.name} {c.track === 'H2' && <span class="chip h2">溯源 · 原文</span>}</h3>
              <div class="small mute">{c.ids.slice(0, 4).map((id) => BY_ID[id].w).join('、')}……</div>
              <div class="bar" style={{ marginTop: '8px' }}><i style={{ width: `${(done / c.ids.length) * 100}%` }} /></div>
              <div class="small mute" style={{ marginTop: '4px' }}>{open ? `已学 ${done} / ${c.ids.length}` : '学完上一卷八成后开放'}</div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function Chapter({ s, ch, pos }) {
  const next = ch.ids.find((id) => !s.cards[id]);
  return (
    <div class="wrap">
      <Top title={ch.name} sub={`藏经阁 · 第 ${pos + 1} 卷`} back="#/library" />
      {next && <a class="btn primary big" style={{ marginBottom: '12px' }} href={`#/learn/${next}`}>学下一个：{BY_ID[next].w.replace(/./g, '□')}</a>}
      <div class="card">
        {ch.ids.map((id) => {
          const it = BY_ID[id];
          const st = statusOf(s.cards[id]);
          const learnt = !!s.cards[id];
          return (
            <a class="idiom-row" href={`#/learn/${id}`} key={id}>
              <span class={`dot ${st}`} />
              <span class="grow">
                <span class="w">{learnt ? it.w : '□□□□'.slice(0, it.w.length)}</span>
                {learnt && <span class="py"> {it.py}</span>}
              </span>
              <span class="small mute">{STATUS[st]}</span>
            </a>
          );
        })}
      </div>
      <p class="small mute">未学的成语先盖住，学的时候才揭晓，免得闯关前就“剧透”。</p>
    </div>
  );
}
