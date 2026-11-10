// The two halls of 文渊书院. H1 = 习字堂, H2 = 溯源堂 (adds the 原文 chapters, the 藏书楼 node and 原文 lines on bosses).
export const MENPAI = {
  H1: { name: '习字堂', track: 'H1', desc: '习字堂（H1）：练笔明义，学会共同成语库。' },
  H2: { name: '溯源堂', track: 'H2', desc: '溯源堂（H2）：寻根问典。藏经阁多出溯源卷，闯关多一处「藏书楼」，心魔会附上原文。' },
};
export const hallOf = (m) => MENPAI[m === 'H2' ? 'H2' : 'H1'];
