import { play, useAudioReady } from '../lib/audio.js';
import { sceneSrc, comicSrc, ptSrc } from '../lib/art.js';

/** Full-screen ink-wash backdrop behind a screen. strong = heavier paper veil (busy screens like the grid).
 * The URL is made absolute: a relative url() inside a CSS variable resolves against the stylesheet, not the page. */
export function Backdrop({ k, strong }) {
  if (!k) return null;
  return <div class={`backdrop ${strong ? 'strong' : ''}`} style={{ '--img': `url("${new URL(sceneSrc(k), document.baseURI).href}")` }} aria-hidden="true" />;
}

/** A character portrait (style A). */
export function Portrait({ k, size = 'm', alt = '' }) {
  return <img class={`pt pt-${size}`} src={ptSrc(k)} alt={alt} loading="lazy" decoding="async" />;
}

/** The four-panel 典故 comic (style B). With captions it reads as a 连环画; without, it is a picture riddle. */
export function Comic({ it, captions = true }) {
  return (
    <div class="panels">
      {it.panels.map((p, i) => (
        <figure class="panel" key={i}>
          <div class="art">
            {it.comic ? <img src={comicSrc(it.id, i + 1)} alt={captions ? '' : `第${i + 1}格`} loading="lazy" decoding="async" /> : <>{brush(i)}<em>插画待生成</em></>}
            <b>{i + 1}</b>
          </div>
          {captions && <figcaption class="cap serif">{p}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

export function Seal({ children = '成语江湖' }) {
  return <div class="seal brush" aria-hidden="true">{children.slice(0, 2)}<br />{children.slice(2, 4)}</div>;
}

export function Top({ title, sub, back }) {
  return (
    <div>
      {back && <button class="back" onClick={() => (typeof back === 'string' ? (location.hash = back) : history.back())}>‹ 返回</button>}
      <div class="top">
        <div>
          <h1 class="brush">{title}</h1>
          {sub && <div class="sub">{sub}</div>}
        </div>
        <Seal />
      </div>
    </div>
  );
}

export function Say({ item, part = 'w', label }) {
  const ok = useAudioReady();
  if (!ok) return null;
  return (
    <button class="say" aria-label={label || (part === 'w' ? `朗读 ${item.w}` : '朗读例句')} onClick={() => play(item, part)}>
      🔊
    </button>
  );
}

const NUM = '一二三四五六七八';
const brush = (n) => (
  <svg viewBox="0 0 120 90" width="70%" aria-hidden="true">
    <path d="M60 14c-26 0-42 14-42 31s16 31 42 31 42-14 42-31-12-27-30-30" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".28" />
    <text x="60" y="54" text-anchor="middle" font-size="22" font-family="Ma Shan Zheng,serif" fill="currentColor" opacity=".45">{NUM[n]}</text>
  </svg>
);

/** The idiom card: meaning, pinyin, audio, example, usage tip, 典故 storyboard. */
export function IdiomCard({ it, compact }) {
  return (
    <div>
      <div class="ic-head">
        <span class="ic-w">{it.w}</span>
        <span class="ic-py">{it.py}</span>
        <Say item={it} />
      </div>
      <div style={{ marginTop: '6px' }}>
        {it.panels.length > 0 && <span class="chip">有典故</span>}
        {it.exam && <span class="chip src">真题 · {it.exam}</span>}
        {it.src && !it.wenyan && <span class="chip src">出处 · {it.src}</span>}
        {it.wenyan && <span class="chip h2">H2</span>}
      </div>
      <div class="ic-sec"><h4>释义</h4><p class="serif">{it.def}</p><p class="en">{it.en}</p></div>
      <div class="ic-sec">
        <h4>例句</h4>
        <div class="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <p class="serif grow">{splitEx(it)}</p>
          <Say item={it} part="ex" />
        </div>
      </div>
      {it.wenyan && (
        <div class="ic-sec"><h4>原文 · {it.src}</h4><p class="serif" style={{ color: 'var(--ink2)' }}>{it.wenyan}</p></div>
      )}
      {it.tip && <div class="tip"><b>{it.wenyan ? '赏析' : '用法提醒'}</b>　{it.tip}</div>}
      {!compact && it.panels.length > 0 && (
        <div class="ic-sec">
          <h4>典故连环画</h4>
          <Comic it={it} />
          {it.panelNote && <p class="small mute" style={{ marginTop: '6px' }}>{it.panelNote}</p>}
        </div>
      )}
    </div>
  );
}

function splitEx(it) {
  const i = it.ex.indexOf(it.w);
  if (i < 0) return it.ex;
  return <>{it.ex.slice(0, i)}<b style={{ color: 'var(--seal)' }}>{it.w}</b>{it.ex.slice(i + it.w.length)}</>;
}

export function Sheet({ children, onClose }) {
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="sheet" role="dialog">
        <div class="grab" />
        <div class="sheet-in">{children}</div>
      </div>
    </>
  );
}
