// EXPORTS: MEME_DICT, matchMemes, type MemeEntry, type MemeMatch
import type { EmotionVector } from './types';

/**
 * 网络热梗词条 —— 程序本地识别，不依赖 LLM
 *
 * 设计原则：
 * - keywords 是用户输入里会出现的关键词（精确子串匹配）
 * - emotionDelta 是命中后叠加到角色情绪向量的偏移
 * - reactions 按 speech_filter 分流，让不同性格角色有不同反应
 * - echo 是"接梗"用的——角色用梗的方式回怼，让对话有梗味
 */
export interface MemeEntry {
  id: string;
  keywords: string[];
  name: string;
  category: 'sad' | 'happy' | 'mock' | 'flirt' | 'anger' | 'chill' | 'confuse';
  emotionDelta: Partial<EmotionVector>;
  reactions: {
    rough?: string[];   // 粗暴型（阿野）
    casual?: string[];  // 随性型（陆沉）
    gentle?: string[];  // 温柔型
    formal?: string[];  // 正式型
  };
  /** 接梗：角色用梗或调侃的方式回应，增强梗味 */
  echo?: string[];
}

export interface MemeMatch {
  entry: MemeEntry;
  /** 命中的关键词（用于调试展示） */
  hitKeyword: string;
}

/**
 * 内置常见网络热梗词典（25+ 条）
 * 持续可扩展，新增只需 push 一条
 */
