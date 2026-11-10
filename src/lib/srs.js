// Leitner-style spaced repetition. Six boxes (0–5); the box number is how far a
// headword has climbed. Wait time after reaching a box:
export const INTERVALS = [0, 1, 2, 4, 8, 16]; // days
export const MAX_BOX = 5;

export function newCard(today) {
  return { b: 0, due: today, seen: 0, ok: 0, bad: 0, lapses: 0, hint: 0, last: today };
}

/** new → learning → reviewing → secure */
export function statusOf(card) {
  if (!card) return 'new';
  if (card.b >= MAX_BOX) return 'secure';
  if (card.b >= 2) return 'reviewing';
  return 'learning';
}

export function isDue(card, today) {
  return !!card && card.due <= today;
}

/**
 * outcome: 'good'  – answered correctly, no help
 *          'hint'  – answered correctly but used a hint (holds position, back tomorrow)
 *          'again' – answered wrongly (drops two boxes, comes back today)
 * A card only climbs when it is actually due, so drilling a word you already
 * know five times in a row cannot push it to "secure" early.
 */
export function applyReview(card, outcome, today) {
  const wasDue = card.due <= today;
  const c = { ...card, seen: card.seen + 1, last: today };
  if (outcome === 'good') {
    c.ok = card.ok + 1;
    if (wasDue) {
      c.b = Math.min(MAX_BOX, card.b + 1);
      c.due = today + INTERVALS[c.b];
    }
  } else if (outcome === 'hint') {
    c.hint = (card.hint || 0) + 1;
    if (wasDue) c.due = today + 1;
  } else {
    c.bad = card.bad + 1;
    if (card.b >= 2) c.lapses = card.lapses + 1;
    c.b = Math.max(0, card.b - 2);
    c.due = today;
  }
  return c;
}
