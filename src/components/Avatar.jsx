import { update } from '../lib/store.js';
import { avSrc } from '../lib/art.js';
import { RANKS, rankIndex } from '../lib/skills.js';
import { fill } from '../lib/story.js';

export const LOOKS = [['boy', '少年'], ['girl', '少女']];

/** Choose 少年 or 少女. Choosing never triggers a 突破: the current rank counts as already seen. */
export function chooseAvatar(look, secure) {
  update((s) => ({ ...s, profile: { ...s.profile, avatar: look, rankSeen: Math.max(s.profile.rankSeen, rankIndex(secure)) } }));
}

export function AvatarPick({ current, secure, tier = 1 }) {
  return (
    <div class="av-pick">
      {LOOKS.map(([k, label]) => (
        <button key={k} class={`av-opt ${current === k ? 'on' : ''}`} onClick={() => chooseAvatar(k, secure)} aria-pressed={current === k}>
          <img src={avSrc(k, tier)} alt="" loading="lazy" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/** First visit: pick a look. */
export function AvatarFirst({ secure }) {
  return (
    <div class="over"><div class="ocard av-first">
      <h2 class="brush" style={{ fontSize: '30px', margin: '0 0 4px' }}>入门 · 选你的侠客</h2>
      <p class="small mute" style={{ margin: '0 0 10px' }}>斗笠下的人，就是你。境界越高，行头越不一样。以后可在「设置」更换。</p>
      <AvatarPick secure={secure} />
    </div></div>
  );
}

const BREAK = [
  '',
  '墨老：好！行囊已备，该出门见见江湖了。',
  '墨老：剑已出鞘。记住，字比剑更锋利。',
  '墨老：披风扬起来了。江湖上，已经有人叫得出你的名号。',
  '墨老：笔落惊风雨。{name}，书院以你为荣。',
];

/** 突破: shown once when the student reaches a new 境界. */
export function Breakthrough({ look, tier, name }) {
  return (
    <div class="over breakthrough"><div class="ocard">
      <div class="small mute" style={{ letterSpacing: '.2em' }}>境界突破</div>
      <h2 class="brush">{RANKS[tier][1]}</h2>
      <img class="bt-av" src={avSrc(look, tier + 1)} alt={RANKS[tier][1]} />
      <p class="serif">{fill(BREAK[tier] || '', name)}</p>
      <button class="btn primary big" onClick={() => update((s) => ({ ...s, profile: { ...s.profile, rankSeen: tier } }))}>继续修行</button>
    </div></div>
  );
}