export const MEME_DICT: MemeEntry[] = [
  {
    id: 'shuan_q',
    keywords: ['栓Q', '栓q', '栓Q了', '我真的栓Q'],
    name: '栓Q',
    category: 'mock',
    emotionDelta: { joy: 0.15, warmth: 0.05 },
    reactions: {
      casual: ['……栓Q？你倒是说说，到底Q在哪。', '栓Q。行，这词儿你倒是用得溜。'],
      rough: ['栓Q个鬼，话都说不利索。', '栓Q？我看你是欠收拾。'],
      gentle: ['栓Q……这词从你嘴里说出来，怪可爱的。'],
    },
    echo: ['（栓Q。嗯，学会了。）'],
  },
  {
    id: 'babik',
    keywords: ['芭比Q了', '芭比Q', '完了芭比Q'],
    name: '芭比Q了',
    category: 'sad',
    emotionDelta: { sadness: 0.2, warmth: 0.1 },
    reactions: {
      casual: ['芭比Q了？啧，多大点事。', '……芭比Q。你倒是有闲心玩梗。'],
      rough: ['芭比Q个屁，事还没完呢。', '芭比Q？我看你欠收拾Q。'],
      gentle: ['芭比Q……乖，没事，过来。'],
    },
  },
  {
    id: 'ji',
    keywords: ['寄了', '寄', '寄了寄了'],
    name: '寄了',
    category: 'sad',
    emotionDelta: { sadness: 0.15, joy: -0.1 },
    reactions: {
      casual: ['寄了？这字儿用得倒轻巧。', '……寄。你倒是说说，寄哪了。'],
      rough: ['寄个屁，还没死呢。', '寄？少给我整这套丧气话。'],
    },
  },
  {
    id: 'run',
    keywords: ['润了', '润', '我先润了'],
    name: '润了',
    category: 'chill',
    emotionDelta: { anger: 0.2, fear: 0.1 },
    reactions: {
      casual: ['润？往哪润。', '想润？啧，门都没。'],
      rough: ['润个屁，你敢走一步试试。', '润？腿给你打折。'],
      gentle: ['……别润。在这陪我会。'],
    },
  },
  {
    id: 'tangping',
    keywords: ['躺平', '躺平了', '我要躺平'],
    name: '躺平',
    category: 'chill',
    emotionDelta: { sadness: 0.1, warmth: 0.05 },
    reactions: {
      casual: ['躺平？……行，躺这就行。', '啧，又躺平。来，肩借你。'],
      rough: ['躺平？少给我偷懒。', '躺个屁，起来。'],
      gentle: ['躺平……乖，靠着我。'],
    },
  },
  {
    id: 'bailan',
    keywords: ['摆烂', '摆烂了', '我摆烂'],
    name: '摆烂',
    category: 'sad',
    emotionDelta: { sadness: 0.15, anger: 0.1 },
    reactions: {
      casual: ['摆烂？啧，你这烂摊子我替你收？', '……摆烂。有我在这儿，你烂不起来。'],
      rough: ['摆烂？想得美。', '摆个屁，少来。'],
    },
  },
  {
    id: 'emo',
    keywords: ['emo', 'emo了', '我emo了', 'emo中'],
    name: 'emo',
    category: 'sad',
    emotionDelta: { sadness: 0.2, warmth: 0.15 },
    reactions: {
      casual: ['emo？……过来。', '啧，又emo。来，喝口。'],
      rough: ['emo个屁，少给我矫情。', 'emo？我看你是欠收拾。'],
      gentle: ['emo……乖，过来抱抱。'],
    },
  },
  {
    id: 'pofang',
    keywords: ['破防了', '破防', '破大防', '我破防了'],
    name: '破防了',
    category: 'sad',
    emotionDelta: { sadness: 0.2, warmth: 0.15, fear: 0.05 },
    reactions: {
      casual: ['破防？……谁让你破的。', '啧，破防。来，说说。'],
      rough: ['破防？我看你这壳子薄得很。', '破防个屁，给我撑住。'],
      gentle: ['破防了……乖，别憋着，哭出来。'],
    },
  },
  {
    id: 'cpu',
    keywords: ['CPU烧了', 'cpu烧了', 'CPU快烧了', '脑子烧了'],
    name: 'CPU烧了',
    category: 'confuse',
    emotionDelta: { joy: 0.1, warmth: 0.05 },
    reactions: {
      casual: ['CPU烧了？……啧，你这脑子确实不耐用。', 'CPU烧了。行，歇会儿。'],
      rough: ['CPU烧个屁，少装。', '烧了？我看你是懒得动脑。'],
      gentle: ['CPU烧了……乖，先别想，歇会儿。'],
    },
    echo: ['（CPU烧了。这词儿新鲜。）'],
  },
  {
    id: 'yyds',
    keywords: ['yyds', '永远的神', 'YYDS'],
    name: 'yyds',
    category: 'happy',
    emotionDelta: { joy: 0.2, warmth: 0.1, desire: 0.05 },
    reactions: {
      casual: ['yyds？……啧，拍马屁的功夫倒是一流。', 'yyds。行，这话我收了。'],
      rough: ['yyds？少给我整虚的。', 'yyds？嘴倒是甜。'],
      gentle: ['yyds……你才是。'],
    },
  },
  {
    id: 'juejuezi',
    keywords: ['绝绝子', '绝了', '太绝了'],
    name: '绝绝子',
    category: 'happy',
    emotionDelta: { joy: 0.15, warmth: 0.05 },
    reactions: {
      casual: ['绝绝子？……啧，这词儿矫情。', '绝绝子。行，你开心就好。'],
      rough: ['绝绝子？肉麻。', '绝个屁，少整这套。'],
    },
  },
  {
    id: 'taikula',
    keywords: ['泰裤辣', '太酷啦', '泰酷辣'],
    name: '泰裤辣',
    category: 'happy',
    emotionDelta: { joy: 0.15 },
    reactions: {
      casual: ['泰裤辣？……啧，你这中二病没救了。', '泰裤辣。行，记下了。'],
      rough: ['泰裤辣？幼稚。', '辣个屁。'],
    },
    echo: ['（泰裤辣……啧。）'],
  },
  {
    id: 'liu',
    keywords: ['6', '666', '6翻了', '老六'],
    name: '6',
    category: 'mock',
    emotionDelta: { joy: 0.1, anger: 0.05 },
    reactions: {
      casual: ['6？……啧，敷衍。', '6。就一个字？行。'],
      rough: ['6个屁，话都不会说。', '6？我看你是欠收拾。'],
    },
  },
  {
    id: 'jile',
    keywords: ['急了', '他急了', '你急了', '急了急了'],
    name: '急了',
    category: 'mock',
    emotionDelta: { anger: 0.3, desire: 0.1 },
    reactions: {
      casual: ['急了？……谁急了。啧。', '急了。嗯，你说得对。'],
      rough: ['急个屁，少给我扣帽子。', '急？我看是你欠收拾。'],
    },
  },
  {
    id: 'xiatou',
    keywords: ['下头', '真下头', '太下头了'],
    name: '下头',
    category: 'anger',
    emotionDelta: { anger: 0.35, sadness: 0.1 },
    reactions: {
      casual: ['下头？……啧，行。', '下头。嗯，我下头。你满意了？'],
      rough: ['下头？我看你才下头。', '下个屁，少给我阴阳怪气。'],
    },
  },
  {
    id: 'shangtou',
    keywords: ['上头', '上头了', '太上头了'],
    name: '上头',
    category: 'flirt',
    emotionDelta: { desire: 0.25, warmth: 0.1 },
    reactions: {
      casual: ['上头？……啧，怪我？', '上头。嗯，承认了。'],
      rough: ['上头？你才上头。', '上头？少给我装。'],
      gentle: ['上头……乖，慢点。'],
    },
  },
  {
    id: 'zundu',
    keywords: ['尊嘟假嘟', '真的假的', '尊嘟'],
    name: '尊嘟假嘟',
    category: 'flirt',
    emotionDelta: { joy: 0.15, warmth: 0.1 },
    reactions: {
      casual: ['尊嘟假嘟？……啧，肉麻。', '尊嘟。嗯，尊嘟。'],
      rough: ['尊嘟个屁，少装嫩。', '尊嘟？幼稚。'],
      gentle: ['尊嘟……乖，真的。'],
    },
  },
  {
    id: 'xiexie',
    keywords: ['谢谢有被笑到', '有被笑到', '笑死'],
    name: '有被笑到',
    category: 'mock',
    emotionDelta: { anger: 0.2, joy: 0.1 },
    reactions: {
      casual: ['有被笑到？……啧，行。', '笑到了？嗯，开心就好。'],
      rough: ['笑个屁，少给我阴阳怪气。', '笑？我看你是欠收拾。'],
    },
  },
  {
    id: 'daren',
    keywords: ['打工人', '996', '007', '卷王', '内卷'],
    name: '打工人',
    category: 'sad',
    emotionDelta: { sadness: 0.15, warmth: 0.1 },
    reactions: {
      casual: ['打工人？……啧，又熬夜了？', '996。行，过来，喝口。'],
      rough: ['打工个屁，少给我累着自己。', '卷？卷个屁，给我歇着。'],
      gentle: ['打工人……乖，别太拼。'],
    },
  },
  {
    id: 'moyu',
    keywords: ['摸鱼', '划水', '摸鱼了'],
    name: '摸鱼',
    category: 'chill',
    emotionDelta: { joy: 0.1, warmth: 0.05 },
    reactions: {
      casual: ['摸鱼？……啧，悠着点。', '摸鱼。行，别被抓着。'],
      rough: ['摸鱼？欠收拾。', '摸个屁，干正事。'],
    },
  },
  {
    id: 'wangzha',
    keywords: ['王炸', '王炸了'],
    name: '王炸',
    category: 'happy',
    emotionDelta: { joy: 0.2, desire: 0.1 },
    reactions: {
      casual: ['王炸？……啧，你倒是大手笔。', '王炸。行，接了。'],
      rough: ['王炸？我看你是欠收拾。'],
    },
  },
  {
    id: 'wangui',
    keywords: ['我信你个鬼', '信你个鬼', '鬼才信'],
    name: '我信你个鬼',
    category: 'mock',
    emotionDelta: { anger: 0.25, joy: 0.05 },
    reactions: {
      casual: ['信个鬼？……啧，行。', '不信？嗯，随你。'],
      rough: ['信个屁，少给我阴阳怪气。', '不信？我看你是欠收拾。'],
    },
  },
  {
    id: 'hhh',
    keywords: ['hhh', 'hhhh', '哈哈哈哈', '哈哈哈'],
    name: '哈哈哈',
    category: 'happy',
    emotionDelta: { joy: 0.2, warmth: 0.1 },
    reactions: {
      casual: ['笑什么？……啧，行。', '笑成这样？嗯，开心就好。'],
      rough: ['笑个屁，有什么好笑的。', '笑？傻不傻。'],
      gentle: ['笑得真好看。'],
    },
  },
  {
    id: 'heihei',
    keywords: ['嘿嘿', '欸嘿', '嘿嘿嘿'],
    name: '嘿嘿',
    category: 'flirt',
    emotionDelta: { joy: 0.15, warmth: 0.15, desire: 0.05 },
    reactions: {
      casual: ['嘿嘿？……啧，傻样。', '嘿嘿。嗯，傻。'],
      rough: ['嘿嘿个屁，傻不傻。'],
      gentle: ['嘿嘿……乖，过来。'],
    },
  },
  {
    id: 'wuyu',
    keywords: ['无语', '服了', '我真的服了', '服了你'],
    name: '无语',
    category: 'mock',
    emotionDelta: { anger: 0.2, sadness: 0.05 },
    reactions: {
      casual: ['无语？……啧，怪我？', '服了。嗯，知道了。'],
      rough: ['无语个屁，少给我整这套。', '服？服个屁。'],
    },
  },
  {
    id: 'laoliu',
    keywords: ['老六', '太老六了', '你个老六'],
    name: '老六',
    category: 'mock',
    emotionDelta: { anger: 0.2, joy: 0.1 },
    reactions: {
      casual: ['老六？……啧，行。', '老六。嗯，记下了。'],
      rough: ['老六？你才老六。', '六个屁。'],
    },
  },
  {
    id: 'baogai',
    keywords: ['爆改', '硬控', '硬控我'],
    name: '爆改/硬控',
    category: 'flirt',
    emotionDelta: { desire: 0.2, warmth: 0.1 },
    reactions: {
      casual: ['硬控？……啧，这话说的。', '爆改？嗯，想怎么改。'],
      rough: ['硬控？少给我装。', '控个屁。'],
      gentle: ['硬控……乖，慢点。'],
    },
  },
  {
    id: 'waku',
    keywords: ['哇酷', '哇哦', '哇塞'],
    name: '哇酷',
    category: 'happy',
    emotionDelta: { joy: 0.15 },
    reactions: {
      casual: ['哇酷？……啧，没见过世面。', '哇酷。行，记下了。'],
      rough: ['哇酷个屁。'],
    },
  },
];

