import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore, update, getState } from '../lib/store.js';
import { useToday } from '../lib/hooks.js';
import { BY_ID, IDIOMS, STORY, chaptersFor } from '../lib/data.js';
import { applyReview } from '../lib/srs.js';
import { STRICTNESS } from '../lib/progress.js';
import { MODES, planRun, makeGrid, gridSize, bossIdioms, quiz, score, outcome, START_HP, START_QI, COST, GAIN } from '../lib/run.js';
import { bossFor, afterRun, fill } from '../lib/story.js';
import { has } from '../lib/skills.js';
import { post } from '../lib/net.js';
import { rng } from '../lib/grid.js';
import { HanziPad } from '../components/HanziPad.jsx';
import { IdiomCard, Sheet } from '../components/Bits.jsx';

const NODE = {
  duel: { name: '比武', desc: '成语填字擂台' },
  elite: { name: '大擂台', desc: '更大的擂台，破一个成语内力翻倍' },
  inn: { name: '客栈', desc: `恢复 ${GAIN.innHeal} 气血，答语境题赚内力` },
  encounter: { name: '奇遇', desc: '说书人讲典故，认出成语得内力' },
  library: { name: '藏书楼', desc: '溯源堂：读原文，认出化出的成语' },
  boss: { name: '心魔', desc: '默写最常错的成语' },
};

/** The 原文 with the idiom blanked out when it appears word for word, so the source line tests recall, not copying. */
const blankIn = (text, w) => text.replaceAll(w, '＿'.repeat(w.length));

const emptyRec = () => ({ solved: false, reveals: 0, hints: 0, traces: 0, mistakes: 0, quiz: null });

function deviceId() {
  try {
    let d = localStorage.getItem('cyjh:device');
    if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('cyjh:device', d); }
    return d;
  } catch { return ''; }
}

