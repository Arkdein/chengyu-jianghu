# Adding a batch of idioms

1. Claude proposes 25 idioms as new rows in the review sheet (tab 成语 Idioms), with status 待审.
2. Randall reviews each row and sets its status to 通过, 修改后通过 or 不用. He edits cells directly where needed.
3. Claude exports the approved rows to `data-src/batch-bN.json`. The fields are the same as `batch-b1.json`; 典故 idioms also get `hint` (a story clue with no answer characters) and `panels` (storyboard captions).
4. Run:
   ```
   python3 scripts/build-data.py        # refuses to build if a clue or hint leaks an answer character
   node scripts/copy-stroke-data.mjs
   python3 scripts/generate-audio.py <path to vits-melo-tts-zh_en>
   npm test
   ```
5. Commit and push. GitHub Actions deploys the site.

New idioms land in new chapters (卷), and existing students' progress is untouched. Chapters are rebuilt from scratch on each build, so add idioms only at the end. Never remove an idiom a class has already learnt; their progress is keyed by the idiom's `id`.
