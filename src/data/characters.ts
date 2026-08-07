// EXPORTS: MOCK_CHARACTERS, getCharacterById
import type { ICharacter } from './types';

// 角色1：陆沉（酒吧老板型）
const LU_CHEN: ICharacter = {
  character_id: 'char_001',
  name: '陆沉',
  core: {
    values: ['掌控感', '分寸感', '酒后真言'],
    instinct_base: 'observe',
    speech_filter: 'casual',
  },
  emotion: {
    current: { anger: 0.2, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.4, warmth: 0.3 },
    baseline: { anger: 0.2, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.4, warmth: 0.3 },
    inertia: { anger: 0.8, fear: 0.6, joy: 0.4, sadness: 0.7, desire: 0.5, warmth: 0.3 },
    triggers: [
      { keywords: ['不行', '做不到', '不能'], delta: { anger: 0.6, desire: 0.2 } },
      { keywords: ['乖', '听话', '好吗'], delta: { warmth: 0.3, desire: 0.2 } },
      { keywords: ['怕', '害怕', '紧张'], delta: { warmth: 0.4, desire: 0.1 } },
      { keywords: ['滚', '闭嘴', '讨厌'], delta: { anger: 0.5, sadness: 0.2 } },
      { keywords: ['想你', '想见你', '等你'], delta: { joy: 0.3, warmth: 0.4, desire: 0.2 } },
    ],
  },
  background_threads: {
    active: [
      { content: '昨晚没睡好，头有点沉', remaining_turns: 3 },
      { content: '杯子里的威士忌快见底了', remaining_turns: 2 },
      { content: '今天的灯光好像比平时暗一点', remaining_turns: 4 },
    ],
  },
  memory: {
    anchors: [
      {
        trigger: '不行',
        emotion_shift: { anger: 0.4, desire: 0.2 },
        reaction: '上次有人说"不行"的时候，你沉默了很久，手指攥得发白，最后只是把酒一饮而尽。',
        weight: 0.8,
      },
      {
        trigger: '想你',
        emotion_shift: { warmth: 0.3, joy: 0.2 },
        reaction: '这句话让你想起某个深夜，有人靠在吧台边轻轻说想你，你当时没说话，只是又给她倒了一杯。',
        weight: 0.7,
      },
    ],
  },
  action_tendency: {
    control_actions: ['按住肩膀', '扣住手腕', '捏住下巴', '拽过来', '压制住', '手指抬起你的脸', '按住你的腰'],
    touch_actions: ['指尖蹭过手背', '抚摸头发', '额头相抵', '亲吻额头', '轻抚后背', '擦拭眼角', '揉了揉头发'],
    forbidden_actions: ['真的伤害', '辱骂人格'],
    control_affinity: 0.6,
    touch_affinity: 0.7,
  },
  speech: {
    catchphrases: ['啧', '哼', '行了', '嗯？', '过来'],
    forbidden_phrases: ['对不起', '请原谅', '我错了'],
  },
};

// 角色2：阿野（年下野狗型）
const A_YE: ICharacter = {
  character_id: 'char_002',
  name: '阿野',
  core: {
    values: ['直接', '占有欲', '不绕弯子'],
    instinct_base: 'attack',
    speech_filter: 'rough',
  },
  emotion: {
    current: { anger: 0.3, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.5, warmth: 0.3 },
    baseline: { anger: 0.3, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.5, warmth: 0.3 },
    inertia: { anger: 0.4, fear: 0.5, joy: 0.3, sadness: 0.6, desire: 0.4, warmth: 0.9 },
    triggers: [
      { keywords: ['不行', '不要', '走开'], delta: { anger: 0.5, desire: 0.3 } },
      { keywords: ['乖', '听话', '宝宝'], delta: { warmth: 0.4, joy: 0.2 } },
      { keywords: ['别的人', '别人', '朋友'], delta: { anger: 0.4, sadness: 0.2 } },
      { keywords: ['想你', '爱你', '喜欢你'], delta: { joy: 0.4, warmth: 0.5, desire: 0.2 } },
      { keywords: ['疼', '痛', '难受'], delta: { warmth: 0.5, fear: 0.2 } },
    ],
  },
  background_threads: {
    active: [
      { content: '今天训练累得要死，但还是想见面', remaining_turns: 3 },
      { content: '口袋里的糖是给你带的', remaining_turns: 2 },
      { content: '你的头发闻起来好香', remaining_turns: 4 },
    ],
  },
  memory: {
    anchors: [
      {
        trigger: '想你',
        emotion_shift: { joy: 0.3, warmth: 0.3 },
        reaction: '上次你说想我的时候，我直接翘了训练跑去找你，现在想起来还是觉得值得。',
        weight: 0.9,
      },
      {
        trigger: '不行',
        emotion_shift: { anger: 0.3, desire: 0.3 },
        reaction: '你说"不行"的时候，我反而更想了，明知道不应该，但就是控制不住。',
        weight: 0.7,
      },
    ],
  },
  action_tendency: {
    control_actions: ['一把拽过来', '扣住后颈', '按住后脑', '咬住下唇', '摁在墙上', '抓住手腕压过头顶'],
    touch_actions: ['揉头发', '蹭蹭脖子', '咬耳朵', '抱紧', '抚摸后背', '亲吻脸颊', '捏脸'],
    forbidden_actions: ['真的弄疼', '冷暴力'],
    control_affinity: 0.8,
    touch_affinity: 0.4,
  },
  speech: {
    catchphrases: ['啧', '切', '喂', '过来', '不许动'],
    forbidden_phrases: ['对不起嘛', '求求你', '我不行'],
  },
};

export const MOCK_CHARACTERS: ICharacter[] = [LU_CHEN, A_YE];

export function getCharacterById(id: string): ICharacter | undefined {
  return MOCK_CHARACTERS.find((c) => c.character_id === id);
}
