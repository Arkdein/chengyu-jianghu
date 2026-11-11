import { useEffect, useState } from 'preact/hooks';
import { fill } from '../lib/story.js';
import { PORTRAIT } from '../lib/art.js';
import { Portrait } from './Bits.jsx';

const ROLE = { 墨老: '山长', 青岚: '师姐', 小砚: '书童', 柳先生: '说书人', 老金: '客栈掌柜' };
const MARK = { 墨老: '墨', 青岚: '岚', 小砚: '砚', 柳先生: '柳', 老金: '金', 旁白: '　' };

/** A visual-novel style box: one line at a time, tap to go on. */
export function Dialogue({ scene, name, onDone, onSpeaker, bare }) {
  const [i, setI] = useState(0);
  const line = scene.lines[i];
  useEffect(() => { onSpeaker?.(line.s); }, [i, scene]);
  const last = i + 1 >= scene.lines.length;
  const lesson = line.s === '心得';
  const villain = !ROLE[line.s] && line.s !== '旁白' && !lesson;
  return (
    <div class="dlg card" onClick={() => (last ? onDone() : setI(i + 1))} role="button" aria-label="点一下继续">
      <div class="dlg-title small mute">{scene.title}</div>
      {lesson ? (
        <div class="dlg-lesson"><b>心得</b>　{fill(line.t, name)}</div>
      ) : (
        <div class="dlg-row">
          {PORTRAIT[line.s]
            ? !bare && <Portrait k={PORTRAIT[line.s]} alt={line.s} />
            : line.s !== '旁白' && <div class={`dlg-mark ${villain ? 'evil' : ''}`}>{MARK[line.s] || line.s[0]}</div>}
          <div class="grow">
            {line.s !== '旁白' && <div class="dlg-who">{line.s}<span class="small mute">{ROLE[line.s] ? ` · ${ROLE[line.s]}` : ''}</span></div>}
            <div class={`dlg-text serif ${line.s === '旁白' ? 'narr' : ''}`}>{fill(line.t, name)}</div>
          </div>
        </div>
      )}
      <div class="row" style={{ justifyContent: 'space-between', marginTop: '10px' }}>
        <span class="small mute">{i + 1} / {scene.lines.length}</span>
        <span class="row">
          {!last && <button class="btn" onClick={(e) => { e.stopPropagation(); onDone(); }}>跳过</button>}
          <button class="btn primary" onClick={(e) => { e.stopPropagation(); last ? onDone() : setI(i + 1); }}>{last ? '好' : '继续'}</button>
        </span>
      </div>
    </div>
  );
}
