import raw from '../data/idioms.json';

export const IDIOMS = raw.idioms;
export const CHAPTERS = raw.chapters;
export const BY_ID = Object.fromEntries(IDIOMS.map((it) => [it.id, it]));
export const chapterOf = (id) => BY_ID[id]?.ch ?? 0;
