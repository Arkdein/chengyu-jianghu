import { Fragment } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { useStore, update } from '../lib/store.js';
import { useToday } from '../lib/hooks.js';
import { SKILL, BOOKS, ORIGIN, has, canBuy } from '../lib/skills.js';
import { Top } from '../components/Bits.jsx';

const B = import.meta.env.BASE_URL;
const bookArt = (k) => `${B}art/books/${k}.webp`;

const NUM = '一二三四五六七八';

/** A skill name as a square seal: four characters, read down the right column first. */
function Seal4({ name, kind }) {
  return <span class={`seal4 ${kind}`}><span>{name}</span></span>;
}

function stateOf(s, sk) {
  if (has(s, sk.id)) return 'owned';
  if (sk.req && !has(s, sk.req)) return 'locked';
  return canBuy(s, sk) ? 'ready' : 'open';
}

// ---------------------------------------------------------------- shelf
function Shelf({ s, onOpen }) {
  const info = BOOKS.map((b) => ({
    b,
    got: b.ids.filter((id) => has(s, id)).length,
    ready: b.ids.filter((id) => stateOf(s, SKILL[id]) === 'ready').length,
  }));
  return (
    <div class="shelf">
      <div class="shelf-row">
        {info.map(({ b, got }) => (
          <button class="tome" key={b.id} style={{ backgroundImage: `url(${bookArt(`cover-${b.id}`)})` }} onClick={() => onOpen(b.id)}
            aria-label={`打开《${b.title}》，${b.sub}，已习 ${got} / ${b.ids.length}`}>
            <span class="tome-slip brush">{b.title}</span>
          </button>
        ))}
      </div>
      {/* the shelf's front edge carries a brass plaque under each book */}
      <div class="shelf-board">
        {info.map(({ b, got, ready }) => (
          <button class="plaque-b" key={b.id} onClick={() => onOpen(b.id)} tabIndex={-1} aria-hidden="true">
            <b>{b.sub}</b>
            <span class="pips">{b.ids.map((id) => <i key={id} class={has(s, id) ? 'on' : ''} />)}</span>
            <small>已习 {got} / {b.ids.length}{ready > 0 && <em> · 可修炼 {ready}</em>}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tree page
const GO = (i) => 6 + (i * 88) / 12; // 13-line board, 6% margin

/** Where a node's marker sits on the chart, in %. */
function at(book, id) {
  const p = book.pos[id];
  return book.chart === 'go' ? [GO(p[0]), GO(p[1]), p[2]] : p;
}

function Chart({ book, s }) {
  if (book.chart === 'go') {
    return (
      <svg viewBox="0 0 100 100" class="chart goban" aria-hidden="true">
        {Array.from({ length: 13 }, (_, i) => (
          <g key={i}><line x1={GO(0)} x2={GO(12)} y1={GO(i)} y2={GO(i)} /><line y1={GO(0)} y2={GO(12)} x1={GO(i)} x2={GO(i)} /></g>
        ))}
        {[[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]].map(([x, y]) => <circle key={`${x}${y}`} cx={GO(x)} cy={GO(y)} r=".9" class="star" />)}
        {book.ids.map((id) => {
          const sk = SKILL[id];
          if (!sk.req) return null;
          const [x1, y1] = at(book, sk.req);
          const [x2, y2] = at(book, id);
          return <line key={id} x1={x1} y1={y1} x2={x2} y2={y2} class={`link ${has(s, id) ? 'lit' : ''}`} />;
        })}
      </svg>
    );
  }
  return <img class="chart" src={bookArt(`chart-${book.id}`)} alt="" />;
}

function TreePage({ s, book, onPick }) {
  return (
    <div class="page tree-page">
      <div class="page-head"><span class="brush">{book.title}</span><small>目录 · {book.sub}</small></div>
      <div class={`tree t-${book.chart}`}>
        <Chart book={book} s={s} />
        {book.chart === 'meridian' && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="leaders" aria-hidden="true">
            {book.ids.map((id) => {
              const [x, y, side] = at(book, id);
              return <line key={id} x1={x} y1={y} x2={side === 'l' ? 22 : 78} y2={y} class={has(s, id) ? 'lit' : ''} />;
            })}
          </svg>
        )}
        {book.ids.map((id, i) => {
          const sk = SKILL[id];
          const st = stateOf(s, sk);
          const [x, y, side] = at(book, id);
          const label = `${sk.name}，${st === 'owned' ? '已习得' : `${sk.cost} 内力`}`;
          const lab = (
            <span class="lab">
              <Seal4 name={sk.name} kind={st} />
              <small>{book.points ? `${book.points[i]} · ` : ''}{st === 'owned' ? '已习得' : st === 'locked' ? '未解' : `${sk.cost} 内力`}</small>
            </span>
          );
          if (book.chart === 'meridian') {
            // the acupoint sits on the body; its seal hangs in the margin on a red thread
            return (
              <Fragment key={id}>
                <button class={`tnode c ${st}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => onPick(id)} aria-label={label}><i class="mk dot" /></button>
                <button class={`tnode c ${st}`} style={{ left: `${side === 'l' ? 12 : 88}%`, top: `${y}%` }} onClick={() => onPick(id)} aria-hidden="true" tabIndex={-1}>{lab}</button>
              </Fragment>
            );
          }
          const mark = book.chart === 'go' ? (id.startsWith('qing') ? 'stone black' : 'stone white') : '';
          return (
            <button key={id} class={`tnode ${st} ${side || 'c'}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => onPick(id)} aria-label={label}>
              {mark && <i class={`mk ${mark}`} />}
              {lab}
            </button>
          );
        })}
      </div>
      <p class="page-note serif">{book.note}</p>
    </div>
  );
}

/** Press and hold to spend 内力: a brush stroke fills the button, then the seal is stamped. */
function HoldButton({ onDone, disabled, children }) {
  const [held, setHeld] = useState(false);
  const t = useRef(null);
  const start = (e) => {
    if (disabled || (e.type === 'keydown' && (e.repeat || (e.key !== 'Enter' && e.key !== ' ')))) return;
    e.preventDefault();
    setHeld(true);
    t.current = setTimeout(() => { setHeld(false); onDone(); }, 1000);
  };
  const stop = () => { clearTimeout(t.current); setHeld(false); };
  return (
    <button class={`btn gold big hold ${held ? 'held' : ''}`} disabled={disabled}
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onKeyDown={start} onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}>
      <span class="hold-ink" aria-hidden="true" />
      <span class="hold-txt">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------- skill page
function SkillPage({ s, book, id, onBuy, stamped }) {
  const sk = SKILL[id];
  const st = stateOf(s, sk);
  const i = book.ids.indexOf(id);
  return (
    <div class="page skill-page">
      <div class="page-head"><span class="brush">{book.title}</span><small>第{NUM[i]}式</small></div>
      <div class="sp-top">
        <div>
          <h2 class="brush sp-name">{sk.name}</h2>
          <div class="sp-src">出自 {sk.src}</div>
        </div>
        {st === 'owned' && <span class={`sp-stamp ${stamped ? 'slam' : ''}`}><Seal4 name={sk.name} kind="owned" /></span>}
      </div>
      <img class="sp-vig" src={bookArt(`v-${id}`)} alt="" />
      <div class="sp-orig-wrap"><div class="sp-orig serif">{sk.text}</div></div>
      <div class="sp-sec"><h4>由来</h4><p class="serif">{ORIGIN[id]}</p></div>
      <div class="sp-sec"><h4>释义</h4><p class="serif">{sk.mean}</p></div>
      <div class="sp-eff"><b>功效</b>　{sk.effect}</div>
      <div class="sp-act">
        {st === 'owned' ? <span class="small mute">已收入你的秘籍。</span>
          : st === 'locked' ? <span class="small mute">先习得上一式「{SKILL[sk.req].name}」。</span>
            : (
              <>
                <HoldButton disabled={st !== 'ready'} onDone={() => onBuy(sk)}>按住修炼 <span class="cost">{sk.cost} 内力</span></HoldButton>
                {st === 'ready' && <div class="small mute" style={{ marginTop: '6px' }}>按住约一秒，确认花费内力。</div>}
              </>
            )}
        {st === 'open' && <div class="small mute" style={{ marginTop: '6px' }}>还差 {sk.cost - s.qi} 内力。闯关、客栈、奇遇都能赚。</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- screen
export function Skills() {
  const s = useStore();
  const today = useToday();
  const [bookId, setBookId] = useState(null);
  const [page, setPage] = useState(null); // null = tree page, else a skill id
  const [turn, setTurn] = useState(0); // bumps on every page turn so the flip animation replays
  const [dir, setDir] = useState('fwd');
  const [stamped, setStamped] = useState(null);
  const book = BOOKS.find((b) => b.id === bookId);

  const go = (p, d = 'fwd') => { setDir(d); setPage(p); setTurn((t) => t + 1); setStamped(null); };
  const buy = (sk) => {
    if (!canBuy(s, sk)) return;
    update((st) => ({ ...st, qi: st.qi - sk.cost, skills: { ...st.skills, [sk.id]: today } }));
    setStamped(sk.id);
  };

  if (!book) {
    return (
      <div class="wrap">
        <Top title="武学" sub={`藏经阁里的三部秘籍 · 现有内力 ${s.qi}`} />
        <Shelf s={s} onOpen={(id) => { setBookId(id); setPage(null); setTurn((t) => t + 1); setDir('open'); }} />
        <p class="small mute shelf-tip">每门武学都出自古籍。翻开秘籍，点一式看它的由来，攒够内力就能修炼。走火入魔赚到的内力也算数。</p>
      </div>
    );
  }

  const idx = page ? book.ids.indexOf(page) : -1;
  return (
    <div class="wrap">
      <div class="row book-bar">
        <button class="back" onClick={() => (page ? go(null, 'back') : setBookId(null))}>‹ {page ? '目录' : '书架'}</button>
        <span class="chip-q qi-chip"><em>内力</em>{s.qi}</span>
      </div>
      <div class="book" style={{ '--cover': `url(${bookArt(`cover-${book.id}`)})` }}>
        <div key={turn} class={`leaf ${dir}`}>
          {page ? <SkillPage s={s} book={book} id={page} onBuy={buy} stamped={stamped === page} /> : <TreePage s={s} book={book} onPick={(id) => go(id)} />}
        </div>
        <span class="book-bind" aria-hidden="true" />
      </div>
      {page && (
        <div class="row book-nav">
          <button class="btn" disabled={idx <= 0} onClick={() => go(book.ids[idx - 1], 'back')}>‹ 上一式</button>
          <button class="btn" disabled={idx >= book.ids.length - 1} onClick={() => go(book.ids[idx + 1])}>下一式 ›</button>
        </div>
      )}
    </div>
  );
}
