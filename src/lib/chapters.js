// Pure helper (no JSON imports) so tests can use it.
// H2 chapters are woven into the shared list after every second shared chapter: 1, 2, H2, 3, 4, H2, …
export function chaptersForList(chapters, menpai) {
  const shared = chapters.filter((c) => c.track !== 'H2');
  if (menpai !== 'H2') return shared;
  const h2 = chapters.filter((c) => c.track === 'H2');
  const out = [];
  shared.forEach((c, i) => {
    out.push(c);
    if (i % 2 === 1 && h2.length) out.push(h2.shift());
  });
  return out.concat(h2);
}

/** A chapter counts as learnt once 80% of its idioms are in the student's 秘籍. */
export function chapterDone(state, ch) {
  return ch.ids.filter((id) => state.cards[id]).length >= Math.ceil(ch.ids.length * 0.8);
}
