import { useEffect, useState } from 'preact/hooks';
import { useStore, update } from '../lib/store.js';
import { useToday } from '../lib/hooks.js';
import { BY_ID, CHAPTERS } from '../lib/data.js';
import { newCard } from '../lib/srs.js';
import { STRICTNESS } from '../lib/progress.js';
import { play } from '../lib/audio.js';
import { HanziPad } from '../components/HanziPad.jsx';
import { IdiomCard, Top } from '../components/Bits.jsx';

export function Learn({ id }) {
  const it = BY_ID[id];
  const s = useStore();
  const today = useToday();
  const [step, setStep] = useState('card');
  const [ci, setCi] = useState(0);
  const [phase, setPhase] = useState('watch');
  const [msg, setMsg] = useState('');
  useEffect(() => { setStep('card'); setCi(0); setPhase('watch'); }, [id]);
  if (!it) return <div class="wrap"><Top title="藏经阁" back="#/library" /><p>找不到这个成语。</p></div>;

  const ch = CHAPTERS[it.ch];
  const next = ch.ids.find((x) => x !== id && !s.cards[x]);
  const learnt = !!s.cards[id];
  const leniency = STRICTNESS[s.profile.strict].leniency;

  const finish = () => {
    if (!learnt) update((st) => ({ ...st, cards: { ...st.cards, [id]: newCard(today) } }));
    setStep('done');
  };

  return (
    <div class="wrap">
      <Top title={ch.name} sub={`藏经阁 · ${learnt ? '已收入秘籍' : '新成语'}`} back={`#/library/${ch.n}`} />
      {step === 'card' && (
        <>
          <div class="card"><IdiomCard it={it} /></div>
          <div class="row center">
            <button class="btn primary big" onClick={() => { setStep('write'); setCi(0); setPhase('watch'); play(it, 'w'); }}>
              {learnt ? '再练一次笔顺' : '开始练字'}
            </button>
            {learnt && next && <a class="btn" href={`#/learn/${next}`}>下一个</a>}
          </div>
          {!learnt && <p class="small mute" style={{ textAlign: 'center' }}>每个字先看笔顺，再跟着描一遍，写完就收入秘籍。</p>}
        </>
      )}
      {step === 'write' && (
        <div class="card" style={{ textAlign: 'center' }}>
          <div class="pattern">
            {[...it.w].map((c, i) => <span class={i === ci ? 'cur' : ''} key={i}>{i < ci ? c : i === ci ? c : ''}</span>)}
          </div>
          <div class="small mute">{it.py}</div>
          <div class="padwrap">
            <HanziPad
              char={it.w[ci]}
              mode={phase}
              leniency={leniency}
              runKey={ci * 10 + (phase === 'watch' ? 0 : 1)}
              onMistake={() => setMsg('这一笔不对，看看描红的提示。')}
              onStroke={() => setMsg('')}
              onComplete={() => {
                if (phase === 'watch') {
                  setPhase('trace');
                  setMsg('跟着淡色字形，按笔顺写一遍。');
                } else if (ci + 1 < it.w.length) {
                  setCi(ci + 1);
                  setPhase('watch');
                  setMsg('');
                } else finish();
              }}
            />
          </div>
          <div class="padmsg">{msg || (phase === 'watch' ? '看清楚笔顺……' : '跟着写')}</div>
          <div class="row center">
            {phase === 'watch' && <button class="btn" onClick={() => setPhase('trace')}>跳过演示</button>}
            <button class="btn" onClick={() => setStep('card')}>回到成语卡</button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div class="card" style={{ textAlign: 'center' }}>
          <h2 class="brush" style={{ fontSize: '36px', color: 'var(--seal)', margin: '6px 0' }}>收入秘籍</h2>
          <p class="serif" style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '.08em', margin: '4px 0' }}>{it.w}</p>
          <p class="small mute">以后闯关时，它会出现在擂台上。</p>
          <div class="row center">
            {next ? <a class="btn primary big" href={`#/learn/${next}`}>学下一个</a> : <a class="btn primary big" href="#/">本卷学完，去闯关</a>}
            <a class="btn" href={`#/library/${ch.n}`}>回到本卷</a>
          </div>
        </div>
      )}
    </div>
  );
}
