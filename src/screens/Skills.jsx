import { useState } from 'preact/hooks';
import { useStore, update } from '../lib/store.js';
import { useToday } from '../lib/hooks.js';
import { SKILLS, has, canBuy, SKILL } from '../lib/skills.js';
import { Top } from '../components/Bits.jsx';

const BRANCHES = [['内功', '乾卦六式 · 根基与韧性'], ['外功', '书写的功夫'], ['轻功', '身法'], ['心法', '谋略与判断']];

export function Skills() {
  const s = useStore();
  const today = useToday();
  const [msg, setMsg] = useState('');
  const buy = (sk) => {
    if (!canBuy(s, sk)) return;
    update((st) => ({ ...st, qi: st.qi - sk.cost, skills: { ...st.skills, [sk.id]: today } }));
    setMsg(`习得「${sk.name}」！`);
  };
  return (
    <div class="wrap">
      <Top title="武学" sub={`用闯关攒下的内力修炼 · 现有内力 ${s.qi}`} />
      {msg && <div class="toast">{msg}</div>}
      <p class="small mute">每门武学都出自古籍。习得之后，名字、原文和意思都收进你的秘籍。走火入魔赚到的内力也算数。</p>
      {BRANCHES.map(([b, sub]) => (
        <div class="branch" key={b}>
          <h3>{b} <span class="small mute">· {sub}</span></h3>
          {SKILLS.filter((sk) => sk.branch === b).map((sk) => {
            const owned = has(s, sk.id);
            const locked = sk.req && !has(s, sk.req);
            return (
              <div class={`skill ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}`} key={sk.id}>
                <div class="row" style={{ justifyContent: 'space-between' }}>
                  <span class="sn">{sk.name}</span>
                  {owned ? <span class="chip">已习得</span>
                    : <button class="btn gold" disabled={!canBuy(s, sk)} onClick={() => buy(sk)}>修炼 <span class="cost">{sk.cost} 内力</span></button>}
                </div>
                <div class="src">{sk.src}</div>
                <div class="orig">「{sk.text}」</div>
                <div class="small">{sk.mean}</div>
                <div class="eff"><b>功效：</b>{sk.effect}</div>
                {locked && <div class="small mute">先习得「{SKILL[sk.req].name}」</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
