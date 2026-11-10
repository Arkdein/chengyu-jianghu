import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore, update, getState } from '../lib/store.js';
import { useToday } from '../lib/hooks.js';
import { BY_ID, IDIOMS } from '../lib/data.js';
import { applyReview } from '../lib/srs.js';
import { STRICTNESS } from '../lib/progress.js';
import { planRun, quiz, score, outcome, MIN_LEARNT, START_HP, START_QI, COST, GAIN } from '../lib/run.js';
import { rng } from '../lib/grid.js';
import { HanziPad } from '../components/HanziPad.jsx';
import { IdiomCard, Sheet } from '../components/Bits.jsx';

const NODE_NAME = { duel: '比武', fork: '岔路', inn: '客栈', encounter: '奇遇', boss: '心魔' };

function emptyRec() {
  return { solved: false, reveals: 0, hints: 0, traces: 0, mistakes: 0, quiz: null };
}

export function Run() {
  const s = useStore();
  const today = useToday();
  const learnt = Object.keys(s.cards).length;
  const [seed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const plan = useMemo(() => (learnt >= MIN_LEARNT ? planRun(getState(), today, IDIOMS, seed) : null), [seed]);
  const strict = s.profile.strict;
  const [R, setR] = useState(() => ({
    node: 0, fork: null, hp: START_HP, qi: START_QI, qiEarned: 0, t0: Date.now(),
    charsWritten: 0, reveals: 0, bossPerfect: 0, idiomsSolved: 0, recs: {}, end: null,
  }));
  const Rref = useRef(R);
  Rref.current = R;
  const [quit, setQuit] = useState(false);
  const [toast, setToast] = useState('');
  const toastT = useRef(null);
  const say = (t) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 1600); };

  // ---- shared actions (functional updates so rapid events never lose a change)
  const rec = (st, id) => st.recs[id] || emptyRec();
  const act = {
    hurt(n, id, kind = 'mistakes') {
      setR((st) => {
        const r = { ...rec(st, id) };
        if (id) r[kind] += 1;
        const hp = Math.max(0, st.hp - n);
        const next = { ...st, hp, recs: id ? { ...st.recs, [id]: r } : st.recs };
        return hp <= 0 && !st.finish ? { ...next, finish: 'fail' } : next;
      });
    },
    spend(n, id, kind) {
      if (Rref.current.qi < n || Rref.current.end) return false;
      Rref.current = { ...Rref.current, qi: Rref.current.qi - n };
      setR((st) => {
        const r = { ...rec(st, id) };
        r[kind] += 1;
        return { ...st, qi: st.qi - n, reveals: st.reveals + (kind === 'reveals' ? 1 : 0), recs: { ...st.recs, [id]: r } };
      });
      return true;
    },
    wrote(n = 1) { setR((st) => ({ ...st, charsWritten: st.charsWritten + n })); },
    solved(id) {
      setR((st) => ({
        ...st, idiomsSolved: st.idiomsSolved + 1, qi: st.qi + GAIN.idiomQi, qiEarned: st.qiEarned + GAIN.idiomQi,
        recs: { ...st.recs, [id]: { ...rec(st, id), solved: true } },
      }));
    },
    quizResult(id, right, qiGain, hpLoss) {
      setR((st) => {
        const r = { ...rec(st, id), quiz: right };
        const hp = Math.max(0, st.hp - (right ? 0 : hpLoss));
        const next = { ...st, hp, qi: st.qi + (right ? qiGain : 0), qiEarned: st.qiEarned + (right ? qiGain : 0), recs: { ...st.recs, [id]: r } };
        return hp <= 0 && !st.finish ? { ...next, finish: 'fail' } : next;
      });
    },
    heal(n) { setR((st) => ({ ...st, hp: Math.min(START_HP, st.hp + n) })); },
    bossPerfect() { setR((st) => ({ ...st, bossPerfect: st.bossPerfect + 1 })); },
    next() { setR((st) => (st.node + 1 >= plan.nodes.length ? { ...st, finish: st.finish || 'win' } : { ...st, node: st.node + 1 })); },
    choose(fork) { setR((st) => ({ ...st, fork })); },
    toast: say,
  };

  // Save once, after the run is decided (never from inside a state updater).
  const saved = useRef(false);
  useEffect(() => {
    if (!R.finish || saved.current) return;
    saved.current = true;
    const end = finishRun(R, R.finish === 'fail');
    setR((st) => ({ ...st, end }));
  }, [R.finish]);

  if (!plan) {
    return (
      <div class="wrap full">
        <p>先到藏经阁学完第一卷，才能闯关。</p>
        <a class="btn primary" href="#/library/0">去藏经阁</a>
      </div>
    );
  }

  function finishRun(st, failed) {
    const secs = Math.round((Date.now() - st.t0) / 1000);
    const sc = score({ charsWritten: st.charsWritten, idiomsSolved: st.idiomsSolved, hp: st.hp, secs, reveals: st.reveals, bossPerfect: st.bossPerfect, strict });
    // save progress once
    const ids = Object.keys(st.recs);
    update((g) => {
      const cards = { ...g.cards };
      for (const id of ids) {
        if (!cards[id]) continue;
        const r = st.recs[id];
        const o = r.quiz !== null && !r.solved && r.mistakes + r.reveals === 0 ? (r.quiz ? 'good' : 'again') : outcome(r);
        cards[id] = applyReview(cards[id], o, today);
      }
      const runs = [...g.runs, { day: today, mode: 'short', score: failed ? 0 : sc.total, raw: sc.raw, strict, idioms: st.idiomsSolved, failed, secs }].slice(-60);
      const best = { ...g.best };
      if (!failed && sc.total > (best.short || 0)) best.short = sc.total;
      return { ...g, cards, qi: g.qi + st.qiEarned, runs, best };
    });
    return { failed, sc, secs };
  }

  const node = plan.nodes[R.node];
  const kind = node.type === 'fork' ? R.fork || 'fork' : node.type;
  const leniency = STRICTNESS[strict].leniency;

  return (
    <div class="wrap full">
      <div class="row" style={{ justifyContent: 'space-between' }}>
        <button class="back" onClick={() => setQuit(true)}>‹ 撤退</button>
        <span class="small mute">小试身手 · 第 {R.node + 1} / {plan.nodes.length} 站</span>
      </div>
      <Route plan={plan} cur={R.node} fork={R.fork} />
      <div class="stats3">
        <div class="stat"><div class="k">气血</div><div class="v">{R.hp}</div><div class="bar hp"><i style={{ width: `${R.hp}%` }} /></div></div>
        <div class="stat"><div class="k">内力</div><div class="v gold">{R.qi}</div></div>
        <div class="stat"><div class="k">成语</div><div class="v">{R.idiomsSolved}</div></div>
      </div>

      {kind === 'duel' && <Duel key={`d${R.node}`} grid={node.grid} R={R} act={act} leniency={leniency} title={R.node === 0 ? '第一场比武' : '第二场比武'} />}
      {kind === 'fork' && <Fork onPick={act.choose} />}
      {kind === 'inn' && <Inn key="inn" s={s} seed={plan.seed} act={act} />}
      {kind === 'encounter' && <Encounter key="enc" s={s} seed={plan.seed} act={act} />}
      {kind === 'boss' && <Boss key="boss" ids={node.ids} R={R} act={act} leniency={leniency} />}

      {R.end && <EndCard R={R} strict={strict} />}
      {quit && !R.end && (
        <div class="over"><div class="ocard">
          <h2 class="brush" style={{ fontSize: '34px' }}>撤退？</h2>
          <p class="small">本局不计分，赚到的内力也不会入库。已学的成语进度不受影响。</p>
          <div class="row center">
            <a class="btn primary" href="#/">撤退</a>
            <button class="btn" onClick={() => setQuit(false)}>继续闯关</button>
          </div>
        </div></div>
      )}
      {toast && <div class="toast">{toast}</div>}
    </div>
  );
}

