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
  { id: 'wai4', branch: '外功', name: '铁画银钩', src: '唐·欧阳询《用笔论》', text: '徘徊俯仰，容与风流，刚则铁画，媚若银钩。', mean: '形容书法刚健又秀美：笔画像铁铸，钩像银打。', effect: '心魔一字不差的奖励 150 → 225 分', cost: 180, req: 'wai3' },
  { id: 'wai5', branch: '外功', name: '力透纸背', src: '唐·颜真卿《张长史十二意笔法记》', text: '当其用锋，常欲使其透过纸背，此成功之极矣。', mean: '形容书法笔力强劲；也比喻文章深刻有力。', effect: '一笔不错写成的字，每个再 +1 内力', cost: 220, req: 'wai4' },
  { id: 'wai6', branch: '外功', name: '一字千金', src: '《史记·吕不韦列传》', text: '布咸阳市门，悬千金其上，延诸侯游士宾客有能增损一字者予千金。', mean: '称赞文字精当，一个字也值千金。', effect: '每破一个成语 100 → 120 分', cost: 260, req: 'wai5' },
  { id: 'qing1', branch: '轻功', name: '凌波微步', src: '三国·曹植《洛神赋》', text: '体迅飞凫，飘忽若神，凌波微步，罗袜生尘。', mean: '形容步履轻盈，像在水波上行走。', effect: '每局可以重排一次比武擂台', cost: 80 },
  { id: 'qing2', branch: '轻功', name: '翩若惊鸿', src: '三国·曹植《洛神赋》', text: '其形也，翩若惊鸿，婉若游龙。', mean: '形容姿态轻盈，像受惊飞起的鸿雁。', effect: '客栈恢复气血 25 → 40', cost: 120, req: 'qing1' },
  { id: 'qing3', branch: '轻功', name: '御风而行', src: '《庄子·逍遥游》', text: '夫列子御风而行，泠然善也，旬有五日而后反。', mean: '乘着风飞行。形容轻盈自在，不受拘束。', effect: '每局一次：气血耗尽时花 50 内力，以 30 气血再起', cost: 200, req: 'qing2' },
  { id: 'xin1', branch: '心法', name: '知己知彼', src: '《孙子·谋攻》', text: '知彼知己，百战不殆。', mean: '既了解对方，也了解自己，就不会失败。', effect: '对决心魔时，先看到每个成语的拼音首字母', cost: 60 },
  { id: 'xin2', branch: '心法', name: '庖丁解牛', src: '《庄子·养生主》', text: '依乎天理，批大郤，导大窾，因其固然。', mean: '比喻掌握了规律，做事得心应手。', effect: '客栈、奇遇、藏书楼的选择题，先去掉一个错误答案', cost: 100, req: 'xin1' },
  { id: 'xin3', branch: '心法', name: '胸有成竹', src: '宋·苏轼《文与可画筼筜谷偃竹记》', text: '故画竹，必先得成竹于胸中。', mean: '画竹之前，心里已有竹子的完整样子。比喻做事之前已有通盘的打算。', effect: '对决心魔时，每场可以免费看一次例句（成语挖空）', cost: 160, req: 'xin2' },
];
export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** 由来: where each name comes from, in a sentence or two. */
export const ORIGIN = {
  qian1: '乾卦六爻，以龙的升腾比喻君子处世。初九在最下一爻，龙还潜在深渊里，所以说“勿用”。',
  qian2: '九二，龙离开深渊，出现在田野上。人开始崭露头角，也该去请教“大人”。',
  qian3: '九三，“乾乾”是勤勉不息。君子白天努力，到了晚上还在反省，这样才没有过失。',
  qian4: '九四，处在上下之间。龙可以跃起，也可以退回深渊，懂得审时度势。',
  qian5: '九五，最尊贵的位置，“九五之尊”一词就从这里来。',
  qian6: '上九，龙飞到了最高处，再往上就要后悔。提醒人盛极必衰，要懂得谦退。',
  wai1: '王羲之在木板上写祝词，工匠后来削木重写，发现他的墨迹透进木头三分深。',
  wai2: '楚国神射手养由基，站在一百步外射柳叶，百发百中。',
  wai3: '郢人在鼻尖抹上一点白灰，匠石挥动斧头快得生风，削尽白灰，鼻子却毫发无伤。',
  qing1: '曹植在《洛神赋》里描写洛水女神，在水波上轻盈地行走，罗袜都扬起了细尘。',
  xin1: '孙子论用兵：既了解敌人，也了解自己，打一百仗也不会有危险。',
  xin2: '厨师为文惠君宰牛，顺着牛身的自然纹理下刀，用了十九年，刀刃还像新磨的一样。',
  wai4: '欧阳询论用笔：刚劲的笔画像铁铸出来的，秀美的钩像银子打出来的。后人用来称赞书法。',
  wai5: '颜真卿向张旭请教笔法。张旭说，下笔要像能透过纸的背面一样，笔力才算到了家。',
  wai6: '吕不韦编成《吕氏春秋》，挂在咸阳城门上，说谁能增删一个字，就赏千金。',
  qing2: '还是《洛神赋》：曹植形容洛神体态轻盈，像惊飞的鸿雁，又像游动的龙。',
  qing3: '庄子说，列子能乘着风飞行，轻妙自在，过了十五天才回来。',
  xin3: '苏轼记好友文与可画竹：还没动笔，竹子的样子早已在他心中。',
};

