// Art paths. Style A (ink-wash) for scenes and portraits; style B (cartoon) only for the 典故 comics.
const B = import.meta.env.BASE_URL;

export const sceneSrc = (k) => `${B}art/scenes/${k}.webp`;
export const comicSrc = (id, n) => `${B}art/comics/${id}-${n}.webp`;
export const ptSrc = (k) => `${B}art/pt/${k}.webp`;

/** One portrait per speaker, reused everywhere they appear. */
export const PORTRAIT = { 墨老: 'molao', 青岚: 'qinglan', 小砚: 'xiaoyan', 柳先生: 'liu', 老金: 'laojin' };

/** Story chapter c (0-7) → boss art 1-8; the post-game 残影 is 9; the nameless 心魔 has none. */
export const bossArt = (boss) => (boss.kind === 'post' ? 9 : boss.kind === 'story' ? boss.c + 1 : null);

/** Backdrop per run node. */
export const NODE_BG = { duel: 'bg-duel', elite: 'bg-elite', inn: 'bg-inn', encounter: 'bg-encounter', library: 'bg-archive' };
