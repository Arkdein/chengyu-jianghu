import { useEffect, useRef, useState } from 'preact/hooks';
import { charDataLoader } from '../lib/strokes.js';

// hanzi-writer is loaded on demand.
let libPromise;
const loadLib = () => (libPromise ||= import('hanzi-writer').then((m) => m.default || m));
const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/**
 * A square writing pad on a 米字格 grid.
 *   mode 'watch' – animate the stroke order
 *   mode 'trace' – faint outline, student traces (hints after 2 misses)
 *   mode 'quiz'  – no outline, write from memory; no automatic hints
 * leniency comes from the student's stroke-strictness setting.
 * Bump `outlineKey` to show the outline mid-quiz (描红); bump `revealKey` to show the whole character (点穴).
 */
export function HanziPad({ char, mode = 'quiz', leniency = 1.35, runKey = 0, outlineKey = 0, revealKey = 0,
  onComplete, onMistake, onStroke, onError, size: fixed }) {
  const box = useRef(null);
  const writerRef = useRef(null);
  const cb = useRef({});
  cb.current = { onComplete, onMistake, onStroke, onError };
  const [size] = useState(() => fixed || Math.max(220, Math.min(300, (window.innerWidth || 360) - 64)));

  useEffect(() => {
    let dead = false;
    const el = box.current;
    el.innerHTML = '';
    writerRef.current = null;
    loadLib().then((HanziWriter) => {
      if (dead) return;
      const ink = css('--ink', '#1E1B18');
      const writer = HanziWriter.create(el, char, {
        width: size,
        height: size,
        padding: 14,
        showOutline: mode !== 'quiz',
        showCharacter: false,
        strokeColor: ink,
        drawingColor: ink,
        outlineColor: 'rgba(138,128,115,.35)',
        highlightColor: css('--seal', '#B23A2B'),
        drawingWidth: Math.max(14, size / 16),
        strokeAnimationSpeed: 1.1,
        delayBetweenStrokes: 240,
        charDataLoader,
        onLoadCharDataError: () => !dead && cb.current.onError?.(),
      });
      writerRef.current = writer;
      if (mode === 'watch') {
        writer.animateCharacter({ onComplete: () => !dead && cb.current.onComplete?.({ mistakes: 0 }) });
      } else {
        writer.quiz({
          leniency,
          showHintAfterMisses: mode === 'trace' ? 2 : false,
          onMistake: (d) => !dead && cb.current.onMistake?.(d),
          onCorrectStroke: (d) => !dead && cb.current.onStroke?.(d),
          onComplete: (s) => !dead && cb.current.onComplete?.({ mistakes: s.totalMistakes }),
        });
      }
    });
    return () => {
      dead = true;
      try { writerRef.current?.cancelQuiz(); } catch { /* not in a quiz */ }
      el.innerHTML = '';
    };
  }, [char, mode, runKey, leniency]);

  useEffect(() => {
    if (outlineKey) writerRef.current?.showOutline();
  }, [outlineKey]);

  useEffect(() => {
    if (!revealKey || !writerRef.current) return;
    try { writerRef.current.cancelQuiz(); } catch { /* ignore */ }
    writerRef.current.showCharacter();
  }, [revealKey]);

  return <div class="pad" ref={box} style={{ width: size, height: size }} role="img" aria-label={`书写区：${char}`} />;
}
