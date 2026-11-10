# 成语江湖 Chengyu Jianghu

A 武侠-themed rogue-lite web app where H1 and H2 Chinese students master 成语. They recall each idiom from its meaning and handwrite every character in correct stroke order. It is an offline-capable PWA on GitHub Pages, with progress stored on the student's own phone.

Game design doc: https://claude.ai/artifact/MkPeboGZzXUhLJzVDgsfda

## What Phase 1 contains

- **藏经阁 Learn:** 80 idioms in 8 chapters (卷). Each card has the meaning, pinyin, audio for the idiom and the example, the example sentence, a usage tip, and the 典故 storyboard. Panel art comes in Phase 3. Every character is learnt by watching its strokes, then tracing it.
- **小试身手 short run (5–8 min):** 比武 crossword → 客栈 or 奇遇 → 比武 crossword → 心魔 boss → score.
  - Every empty cell is handwritten and checked by Hanzi Writer.
  - Clues give only the meaning, and never contain a character of the answer; the build enforces this.
  - Grids are generated on the phone from the idioms the student has learnt, with idioms due for review or often missed coming first.
- **Spaced repetition:** each idiom's result in a run moves it up or down Leitner boxes. Writing it cleanly counts as good; a paid clue, tracing or 3+ wrong strokes counts as a hint; revealing a character (点穴) or failing counts as again.
- **Stroke strictness setting:** 宽松 / 标准 / 严格 (leniency 1.7 / 1.35 / 1.0), with score multipliers ×0.9 / ×1 / ×1.15 to keep the pure-score leaderboard fair.
- **战绩 Records:** best and weekly scores, recent runs, and the idioms most often missed (心魔榜).
- **Settings:** name, class, 门派 (习字堂 = H1, 溯源堂 = H2), strictness, offline download, backup code (CYJH1.…) for changing phones, and reset.

Phase 2 adds the class leaderboard (Google Form → Sheet → published CSV), the 武学 skill tree that spends banked 内力, the full 闯荡江湖 run, and the teacher report.

## Data pipeline

```
data-src/archive.json    50 archive idioms (GCE A sittings), shared with 词游记
data-src/classics.json   典故 idioms from the prototype level
data-src/batch-*.json    curated batches approved in the review Google Sheet
        │  python3 scripts/build-data.py   (checks for clue leaks, duplicates and missing fields; builds chapters)
        ▼
src/data/idioms.json
        │  node scripts/copy-stroke-data.mjs                        (stroke data per character)
        │  python3 scripts/generate-audio.py <melo model dir>       (audio with checked readings)
        ▼
public/strokes/*.json, public/audio/*.mp3
```

The review sheet is called "成语江湖 成语审核 Idiom review" and is in Randall's Drive. Only rows marked 通过 or 修改后通过 are exported into a new `data-src/batch-*.json`. See `teacher/adding-idioms.md`.

### Pronunciation

`generate-audio.py` does not trust the TTS model's dictionary for polyphones. It writes every idiom into the model's lexicon from the approved pinyin, applying the spoken tone changes for 一 and 不. It also adds each idiom to the word segmenter, so the reading holds inside example sentences too. The script lists every idiom where the model would otherwise have read it differently.

## Develop

```
npm install
npm test          # grid generator, run planning, scoring, data checks
npm run dev
npm run build
```

Deploy: pushing to `main` runs `.github/workflows/deploy.yml` (tests → build → GitHub Pages). In the repo settings, set **Pages → Source = GitHub Actions**.

## Licences

- Stroke data: hanzi-writer-data, Arphic Public License (`public/strokes/ARPHICPL.TXT`).
- Hanzi Writer: MIT.
- Audio: synthesised with MeloTTS (sherpa-onnx build).
- Skill names come from public-domain classical texts. Nothing is taken from 金庸's or 梁羽生's works.