/** The three 秘籍 on the 武学 shelf. chart: how the first page is drawn; pos: marker centre in % of the chart;
 *  side: where the seal label sits next to the marker. */
export const BOOKS = [
  { id: 'qian', title: '乾元经', sub: '内功 · 乾卦六爻', chart: 'meridian', ids: ['qian1', 'qian2', 'qian3', 'qian4', 'qian5', 'qian6'],
    note: '真气从丹田起，循任督上行至百会：初九潜龙，上九亢龙。',
    points: ['气海', '中脘', '膻中', '天突', '印堂', '百会'],
    pos: { qian1: [49.6, 64, 'r'], qian2: [49.6, 56.5, 'l'], qian3: [49.6, 45.2, 'r'], qian4: [49.6, 35.5, 'l'], qian5: [49.6, 16.8, 'r'], qian6: [49.6, 6.6, 'l'] } },
  { id: 'bi', title: '入木笔诀', sub: '外功 · 书写的功夫', chart: 'sword', ids: ['wai1', 'wai2', 'wai3', 'wai4', 'wai5', 'wai6'],
    note: '剑谱自右而左：笔力、准头、速度，再到一字千金。',
    pos: { wai1: [72, 34], wai2: [72, 63], wai3: [72, 93], wai4: [30, 34], wai5: [30, 63], wai6: [30, 93] } },
  { id: 'nan', title: '南华心诀', sub: '轻功与心法', chart: 'go', ids: ['qing1', 'qing2', 'qing3', 'xin1', 'xin2', 'xin3'],
    note: '黑子一路是轻功，白子一路是心法。',
    pos: { qing1: [9, 2, 'r'], qing2: [9, 6, 'r'], qing3: [9, 10, 'r'], xin1: [3, 2, 'l'], xin2: [3, 6, 'l'], xin3: [3, 10, 'l'] } },
];
export const has = (state, id) => !!state.skills?.[id];
export const canBuy = (state, s) => !has(state, s.id) && (!s.req || has(state, s.req)) && state.qi >= s.cost;

/** Cosmetic ranks by number of idioms practised to 熟练 (secure). Not used for the leaderboard. */
export const RANKS = [[0, '初入江湖'], [10, '江湖新秀'], [30, '少侠'], [60, '大侠'], [100, '一代宗师']];
export const rankOf = (secure) => RANKS.filter(([n]) => secure >= n).at(-1)[1];
/** 0-based index of the 境界 reached. */
export const rankIndex = (secure) => RANKS.filter(([n]) => secure >= n).length - 1;