function Route({ plan, cur, fork }) {
  return (
    <div class="route" aria-label="本局路线">
      {plan.nodes.map((n, i) => (
        <Fragment key={i}>
          {i > 0 && <div class="ln" />}
          <div class={`n ${i < cur ? 'done' : i === cur ? 'cur' : ''}`}>
            <span class="d" />
            {n.type === 'fork' ? (fork && i <= cur ? NODE_NAME[fork] : '客栈/奇遇') : NODE_NAME[n.type]}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 比武: crossword
function Duel({ grid, R, act, leniency, title }) {
  const [filled, setFilled] = useState(() => Object.fromEntries(Object.entries(grid.cells).map(([k, c]) => [k, c.given ? 'given' : ''])));
  const [sel, setSel] = useState(null); // word index
  const [target, setTarget] = useState(null); // cell key being written
  const [hinted, setHinted] = useState(() => new Set());
  const [card, setCard] = useState(null); // [word indices] just solved
  const [outlineKey, setOutlineKey] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [msg, setMsg] = useState({ t: '想出成语，按正确笔顺写出 ？ 处的字', c: '' });
  const [pop, setPop] = useState(null);
  const solved = useRef(new Set());
  const nums = useMemo(() => {
    const out = {};
    let n = 0;
    const starts = [...new Set(grid.words.map((w) => w.cells[0]))].sort((a, b) => {
      const [ra, ca] = a.split(',').map(Number);
      const [rb, cb] = b.split(',').map(Number);
      return ra - rb || ca - cb;
    });
    starts.forEach((k) => { out[k] = ++n; });
    return out;
  }, [grid]);
  const label = (i) => `${nums[grid.words[i].cells[0]]} ${grid.words[i].d === 'A' ? '横' : '竖'}`;
  const isFilled = (k) => !!filled[k];
  const allDone = grid.words.every((w, i) => solved.current.has(i));

  const openCell = (k, wi) => {
    setSel(wi);
    if (isFilled(k)) { setTarget(null); if (solved.current.has(wi)) setCard([wi]); return; }
    setTarget(k);
    setOutlineKey(0);
    setRevealKey(0);
    setMsg({ t: '想出成语，按正确笔顺写出 ？ 处的字', c: '' });
  };
  const tapCell = (k) => {
    const ws = grid.cells[k].words;
    let wi = ws.find((w) => !solved.current.has(w)) ?? ws[0];
    if (ws.length > 1 && sel !== null && ws.includes(sel)) wi = target === k ? ws.find((w) => w !== sel) : sel;
    openCell(k, wi);
  };

  const fill = (k, how) => {
    const nextFilled = { ...filled, [k]: how };
    setFilled(nextFilled);
    setPop(k);
    if (how === 'solved') act.wrote();
    const newly = grid.cells[k].words.filter((wi) => !solved.current.has(wi) && grid.words[wi].cells.every((c) => nextFilled[c]));
    newly.forEach((wi) => { solved.current.add(wi); act.solved(grid.words[wi].id); });
    if (newly.length) { setTarget(null); setCard(newly); return; }
    const w = grid.words[sel];
    const nk = w.cells.find((c) => !nextFilled[c]);
    if (nk) openCell(nk, sel);
    else setTarget(null);
  };

  const w = sel !== null ? grid.words[sel] : null;
  const it = w ? BY_ID[w.id] : null;

  return (
    <>
      <div class="board">
        <div class="small mute" style={{ marginBottom: '6px' }}>{title} · 共 {grid.words.length} 个成语</div>
        <div class="grid" style={{ gridTemplateColumns: `repeat(${grid.cols}, 1fr)`, maxWidth: `${grid.cols * 46}px` }}>
          {Array.from({ length: grid.rows * grid.cols }, (_, i) => {
            const k = `${Math.floor(i / grid.cols)},${i % grid.cols}`;
            const c = grid.cells[k];
            if (!c) return <div class="cell blank" key={k} />;
            const f = filled[k];
            const inword = w && w.cells.includes(k);
            return (
              <button key={k} class={`cell box ${f ? 'filled' : ''} ${f === 'given' ? 'given' : ''} ${f === 'revealed' ? 'revealed' : ''} ${inword ? 'inword' : ''} ${target === k ? 'target' : ''} ${pop === k ? 'pop' : ''}`}
                onClick={() => tapCell(k)} aria-label={f ? c.ch : '空格'}>
                {nums[k] && <span class="no">{nums[k]}</span>}
                {f ? c.ch : ''}
              </button>
            );
          })}
        </div>
      </div>

      {allDone ? (
        <div class="card" style={{ marginTop: '12px', textAlign: 'center' }}>
          <h2 class="brush" style={{ fontSize: '30px', color: 'var(--seal)' }}>比武告捷</h2>
          <button class="btn primary big" onClick={act.next}>继续前进</button>
        </div>
      ) : (
        <div class="clue" style={!w ? { borderLeftColor: 'var(--line)' } : {}}>
          <div class="lab">{w ? label(sel) + (solved.current.has(sel) ? ' · 已破解' : '') : '点一个空格开始'}</div>
          <div class="txt">{w ? (solved.current.has(sel) ? <><b>{it.w}</b>　{it.clue}</> : it.clue) : <span class="mute small">每个空格都要亲手写。线索只给意思，不给字。</span>}</div>
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        <div class="small mute">全部线索 · 已破 {solved.current.size} / {grid.words.length}</div>
        {grid.words.map((ww, i) => ({ ww, i })).sort((a, b) => nums[a.ww.cells[0]] - nums[b.ww.cells[0]] || (a.ww.d < b.ww.d ? -1 : 1)).map(({ ww, i }) => {
          const ok = solved.current.has(i);
          const x = BY_ID[ww.id];
          return (
            <button class={`li ${ok ? 'ok' : ''}`} key={i} onClick={() => { if (ok) { setSel(i); setCard([i]); return; } const k = ww.cells.find((c) => !filled[c]); if (k) openCell(k, i); }}>
              <span class="tag">{label(i)}</span>
              <span>{ok && <span class="w">{x.w}　</span>}{x.clue}</span>
            </button>
          );
        })}
      </div>

      {target && w && (
        <Sheet onClose={() => setTarget(null)}>
          <div class="clue" style={{ marginTop: 0, boxShadow: 'none' }}>
            <div class="lab">{label(sel)}</div>
            <div class="txt">{it.clue}</div>
            {hinted.has(sel) && <div class="hint">{it.hint}</div>}
          </div>
          <div class="pattern">
            {w.cells.map((c) => <span class={c === target ? 'cur' : ''} key={c}>{filled[c] ? grid.cells[c].ch : c === target ? '?' : ''}</span>)}
          </div>
          <div class="padwrap">
            <HanziPad char={grid.cells[target].ch} mode="quiz" leniency={leniency} runKey={target}
              outlineKey={outlineKey} revealKey={revealKey}
              onMistake={() => { act.hurt(COST.stroke, w.id); setMsg({ t: '这一笔不对（−2 气血）。想想是哪个字？', c: 'bad' }); }}
              onStroke={() => setMsg({ t: '好，继续', c: '' })}
              onComplete={() => { setMsg({ t: '一字落定！', c: 'good' }); setTimeout(() => fill(target, 'solved'), 300); }}
            />
          </div>
          <div class={`padmsg ${msg.c}`}>{msg.t}</div>
          <div class="row center">
            <button class="btn gold" disabled={hinted.has(sel)} onClick={() => {
              if (!act.spend(COST.hint, w.id, 'hints')) return act.toast('内力不足');
              setHinted(new Set([...hinted, sel]));
            }}>💡 线索 <span class="cost">−{COST.hint} 内力</span></button>
            <button class="btn" onClick={() => { act.hurt(COST.trace, w.id, 'traces'); setOutlineKey(outlineKey + 1); setMsg({ t: '描红：沿着淡色字形按笔顺写', c: '' }); }}>
              描红 <span class="cost">−{COST.trace} 气血</span>
            </button>
            <button class="btn gold" onClick={() => {
              if (!act.spend(COST.reveal, w.id, 'reveals')) return act.toast('内力不足');
              setRevealKey(revealKey + 1);
              setMsg({ t: '点穴！此字已揭开（不计书写分）', c: '' });
              const k = target;
              setTimeout(() => fill(k, 'revealed'), 700);
            }}>点穴·揭字 <span class="cost">−{COST.reveal} 内力</span></button>
            {grid.cells[target].words.length > 1 && <button class="btn" onClick={() => setSel(grid.cells[target].words.find((x) => x !== sel))}>⇄ 换方向</button>}
            <button class="btn" onClick={() => setTarget(null)}>收起</button>
          </div>
        </Sheet>
      )}

      {card && (
        <Sheet onClose={() => setCard(null)}>
          <IdiomCard it={BY_ID[grid.words[card[0]].id]} compact />
          <div class="row center" style={{ marginTop: '14px' }}>
            <button class="btn primary" onClick={() => setCard(card.length > 1 ? card.slice(1) : null)}>{card.length > 1 ? '下一个已破成语' : '继续'}</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

// ---------------------------------------------------------------- 岔路
function Fork({ onPick }) {
  return (
    <div>
      <h2 class="brush" style={{ fontSize: '30px', margin: '6px 0' }}>前方岔路</h2>
      <button class="choice" onClick={() => onPick('inn')}>
        <b>客栈</b> <span class="small mute">· 休息复习</span>
        <div class="small" style={{ marginTop: '4px' }}>恢复 {GAIN.innHeal} 气血。答对语境题，每题 +{GAIN.innQi} 内力。</div>
      </button>
      <button class="choice" onClick={() => onPick('encounter')}>
        <b>奇遇</b> <span class="small mute">· 典故考验</span>
        <div class="small" style={{ marginTop: '4px' }}>认出典故说的是哪个成语：答对 +{GAIN.encounterQi} 内力，答错 −{GAIN.encounterHurt} 气血。</div>
      </button>
    </div>
  );
}

function learntItems(s) {
  return IDIOMS.filter((it) => s.cards[it.id]);
}

// ---------------------------------------------------------------- 客栈: heal + 3 context questions
function Inn({ s, seed, act }) {
  const qs = useMemo(() => {
    const rand = rng(seed + 11);
    const pool = learntItems(s);
    const picks = pool.slice().sort(() => rand() - 0.5).slice(0, 3);
    return picks.map((t) => ({ t, opts: quiz(t, pool, 3, rand) }));
  }, []);
  const [healed, setHealed] = useState(false);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  if (!healed) {
    return (
      <div class="card" style={{ textAlign: 'center' }}>
        <h2 class="brush" style={{ fontSize: '30px' }}>悦来客栈</h2>
        <p class="small">喝碗热茶，养养精神。</p>
        <button class="btn primary big" onClick={() => { act.heal(GAIN.innHeal); setHealed(true); }}>歇脚（+{GAIN.innHeal} 气血）</button>
      </div>
    );
  }
  if (i >= qs.length) {
    return (
      <div class="card" style={{ textAlign: 'center' }}>
        <p>掌柜说：“客官慢走！”</p>
        <button class="btn primary big" onClick={act.next}>继续前进</button>
      </div>
    );
  }
  const q = qs[i];
  return (
    <div class="card">
      <div class="small mute">客栈小考 · {i + 1} / {qs.length}</div>
      <p class="serif" style={{ fontSize: '17px', lineHeight: 1.7 }}>{q.t.ctx}</p>
      {q.opts.map((o) => (
        <button class={`opt ${pick ? (o.id === q.t.id ? 'right' : o.id === pick ? 'wrong' : '') : ''}`} disabled={!!pick}
          onClick={() => { setPick(o.id); act.quizResult(q.t.id, o.id === q.t.id, GAIN.innQi, 0); }}>{o.w}</button>
      ))}
      {pick && <div class="row center"><button class="btn primary" onClick={() => { setPick(null); setI(i + 1); }}>下一题</button></div>}
    </div>
  );
}

// ---------------------------------------------------------------- 奇遇: recognise the 典故
function Encounter({ s, seed, act }) {
  const q = useMemo(() => {
    const rand = rng(seed + 23);
    const pool = learntItems(s);
    const dg = pool.filter((it) => it.panels.length);
    const t = (dg.length ? dg : pool)[Math.floor(rand() * (dg.length || pool.length))];
    return { t, opts: quiz(t, pool, 4, rand), story: !!t.panels.length };
  }, []);
  const [pick, setPick] = useState(null);
  return (
    <div class="card">
      <h2 class="brush" style={{ fontSize: '30px', margin: '0 0 6px' }}>奇遇</h2>
      <p class="small mute">{q.story ? '路边茶摊，一位说书人讲起一个故事……' : '一位老者考你：'}</p>
      <p class="serif" style={{ fontSize: '17px', lineHeight: 1.7 }}>{q.story ? q.t.panels.join('') : q.t.clue}</p>
      <p class="small">这说的是哪个成语？</p>
      {q.opts.map((o) => (
        <button class={`opt ${pick ? (o.id === q.t.id ? 'right' : o.id === pick ? 'wrong' : '') : ''}`} disabled={!!pick}
          onClick={() => { setPick(o.id); act.quizResult(q.t.id, o.id === q.t.id, GAIN.encounterQi, GAIN.encounterHurt); }}>{o.w}</button>
      ))}
      {pick && (
        <>
          <p class="small" style={{ color: pick === q.t.id ? 'var(--jade)' : 'var(--seal)' }}>{pick === q.t.id ? `答对了！+${GAIN.encounterQi} 内力` : `是「${q.t.w}」。−${GAIN.encounterHurt} 气血`}</p>
          <div class="row center"><button class="btn primary" onClick={act.next}>继续前进</button></div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 心魔: write whole idioms from the clue
function Boss({ ids, act, leniency }) {
  const [n, setN] = useState(0);
  const [ci, setCi] = useState(0);
  const [done, setDone] = useState([]); // per char: 'solved' | 'revealed'
  const [errs, setErrs] = useState(0);
  const [helped, setHelped] = useState(false);
  const [outlineKey, setOutlineKey] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [msg, setMsg] = useState({ t: '心魔只给意思，一个字也不给。', c: '' });
  const [between, setBetween] = useState(false);
  if (n >= ids.length) {
    return (
      <div class="card" style={{ textAlign: 'center' }}>
        <h2 class="brush" style={{ fontSize: '32px', color: 'var(--seal)' }}>心魔已破</h2>
        <button class="btn primary big" onClick={act.next}>结算</button>
      </div>
    );
  }
  const it = BY_ID[ids[n]];
  const advance = (how) => {
    const d = [...done, how];
    setDone(d);
    setRevealKey(0);
    setOutlineKey(0);
    if (ci + 1 < it.w.length) { setCi(ci + 1); setMsg({ t: '下一个字', c: '' }); return; }
    act.solved(it.id);
    const perfect = errs === 0 && !helped && d.every((x) => x === 'solved');
    if (perfect) act.bossPerfect();
    setMsg({ t: perfect ? `一字不差！+150 分` : '心魔退了一步。', c: 'good' });
    setBetween(true);
  };
  if (between) {
    return (
      <div class="card">
        <IdiomCard it={it} compact />
        <div class="row center" style={{ marginTop: '12px' }}>
          <span class={`padmsg ${msg.c}`}>{msg.t}</span>
          <button class="btn primary" onClick={() => { setBetween(false); setN(n + 1); setCi(0); setDone([]); setErrs(0); setHelped(false); setMsg({ t: '心魔只给意思，一个字也不给。', c: '' }); }}>
            {n + 1 < ids.length ? '下一个心魔' : '继续'}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div class="card">
      <h2 class="brush" style={{ fontSize: '28px', margin: '0 0 4px', color: 'var(--seal)' }}>心魔 · {n + 1} / {ids.length}</h2>
      <div class="small mute">这是你最常写错的成语。不靠交叉、不给字，从意思默写出来。</div>
      <div class="clue" style={{ boxShadow: 'none' }}><div class="txt">{it.clue}</div></div>
      <div class="pattern">
        {[...it.w].map((c, i) => <span class={i === ci ? 'cur' : ''} key={i}>{i < ci ? c : i === ci ? '?' : ''}</span>)}
      </div>
      <div class="padwrap">
        <HanziPad char={it.w[ci]} mode="quiz" leniency={leniency} runKey={`${n}-${ci}`} outlineKey={outlineKey} revealKey={revealKey}
          onMistake={() => { setErrs(errs + 1); act.hurt(COST.stroke, it.id); setMsg({ t: '这一笔不对（−2 气血）', c: 'bad' }); }}
          onStroke={() => setMsg({ t: '好，继续', c: '' })}
          onComplete={() => setTimeout(() => { act.wrote(); advance('solved'); }, 300)} />
      </div>
      <div class={`padmsg ${msg.c}`}>{msg.t}</div>
      <div class="row center">
        <button class="btn" onClick={() => { setHelped(true); act.hurt(COST.trace, it.id, 'traces'); setOutlineKey(outlineKey + 1); }}>描红 <span class="cost">−{COST.trace} 气血</span></button>
        <button class="btn gold" onClick={() => {
          if (!act.spend(COST.reveal, it.id, 'reveals')) return act.toast('内力不足');
          setHelped(true);
          setRevealKey(revealKey + 1);
          setTimeout(() => advance('revealed'), 700);
        }}>点穴·揭字 <span class="cost">−{COST.reveal} 内力</span></button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- end of run
function EndCard({ R, strict }) {
  const { failed, sc, secs } = R.end;
  const st = STRICTNESS[strict];
  return (
    <div class="over"><div class="ocard">
      {failed ? (
        <>
          <h2 class="brush">走火入魔</h2>
          <p class="small">气血耗尽，本局结束，不计分。</p>
          <p class="small">本局赚到的 <b style={{ color: 'var(--gold)' }}>{R.qiEarned} 内力</b> 已经入库，写过的成语也记进了复习进度。</p>
        </>
      ) : (
        <>
          <h2 class="brush">闯关成功</h2>
          <div class="big">{sc.total}</div>
          <div class="small mute">本局总分 · 笔顺判定「{st.label}」×{st.mult}</div>
          <div class="brk">
            <div><span>亲手写的字 ×10</span><b>{sc.parts.chars}</b></div>
            <div><span>破解成语 ×100</span><b>{sc.parts.idioms}</b></div>
            <div><span>剩余气血 ×2</span><b>{sc.parts.hp}</b></div>
            <div><span>速度奖励（{Math.floor(secs / 60)}分{secs % 60}秒）</span><b>{sc.parts.speed}</b></div>
            <div><span>不点穴奖励</span><b>{sc.parts.noReveal}</b></div>
            <div><span>心魔一字不差</span><b>{sc.parts.boss}</b></div>
            <div><span>小计 × {st.mult}</span><b>{sc.total}</b></div>
          </div>
          <p class="small">内力 +{R.qiEarned} 已入库。</p>
        </>
      )}
      <div class="row center">
        <a class="btn primary" href="#/">回到江湖</a>
        <button class="btn" onClick={() => location.reload()}>再闯一次</button>
      </div>
    </div></div>
  );
}
