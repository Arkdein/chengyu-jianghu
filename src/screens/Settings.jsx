import { MENPAI, hallOf } from '../lib/menpai.js';
import { useState } from 'preact/hooks';
import { useStore, update, replaceState, resetState, storageWorks } from '../lib/store.js';
import { STRICTNESS, exportCode, importCode } from '../lib/progress.js';
import { cacheAllAudio } from '../lib/audio.js';
import { useMusic, setMusicOn, setMusicVol } from '../lib/music.js';
import { AvatarPick } from '../components/Avatar.jsx';
import { rankIndex, rankOf } from '../lib/skills.js';
import { cacheAllStrokes } from '../lib/strokes.js';
import { Top } from '../components/Bits.jsx';
import { post } from '../lib/net.js';
import { statusOf } from '../lib/srs.js';
import { BY_ID } from '../lib/data.js';
import { dayNumber } from '../lib/dates.js';

const setProfile = (k, v) => update((s) => ({ ...s, profile: { ...s.profile, [k]: v } }));

export function Settings() {
  const s = useStore();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [dl, setDl] = useState('');
  const music = useMusic();
  return (
    <div class="wrap">
      <Top title="设置" sub="门派、笔顺判定、备份" />
      <div class="card">
        <h3>侠客名号</h3>
        <label class="field">姓名（上榜时显示）<input value={s.profile.name} maxLength={40} onInput={(e) => setProfile('name', e.currentTarget.value)} /></label>
        <label class="field">班级<input value={s.profile.cls} maxLength={20} onInput={(e) => setProfile('cls', e.currentTarget.value)} /></label>
      </div>

      <div class="card">
        <h3>侠客形象</h3>
        {(() => {
          const secure = Object.values(s.cards).filter((c) => statusOf(c) === 'secure').length;
          return (
            <>
              <p class="small mute" style={{ margin: '0 0 8px' }}>现在的境界：{rankOf(secure)}。境界提升，行头也会跟着变。</p>
              <AvatarPick current={s.profile.avatar} secure={secure} tier={rankIndex(secure) + 1} />
            </>
          );
        })()}
      </div>

      <div class="card">
        <h3>背景音乐</h3>
        <p class="small mute" style={{ margin: '0 0 8px' }}>书院、藏经阁、比武、客栈、奇遇、心魔各有一段原创配乐。默认关闭；朗读成语时音乐会自动变小。</p>
        <div class="row" style={{ flexWrap: 'nowrap', gap: '12px' }}>
          <button class={`btn ${music.on ? 'primary' : ''}`} onClick={() => setMusicOn(!music.on)}>{music.on ? '音乐：开' : '音乐：关'}</button>
          <label class="grow small mute" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>音量
            <input type="range" min="0.1" max="1" step="0.05" value={music.vol} class="grow" onInput={(e) => setMusicVol(Number(e.currentTarget.value))} />
          </label>
        </div>
      </div>

      <div class="card">
        <h3>交给老师</h3>
        <p class="small mute" style={{ margin: '0 0 8px' }}>把学习进度（已学、熟练、最高分、最常错的成语）送给老师。只送这些，不送其他资料。</p>
        <button class="btn" disabled={!s.profile.name} onClick={() => {
          const cards = Object.entries(s.cards);
          const today = dayNumber();
          post({ type: 'report', name: s.profile.name, cls: s.profile.cls, menpai: s.profile.menpai, learnt: cards.length,
            secure: cards.filter(([, c]) => statusOf(c) === 'secure').length, bestShort: s.best.short || 0, bestFull: s.best.full || 0,
            runs: s.runs.length, runsWeek: s.runs.filter((r) => r.day > today - 7).length, qi: s.qi, story: s.story.beaten.length,
            weak: cards.filter(([, c]) => c.bad > 0).sort((a, b) => b[1].bad - a[1].bad).slice(0, 8).map(([id]) => BY_ID[id].w), strict: s.profile.strict });
          setMsg('进度报告已排队送出（有网络时自动送达）。');
        }}>交给老师</button>
        {!s.profile.name && <span class="small mute">　先填姓名</span>}
      </div>

      <div class="card">
        <h3>门派 · 书院两堂</h3>
        <div class="seg">
          {['H1', 'H2'].map((m) => (
            <button class={s.profile.menpai === m ? 'on' : ''} onClick={() => setProfile('menpai', m)}>{MENPAI[m].name}<span class="small mute"> {m}</span></button>
          ))}
        </div>
        <p class="small mute" style={{ margin: '8px 0 0' }}>{hallOf(s.profile.menpai).desc}</p>
      </div>

      <div class="card">
        <h3>笔顺判定</h3>
        <div class="seg">
          {Object.entries(STRICTNESS).map(([k, v]) => (
            <button class={s.profile.strict === k ? 'on' : ''} onClick={() => setProfile('strict', k)}>{v.label}</button>
          ))}
        </div>
        <p class="small" style={{ margin: '8px 0 0' }}>
          {s.profile.strict === 'loose' && '宽松：笔画写得歪一点也算对，适合手指不灵活或手机屏幕小的同学。得分 ×0.9。'}
          {s.profile.strict === 'std' && '标准：笔画形状和顺序都要大致正确。得分 ×1。'}
          {s.profile.strict === 'strict' && '严格：笔画必须写得接近范字。适合考前冲刺。得分 ×1.15。'}
        </p>
        <p class="small mute" style={{ margin: '6px 0 0' }}>为了让排行榜公平，分数会乘上对应倍数，并在榜上标明设置。</p>
      </div>

      <div class="card">
        <h3>离线使用</h3>
        <p class="small mute" style={{ margin: '0 0 8px' }}>先在有网络时下载全部读音和笔顺，之后没网也能用。</p>
        <button class="btn" onClick={async () => {
          setDl('下载中……');
          await cacheAllStrokes((a, b) => setDl(`笔顺 ${a}/${b}`));
          await cacheAllAudio((a, b) => setDl(`读音 ${a}/${b}`));
          setDl('全部下载完成');
        }}>全部下载</button> <span class="small mute">{dl}</span>
      </div>

      <div class="card">
        <h3>备份与换手机</h3>
        <p class="small mute" style={{ margin: '0 0 8px' }}>进度只存在这台手机的浏览器里。换手机前，复制备份码，在新手机上粘贴恢复。</p>
        {!storageWorks() && <p class="small" style={{ color: 'var(--seal)' }}>这个浏览器无法保存进度（可能是隐私模式）。请用备份码保存。</p>}
        <div class="row">
          <button class="btn" onClick={async () => {
            const c = exportCode(s);
            setCode(c);
            try { await navigator.clipboard.writeText(c); setMsg('备份码已复制。'); } catch { setMsg('请手动复制下面的备份码。'); }
          }}>生成备份码</button>
          <button class="btn" onClick={() => {
            try { replaceState(importCode(code)); setMsg('已恢复进度。'); } catch { setMsg('备份码无效，请检查是否完整。'); }
          }}>用备份码恢复</button>
        </div>
        <textarea value={code} onInput={(e) => setCode(e.currentTarget.value)} placeholder="CYJH1.……" aria-label="备份码" />
        {msg && <p class="small">{msg}</p>}
      </div>

      <div class="card">
        <h3>重新开始</h3>
        {!confirmReset ? <button class="btn" onClick={() => setConfirmReset(true)}>清除所有进度</button> : (
          <div class="row">
            <span class="small">确定吗？无法恢复。</span>
            <button class="btn primary" onClick={() => { resetState(); setConfirmReset(false); setMsg(''); }}>确定清除</button>
            <button class="btn" onClick={() => setConfirmReset(false)}>取消</button>
          </div>
        )}
      </div>
      <div class="foot">
        笔画数据：Hanzi Writer（MIT）· hanzi-writer-data（Arphic Public License）<br />
        读音：MeloTTS 合成，个别多音字已按成语读音校正。<br />
        武学名称取自《易经》《庄子》等古籍。
      </div>
    </div>
  );
}