export function Run({ mode: modeArg }) {
  const mode = MODES[modeArg] ? modeArg : 'short';
  const s = useStore();
  const today = useToday();
  const menpai = s.profile.menpai;
  const learntItems = useMemo(() => IDIOMS.filter((it) => getState().cards[it.id]), []);
  const [seed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const ready = learntItems.length >= MODES[mode].min;
  const plan = useMemo(() => (ready ? planRun(getState(), today, IDIOMS, seed, mode, menpai) : null), [seed]);
  const order = useMemo(() => (plan ? plan.order.map((id) => BY_ID[id]) : []), [plan]);
  const boss = useMemo(() => bossFor(getState(), STORY, chaptersFor(menpai)), []);
  const sk = s.skills;
  const strict = s.profile.strict;
  const maxHp = START_HP + (has(s, 'qian1') ? 10 : 0);
  const [R, setR] = useState(() => ({
    layer: 0, picks: {}, hp: maxHp, qi: START_QI, qiEarned: 0, t0: Date.now(),
    charsWritten: 0, perfectChars: 0, perfectIdioms: 0, reveals: 0, bossPerfect: 0, idiomsSolved: 0,
    recs: {}, used: [], freeHint: has(s, 'qian4'), mercy: has(s, 'qian6'), reroll: has(s, 'qing1'),
    finish: null, end: null,
  }));
  const Rref = useRef(R);
  Rref.current = R;
  const [quit, setQuit] = useState(false);
  const [toast, setToast] = useState('');
  const toastT = useRef(null);
  const say = (t) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 1800); };

  const rec = (st, id) => st.recs[id] || emptyRec();
  const act = {
    hurt(n, id, kind = 'mistakes') {
      if (kind === 'mistakes' && Rref.current.mercy) {
        Rref.current = { ...Rref.current, mercy: false };
        setR((st) => ({ ...st, mercy: false, recs: id ? { ...st.recs, [id]: { ...rec(st, id), mistakes: rec(st, id).mistakes + 1 } } : st.recs }));
        say('亢龙有悔：这一笔不扣气血');
        return;
      }
      setR((st) => {
        const r = { ...rec(st, id) };
        if (id) r[kind] += 1;
        const hp = Math.max(0, st.hp - n);
        const next = { ...st, hp, recs: id ? { ...st.recs, [id]: r } : st.recs };
        return hp <= 0 && !st.finish ? { ...next, finish: 'fail' } : next;
      });
    },
    spend(n, id, kind) {
      if (kind === 'hints' && Rref.current.freeHint) {
        Rref.current = { ...Rref.current, freeHint: false };
        setR((st) => ({ ...st, freeHint: false, recs: { ...st.recs, [id]: { ...rec(st, id), hints: rec(st, id).hints + 1 } } }));
        say('或跃在渊：这次线索免费');
        return true;
      }
      if (Rref.current.qi < n || Rref.current.finish) return false;
      Rref.current = { ...Rref.current, qi: Rref.current.qi - n };
      setR((st) => {
        const r = { ...rec(st, id) };
        r[kind] += 1;
        return { ...st, qi: st.qi - n, reveals: st.reveals + (kind === 'reveals' ? 1 : 0), recs: { ...st.recs, [id]: r } };
      });
      return true;
    },
    wrote(perfect) { setR((st) => ({ ...st, charsWritten: st.charsWritten + 1, perfectChars: st.perfectChars + (perfect ? 1 : 0) })); },
    solved(id, { elite } = {}) {
      const r = rec(Rref.current, id);
      const perfect = r.mistakes + r.hints + r.traces + r.reveals === 0;
      const gain = GAIN.idiomQi * (elite ? 2 : 1);
      setR((st) => ({
        ...st, idiomsSolved: st.idiomsSolved + 1, qi: st.qi + gain, qiEarned: st.qiEarned + gain,
        perfectIdioms: st.perfectIdioms + (perfect ? 1 : 0),
        hp: has(getState(), 'qian5') ? Math.min(maxHp, st.hp + 3) : st.hp,
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
    heal(n) { setR((st) => ({ ...st, hp: Math.min(maxHp, st.hp + n) })); },
    bossPerfect() { setR((st) => ({ ...st, bossPerfect: st.bossPerfect + 1 })); },
    use(ids) { setR((st) => ({ ...st, used: [...new Set([...st.used, ...ids])] })); },
    useReroll() { setR((st) => ({ ...st, reroll: false })); },
    next() {
      setR((st) => (st.layer + 1 >= plan.layers.length ? { ...st, finish: st.finish || 'win' } : { ...st, layer: st.layer + 1 }));
      window.scrollTo(0, 0);
    },
    pick(type) { setR((st) => ({ ...st, picks: { ...st.picks, [st.layer]: type } })); },
    toast: say,
  };

  // Save once the run is decided (never inside a state updater).
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
        <p>{MODES[mode].name}需要先学会 {MODES[mode].min} 个成语。</p>
        <a class="btn primary" href="#/library">去藏经阁</a>
      </div>
    );
  }

  function finishRun(st, failed) {
    const secs = Math.round((Date.now() - st.t0) / 1000);
    const sc = score({ charsWritten: st.charsWritten, perfectChars: st.perfectChars, idiomsSolved: st.idiomsSolved,
      perfectIdioms: st.perfectIdioms, hp: st.hp, secs, reveals: st.reveals, bossPerfect: st.bossPerfect, strict }, sk);
    const g0 = getState();
    const firstToday = !g0.runs.some((r) => r.day === today);
    const bonus = has(g0, 'qian3') && firstToday ? 20 : 0;
    update((g) => {
      const cards = { ...g.cards };
      for (const [id, r] of Object.entries(st.recs)) {
        if (!cards[id]) continue;
        const o = r.quiz !== null && !r.solved && r.mistakes + r.reveals === 0 ? (r.quiz ? 'good' : 'again') : outcome(r);
        cards[id] = applyReview(cards[id], o, today);
      }
      const runs = [...g.runs, { day: today, mode, score: failed ? 0 : sc.total, raw: sc.raw, strict, idioms: st.idiomsSolved, failed, secs }].slice(-60);
      const best = { ...g.best };
      if (!failed && sc.total > (best[mode] || 0)) best[mode] = sc.total;
      return afterRun({ ...g, cards, qi: g.qi + st.qiEarned + bonus, runs, best }, STORY, { failed, boss });
    });
    let posted = false;
    if (!failed && g0.profile.name) {
      post({ type: 'run', name: g0.profile.name, cls: g0.profile.cls, mode, score: sc.total, raw: sc.raw, strict,
        idioms: st.idiomsSolved, chars: st.charsWritten, secs, reveals: st.reveals, parts: sc.parts, boss: boss.boss, device: deviceId() });
      posted = true;
    }
    return { failed, sc, secs, bonus, posted, beat: !failed && boss.kind === 'story' };
  }

  const layer = plan.layers[R.layer];
  const type = layer.length === 1 ? layer[0].type : R.picks[R.layer];
  const leniency = STRICTNESS[strict].leniency;
  const nodeKey = `${R.layer}-${type}`;

  return (
    <div class="wrap full">
      <div class="row" style={{ justifyContent: 'space-between' }}>
        <button class="back" onClick={() => setQuit(true)}>‹ 撤退</button>
        <span class="small mute">{MODES[mode].name} · 第 {R.layer + 1} / {plan.layers.length} 站</span>
      </div>
      <Route plan={plan} cur={R.layer} picks={R.picks} />
      <div class="stats3">
        <div class="stat"><div class="k">气血</div><div class="v">{R.hp}</div><div class="bar hp"><i style={{ width: `${(R.hp / maxHp) * 100}%` }} /></div></div>
        <div class="stat"><div class="k">内力</div><div class="v gold">{R.qi}</div></div>
        <div class="stat"><div class="k">成语</div><div class="v">{R.idiomsSolved}</div></div>
      </div>

      {!type && <Fork options={layer} onPick={act.pick} />}
      {(type === 'duel' || type === 'elite') && (
        <Duel key={nodeKey} order={order} used={R.used} size={gridSize(mode, type, learntItems.length)} seed={seed + R.layer * 13}
          elite={type === 'elite'} act={act} leniency={leniency} canReroll={R.reroll}
          title={type === 'elite' ? '大擂台' : '比武'} />
      )}
      {type === 'inn' && <Inn key={nodeKey} pool={learntItems} seed={seed + R.layer} act={act} trim={has(s, 'xin2')} />}
      {type === 'encounter' && <Encounter key={nodeKey} pool={learntItems} seed={seed + R.layer} act={act} trim={has(s, 'xin2')} />}
      {type === 'library' && <Library key={nodeKey} pool={learntItems} seed={seed + R.layer} act={act} trim={has(s, 'xin2')} />}
      {type === 'boss' && (
        <Boss key="boss" boss={boss} n={MODES[mode].boss} used={R.used} learnt={learntItems} act={act} leniency={leniency}
          name={s.profile.name} giveFirst={has(s, 'qian2')} initials={has(s, 'xin1')} h2={menpai === 'H2'} />
      )}

      {R.end && <EndCard R={R} strict={strict} mode={mode} boss={boss} name={s.profile.name} />}
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

function Route({ plan, cur, picks }) {
  return (
    <div class="route" aria-label="本局路线">
      {plan.layers.map((layer, i) => {
        const t = layer.length === 1 ? layer[0].type : picks[i];
        return (
          <Fragment key={i}>
            {i > 0 && <div class="ln" />}
            <div class={`n ${i < cur ? 'done' : i === cur ? 'cur' : ''}`}>
              <span class="d" />
              {t ? NODE[t].name : '岔路'}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- 岔路
function Fork({ options, onPick }) {
  return (
    <div>
      <h2 class="brush" style={{ fontSize: '30px', margin: '6px 0' }}>前方岔路</h2>
      <p class="small mute" style={{ margin: '0 0 6px' }}>选一条路走。</p>
      {options.map((o) => (
        <button class="choice" key={o.type} onClick={() => onPick(o.type)}>
          <b>{NODE[o.type].name}</b>
          <div class="small" style={{ marginTop: '4px' }}>{NODE[o.type].desc}</div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 比武 / 大擂台: crossword
function Duel({ order, used, size, seed, elite, act, leniency, title, canReroll }) {
  const [roll, setRoll] = useState(0);
  const grid = useMemo(() => makeGrid(order, new Set(used), size, seed + roll * 101), [roll]);
  const initFilled = () => Object.fromEntries(Object.entries(grid.cells).map(([k, c]) => [k, c.given ? 'given' : '']));
  const [filled, setFilled] = useState(initFilled);
  useEffect(() => { setFilled(initFilled()); solved.current = new Set(); setSel(null); setTarget(null); }, [grid]);
  const [sel, setSel] = useState(null);
  const [target, setTarget] = useState(null);
  const [hinted, setHinted] = useState(() => new Set());
  const [card, setCard] = useState(null);
  const [outlineKey, setOutlineKey] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [msg, setMsg] = useState({ t: '想出成语，按正确笔顺写出 ？ 处的字', c: '' });
  const [pop, setPop] = useState(null);
  const charErr = useRef(0); // mistakes or help on the character being written
  const solved = useRef(new Set());
  const nums = useMemo(() => {
    const out = {};
    let n = 0;
    [...new Set(grid.words.map((w) => w.cells[0]))].sort((a, b) => {
      const [ra, ca] = a.split(',').map(Number);
      const [rb, cb] = b.split(',').map(Number);
      return ra - rb || ca - cb;
    }).forEach((k) => { out[k] = ++n; });
    return out;
  }, [grid]);
  const label = (i) => `${nums[grid.words[i].cells[0]]} ${grid.words[i].d === 'A' ? '横' : '竖'}`;
  const allDone = grid.words.every((w, i) => solved.current.has(i));
  const untouched = Object.values(filled).every((f) => f !== 'solved' && f !== 'revealed');

  const openCell = (k, wi) => {
    setSel(wi);
    if (filled[k]) { setTarget(null); if (solved.current.has(wi)) setCard([wi]); return; }
    setTarget(k);
    charErr.current = 0;
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
    if (how === 'solved') act.wrote(charErr.current === 0);
    const newly = grid.cells[k].words.filter((wi) => !solved.current.has(wi) && grid.words[wi].cells.every((c) => nextFilled[c]));
    newly.forEach((wi) => { solved.current.add(wi); act.solved(grid.words[wi].id, { elite }); });
    if (newly.length) { setTarget(null); setCard(newly); return; }
    const w = grid.words[sel];
    const nk = w.cells.find((c) => !nextFilled[c]);
    if (nk) openCell(nk, sel);
    else setTarget(null);
  };
  const finish = () => { act.use(grid.words.map((w) => w.id)); act.next(); };

  const w = sel !== null ? grid.words[sel] : null;
  const it = w ? BY_ID[w.id] : null;

  return (
    <>
      <div class="board">
        <div class="row small mute" style={{ justifyContent: 'space-between', marginBottom: '6px' }}>
          <span>{title} · 共 {grid.words.length} 个成语{elite ? ' · 内力翻倍' : ''}</span>
          {canReroll && untouched && <button class="btn" style={{ padding: '3px 10px', fontSize: '12px' }} onClick={() => { act.useReroll(); setRoll(roll + 1); act.toast('凌波微步：擂台已重排'); }}>凌波微步 · 重排</button>}
        </div>
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
          <h2 class="brush" style={{ fontSize: '30px', color: 'var(--seal)' }}>{title}告捷</h2>
          <button class="btn primary big" onClick={finish}>继续前进</button>
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
              onMistake={() => { charErr.current++; act.hurt(COST.stroke, w.id); setMsg({ t: '这一笔不对。想想是哪个字？', c: 'bad' }); }}
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
            <button class="btn" onClick={() => { charErr.current++; act.hurt(COST.trace, w.id, 'traces'); setOutlineKey(outlineKey + 1); setMsg({ t: '描红：沿着淡色字形按笔顺写', c: '' }); }}>
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

// ---------------------------------------------------------------- multiple-choice nodes
function Choices({ target, opts, onAnswer, trim, rand }) {
  const [pick, setPick] = useState(null);
  const [gone] = useState(() => {
    if (!trim) return null;
    const wrong = opts.filter((o) => o.id !== target.id);
    return wrong[Math.floor(rand() * wrong.length)].id;
  });
  return (
    <>
      {trim && <p class="small mute" style={{ margin: '0 0 4px' }}>庖丁解牛：已去掉一个错误答案。</p>}
      {opts.filter((o) => o.id !== gone).map((o) => (
        <button key={o.id} class={`opt ${pick ? (o.id === target.id ? 'right' : o.id === pick ? 'wrong' : '') : ''}`} disabled={!!pick}
          onClick={() => { setPick(o.id); onAnswer(o.id === target.id); }}>{o.w}</button>
      ))}
      {pick && <p class="small" style={{ color: pick === target.id ? 'var(--jade)' : 'var(--seal)' }}>{pick === target.id ? '答对了！' : `正确答案是「${target.w}」。`}</p>}
      {pick && <PickDone />}
    </>
  );
}
const PickDone = () => null;

function Inn({ pool, seed, act, trim }) {
  const rand = useMemo(() => rng(seed + 11), []);
  const qs = useMemo(() => pool.slice().sort(() => rand() - 0.5).slice(0, 3).map((t) => ({ t, opts: quiz(t, pool, 3, rand) })), []);
  const [healed, setHealed] = useState(false);
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  if (!healed) {
    return (
      <div class="card" style={{ textAlign: 'center' }}>
        <h2 class="brush" style={{ fontSize: '30px' }}>悦来客栈</h2>
        <p class="small">老金：“客官，喝碗热茶，养养精神。”</p>
        <button class="btn primary big" onClick={() => { act.heal(GAIN.innHeal); setHealed(true); }}>歇脚（+{GAIN.innHeal} 气血）</button>
      </div>
    );
  }
  if (i >= qs.length) {
    return (
      <div class="card" style={{ textAlign: 'center' }}>
        <p>老金：“客官慢走！”</p>
        <button class="btn primary big" onClick={act.next}>继续前进</button>
      </div>
    );
  }
  const q = qs[i];
  return (
    <div class="card">
      <div class="small mute">客栈小考 · {i + 1} / {qs.length} · 答对 +{GAIN.innQi} 内力</div>
      <p class="serif" style={{ fontSize: '17px', lineHeight: 1.7 }}>{q.t.ctx}</p>
      <Choices key={i} target={q.t} opts={q.opts} trim={trim} rand={rand} onAnswer={(ok) => { act.quizResult(q.t.id, ok, GAIN.innQi, 0); setAnswered(true); }} />
      {answered && <div class="row center"><button class="btn primary" onClick={() => { setAnswered(false); setI(i + 1); }}>下一题</button></div>}
    </div>
  );
}

function Encounter({ pool, seed, act, trim }) {
  const rand = useMemo(() => rng(seed + 23), []);
  const q = useMemo(() => {
    const dg = pool.filter((it) => it.panels.length);
    const src = dg.length ? dg : pool;
    const t = src[Math.floor(rand() * src.length)];
    return { t, opts: quiz(t, pool, 4, rand), story: !!t.panels.length };
  }, []);
  const [done, setDone] = useState(false);
  return (
    <div class="card">
      <h2 class="brush" style={{ fontSize: '30px', margin: '0 0 6px' }}>奇遇</h2>
      <p class="small mute">{q.story ? '路边茶摊，说书人柳先生一拍醒木：“话说……”' : '一位老者拦住你：“小友，考考你。”'}</p>
      <p class="serif" style={{ fontSize: '17px', lineHeight: 1.7 }}>{q.story ? q.t.panels.join('') : q.t.clue}</p>
      <p class="small">这说的是哪个成语？（答对 +{GAIN.encounterQi} 内力，答错 −{GAIN.encounterHurt} 气血）</p>
      <Choices target={q.t} opts={q.opts} trim={trim} rand={rand} onAnswer={(ok) => { act.quizResult(q.t.id, ok, GAIN.encounterQi, GAIN.encounterHurt); setDone(true); }} />
      {done && <div class="row center"><button class="btn primary" onClick={act.next}>继续前进</button></div>}
    </div>
  );
}

function Library({ pool, seed, act, trim }) {
  const rand = useMemo(() => rng(seed + 31), []);
  const q = useMemo(() => {
    const src = pool.filter((it) => it.wenyan);
    if (!src.length) return null;
    const t = src[Math.floor(rand() * src.length)];
    const others = pool.filter((it) => it.wenyan && it.id !== t.id);
    return { t, opts: quiz(t, others.length >= 3 ? [t, ...others] : pool, 4, rand) };
  }, []);
  const [done, setDone] = useState(false);
  if (!q) {
    return (
      <div class="card" style={{ textAlign: 'center' }}>
        <h2 class="brush" style={{ fontSize: '30px' }}>藏书楼</h2>
        <p class="small">楼里的书你还没读过。先到藏经阁学几卷溯源卷的成语吧。</p>
        <button class="btn primary big" onClick={act.next}>继续前进</button>
      </div>
    );
  }
  return (
    <div class="card">
      <h2 class="brush" style={{ fontSize: '30px', margin: '0 0 6px' }}>藏书楼</h2>
      <p class="small mute">一卷旧书摊开着，出自{q.t.src}：</p>
      <p class="serif" style={{ fontSize: '17px', lineHeight: 1.8, padding: '8px 10px', background: 'var(--paper2)', borderRadius: '8px' }}>{blankIn(q.t.wenyan, q.t.w)}</p>
      <p class="small">这段原文化出了哪个成语？（答对 +{GAIN.encounterQi} 内力，答错 −{GAIN.encounterHurt} 气血）</p>
      <Choices target={q.t} opts={q.opts} trim={trim} rand={rand} onAnswer={(ok) => { act.quizResult(q.t.id, ok, GAIN.encounterQi, GAIN.encounterHurt); setDone(true); }} />
      {done && <div class="row center"><button class="btn primary" onClick={act.next}>继续前进</button></div>}
    </div>
  );
}

// ---------------------------------------------------------------- 心魔: write whole idioms from the clue
function Boss({ boss, n: count, used, learnt, act, leniency, name, giveFirst, initials, h2 }) {
  const ids = useMemo(() => bossIdioms(getState(), learnt, count, new Set(used)).map((it) => it.id), []);
  // A taunt must never quote one of the idioms the student is about to write.
  const taunt = useMemo(() => {
    const ok = boss.taunts.filter((t) => ids.every((id) => !t.includes(BY_ID[id].w)));
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : '来吧，写给我看。';
  }, []);
  const [n, setN] = useState(0);
  const start = (k) => (k === 0 && giveFirst ? 1 : 0);
  const [ci, setCi] = useState(start(0));
  const [done, setDone] = useState(() => (start(0) ? ['given'] : []));
  const [errs, setErrs] = useState(0);
  const [helped, setHelped] = useState(false);
  const [outlineKey, setOutlineKey] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [msg, setMsg] = useState({ t: '心魔只给意思，一个字也不给。', c: '' });
  const [between, setBetween] = useState(false);
  const charErr = useRef(0);
  if (n >= ids.length) {
    return (
      <div class="card" style={{ textAlign: 'center' }}>
        <h2 class="brush" style={{ fontSize: '32px', color: 'var(--seal)' }}>{boss.boss}溃散</h2>
        <p class="serif taunt">「{fill(boss.defeat, name)}」</p>
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
    charErr.current = 0;
    if (ci + 1 < it.w.length) { setCi(ci + 1); setMsg({ t: '下一个字', c: '' }); return; }
    act.solved(it.id);
    const perfect = errs === 0 && !helped && d.every((x) => x !== 'revealed');
    if (perfect) act.bossPerfect();
    setMsg({ t: perfect ? '一字不差！+150 分' : '心魔退了一步。', c: 'good' });
    setBetween(true);
  };
  if (between) {
    return (
      <div class="card">
        <IdiomCard it={it} compact />
        <div class="row center" style={{ marginTop: '12px' }}>
          <span class={`padmsg ${msg.c}`}>{msg.t}</span>
          <button class="btn primary" onClick={() => {
            const k = n + 1;
            setBetween(false); setN(k); setCi(start(k)); setDone(start(k) ? ['given'] : []); setErrs(0); setHelped(false);
            setMsg({ t: '心魔只给意思，一个字也不给。', c: '' });
          }}>{n + 1 < ids.length ? '下一招' : '继续'}</button>
        </div>
      </div>
    );
  }
  return (
    <div class="card">
      <div class="small mute">{boss.kind === 'story' ? `蚀字之劫 · 第${boss.c + 1}回` : '心魔'} · {n + 1} / {ids.length}</div>
      <h2 class="brush" style={{ fontSize: '30px', margin: '0 0 2px', color: 'var(--seal)' }}>{boss.boss}</h2>
      <div class="small mute">「{boss.title}」· 它挑的是你最常写错的成语</div>
      {n === 0 && <div class="taunt">「{fill(taunt, name)}」</div>}
      <div class="clue" style={{ boxShadow: 'none' }}>
        <div class="txt">{it.clue}</div>
        {h2 && it.wenyan && <div class="hint">原文：{blankIn(it.wenyan, it.w)}</div>}
        {initials && <div class="small mute" style={{ marginTop: '6px' }}>知己知彼：{it.py.split(' ').map((p) => p[0]).join(' ')}</div>}
      </div>
      <div class="pattern">
        {[...it.w].map((c, i) => <span class={i === ci ? 'cur' : ''} key={i}>{i < ci ? c : i === ci ? '?' : ''}</span>)}
      </div>
      <div class="padwrap">
        <HanziPad char={it.w[ci]} mode="quiz" leniency={leniency} runKey={`${n}-${ci}`} outlineKey={outlineKey} revealKey={revealKey}
          onMistake={() => { charErr.current++; setErrs(errs + 1); act.hurt(COST.stroke, it.id); setMsg({ t: '这一笔不对', c: 'bad' }); }}
          onStroke={() => setMsg({ t: '好，继续', c: '' })}
          onComplete={() => setTimeout(() => { act.wrote(charErr.current === 0); advance('solved'); }, 300)} />
      </div>
      <div class={`padmsg ${msg.c}`}>{msg.t}</div>
      <div class="row center">
        <button class="btn" onClick={() => { charErr.current++; setHelped(true); act.hurt(COST.trace, it.id, 'traces'); setOutlineKey(outlineKey + 1); }}>描红 <span class="cost">−{COST.trace} 气血</span></button>
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
function EndCard({ R, strict, mode, boss, name }) {
  const { failed, sc, secs, bonus, posted, beat } = R.end;
  const st = STRICTNESS[strict];
  return (
    <div class="over"><div class="ocard">
      {failed ? (
        <>
          <h2 class="brush">走火入魔</h2>
          <p class="small">气血耗尽，本局结束，不计分。</p>
          <p class="small">本局赚到的 <b style={{ color: 'var(--gold)' }}>{R.qiEarned + bonus} 内力</b> 已经入库，写过的成语也记进了复习进度。回书院歇歇，大家有话对你说。</p>
        </>
      ) : (
        <>
          <h2 class="brush">{beat ? `${boss.boss}已破` : '闯关成功'}</h2>
          <div class="big">{sc.total}</div>
          <div class="small mute">{MODES[mode].name} · 笔顺判定「{st.label}」×{st.mult}</div>
          <div class="brk">
            <div><span>亲手写的字</span><b>{sc.parts.chars}</b></div>
            <div><span>破解成语 ×100</span><b>{sc.parts.idioms}</b></div>
            <div><span>剩余气血 ×2</span><b>{sc.parts.hp}</b></div>
            <div><span>速度奖励（{Math.floor(secs / 60)}分{secs % 60}秒）</span><b>{sc.parts.speed}</b></div>
            <div><span>不点穴奖励</span><b>{sc.parts.noReveal}</b></div>
            <div><span>心魔一字不差</span><b>{sc.parts.boss}</b></div>
            {sc.parts.perfect > 0 && <div><span>百步穿杨</span><b>{sc.parts.perfect}</b></div>}
            <div><span>小计 × {st.mult}</span><b>{sc.total}</b></div>
          </div>
          <p class="small">内力 +{R.qiEarned}{bonus ? `（终日乾乾 +${bonus}）` : ''} 已入库。{posted ? '成绩已送上擂台榜。' : name ? '' : '在「设置」填上名号，成绩才能上擂台榜。'}</p>
        </>
      )}
      <div class="row center">
        <a class="btn primary" href="#/">回书院</a>
        <button class="btn" onClick={() => location.reload()}>再闯一次</button>
      </div>
    </div></div>
  );
}
