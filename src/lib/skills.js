// 武学 skill tree. Every skill name is a public-domain classical phrase; the card shows its source and meaning,
// so buying a skill is also reading a line of 古文. Effects reward good habits or give one-off help; none makes
// handwriting itself easier.
export const SKILLS = [
  { id: 'qian1', branch: '内功', name: '潜龙勿用', src: '《易经·乾卦》初九', text: '潜龙勿用。', mean: '龙潜伏在深渊，时机未到，不宜轻举妄动。比喻积蓄力量，等待时机。', effect: '气血上限 +10', cost: 40 },
  { id: 'qian2', branch: '内功', name: '见龙在田', src: '《易经·乾卦》九二', text: '见龙在田，利见大人。', mean: '龙出现在田野上，开始崭露头角。', effect: '对决心魔时，第一个成语多给一个字', cost: 60, req: 'qian1' },
  { id: 'qian3', branch: '内功', name: '终日乾乾', src: '《易经·乾卦》九三', text: '君子终日乾乾，夕惕若厉，无咎。', mean: '君子整天勤奋不懈，到了晚上仍警惕反省。', effect: '每天第一局结束时，额外 +20 内力入库', cost: 80, req: 'qian2' },
  { id: 'qian4', branch: '内功', name: '或跃在渊', src: '《易经·乾卦》九四', text: '或跃在渊，无咎。', mean: '龙或跃上天空，或退回深渊，能进能退。', effect: '每局第一次买线索免费', cost: 100, req: 'qian3' },
  { id: 'qian5', branch: '内功', name: '飞龙在天', src: '《易经·乾卦》九五', text: '飞龙在天，利见大人。', mean: '龙飞上天空。比喻到达事业的顶峰。', effect: '每破一个成语，回复 3 气血', cost: 130, req: 'qian4' },
  { id: 'qian6', branch: '内功', name: '亢龙有悔', src: '《易经·乾卦》上九', text: '亢龙有悔。', mean: '龙飞得太高，必有悔恨。比喻处在顶峰的人要懂得谦退。', effect: '每局第一笔写错不扣气血', cost: 160, req: 'qian5' },
  { id: 'wai1', branch: '外功', name: '入木三分', src: '唐·张怀瓘《书断》', text: '晋帝时祭北郊，更祝版，工人削之，笔入木三分。', mean: '形容王羲之书法笔力强劲；后也比喻见解深刻。', effect: '一笔不错写成的字，书写分 ×1.5', cost: 60 },
  { id: 'wai2', branch: '外功', name: '百步穿杨', src: '《战国策·西周策》', text: '楚有养由基者，善射；去柳叶者百步而射之，百发百中。', mean: '形容射术或本领非常高超。', effect: '整个成语一笔不错，额外 +50 分', cost: 100, req: 'wai1' },
  { id: 'wai3', branch: '外功', name: '运斤成风', src: '《庄子·徐无鬼》', text: '匠石运斤成风，听而斫之，尽垩而鼻不伤。', mean: '挥动斧头快得生风。形容手法纯熟，技艺高超。', effect: '速度奖励上限 300 → 450', cost: 140, req: 'wai2' },
  { id: 'qing1', branch: '轻功', name: '凌波微步', src: '三国·曹植《洛神赋》', text: '体迅飞凫，飘忽若神，凌波微步，罗袜生尘。', mean: '形容步履轻盈，像在水波上行走。', effect: '每局可以重排一次比武擂台', cost: 80 },
  { id: 'xin1', branch: '心法', name: '知己知彼', src: '《孙子·谋攻》', text: '知彼知己，百战不殆。', mean: '既了解对方，也了解自己，就不会失败。', effect: '对决心魔时，先看到每个成语的拼音首字母', cost: 60 },
  { id: 'xin2', branch: '心法', name: '庖丁解牛', src: '《庄子·养生主》', text: '依乎天理，批大郤，导大窾，因其固然。', mean: '比喻掌握了规律，做事得心应手。', effect: '客栈、奇遇、藏书楼的选择题，先去掉一个错误答案', cost: 100, req: 'xin1' },
];
export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const has = (state, id) => !!state.skills?.[id];
export const canBuy = (state, s) => !has(state, s.id) && (!s.req || has(state, s.req)) && state.qi >= s.cost;

/** Cosmetic ranks by number of idioms practised to 熟练 (secure). Not used for the leaderboard. */
export const RANKS = [[0, '初入江湖'], [10, '江湖新秀'], [30, '少侠'], [60, '大侠'], [100, '一代宗师']];
export const rankOf = (secure) => RANKS.filter(([n]) => secure >= n).at(-1)[1];
