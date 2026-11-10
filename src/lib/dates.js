// Day numbers are whole days since 1970-01-01, counted in the student's LOCAL calendar.
// Using integers makes "how many days since…" and week maths trivial and DST-proof.
export function dayNumber(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
export function isoFromDay(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}
export function dayFromIso(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
}
/** Monday of the week containing day n. */
export function weekStart(n) {
  const dow = (new Date(n * 86400000).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return n - dow;
}