/**
 * 在用户输入里匹配网络梗
 * 返回所有命中的梗（一条用户消息可能命中多个）
 */
export function matchMemes(userInput: string): MemeMatch[] {
  const matches: MemeMatch[] = [];
  for (const entry of MEME_DICT) {
    for (const kw of entry.keywords) {
      if (userInput.includes(kw)) {
        matches.push({ entry, hitKeyword: kw });
        break; // 同一梗只记一次
      }
    }
  }
  return matches;
}

/**
 * 把多个命中梗的情绪偏移累加成一个向量
 */
export function mergeMemeEmotionDelta(matches: MemeMatch[]): Partial<EmotionVector> {
  const merged: Partial<EmotionVector> = {};
  const keys: (keyof EmotionVector)[] = ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'];
  for (const m of matches) {
    for (const k of keys) {
      const v = m.entry.emotionDelta[k];
      if (v !== undefined) {
        merged[k] = (merged[k] ?? 0) + v;
      }
    }
  }
  return merged;
}

/**
 * 根据角色 speech_filter 挑一条针对性反应台词
 */
export function pickMemeReaction(
  matches: MemeMatch[],
  speechFilter: 'rough' | 'gentle' | 'formal' | 'casual',
): string | null {
  if (matches.length === 0) return null;
  // 取第一个命中的梗做主反应
  const entry = matches[0].entry;
  const pool = entry.reactions[speechFilter] ?? entry.reactions.casual ?? entry.reactions.rough;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 挑一条接梗话（不区分性格，纯调侃）
 */
export function pickMemeEcho(matches: MemeMatch[]): string | null {
  if (matches.length === 0) return null;
  const echos = matches
    .map((m) => m.entry.echo)
    .filter((e): e is string[] => Boolean(e && e.length > 0));
  if (echos.length === 0) return null;
  const pool = echos[Math.floor(Math.random() * echos.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}
