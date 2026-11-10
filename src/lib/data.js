import raw from '../data/idioms.json';
import story from '../data/story.json';
import { chaptersForList } from './chapters.js';

export const IDIOMS = raw.idioms;
export const CHAPTERS = raw.chapters;
export const BY_ID = Object.fromEntries(IDIOMS.map((it) => [it.id, it]));
export const STORY = story;

/** The chapter list a student sees: H1 students never see H2-only chapters; H2 students get them woven in. */
export const chaptersFor = (menpai) => chaptersForList(CHAPTERS, menpai);
