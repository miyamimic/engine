// EXPORTS: PreprocessorResult, runPreprocessor
import type {
  ICharacter,
  EmotionVector,
  BackgroundThread,
  MemoryAnchor,
  ChatMessage,
} from '../data/types';
import {
  updateEmotionWithInertia,
  addEmotion,
  scaleEmotion,
  describeEmotion,
  INSTINCT_DESCRIPTIONS,
  SPEECH_FILTER_DESCRIPTIONS,
} from './emotion';
import {
  matchMemes,
  mergeMemeEmotionDelta,
  type MemeMatch,
} from '../data/memeDict';

export interface PreprocessorResult {
  newEmotion: EmotionVector;
  triggerDelta: Partial<EmotionVector>;
  memeMatches: MemeMatch[];
  drawnThreads: BackgroundThread[];
  updatedThreads: BackgroundThread[];
  triggeredAnchors: MemoryAnchor[];
  memoryReactions: string[];
  prompt: string;
}

/**
 * 步骤1：解析用户输入，匹配 triggers
 * 遍历 emotion.triggers，检查用户输入是否包含任一关键词
 * 累加所有命中的偏移量，得到 triggerDelta 向量
 */
export function matchTriggers(
  userInput: string,
  triggers: { keywords: string[]; delta: Partial<EmotionVector> }[],
): Partial<EmotionVector> {
  const delta: Partial<EmotionVector> = {};
  const keys: (keyof EmotionVector)[] = ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'];

  triggers.forEach((trigger) => {
    const hit = trigger.keywords.some((kw) => userInput.includes(kw));
    if (hit) {
      keys.forEach((k) => {
        const d = trigger.delta[k];
        if (d !== undefined) {
          delta[k] = (delta[k] ?? 0) + d;
        }
      });
    }
  });

  return delta;
}

/**
 * 步骤3：后台思绪处理
 * 从 background_threads.active 中随机抽取 1~2 条活跃思绪
 * 将被抽取思绪的 remaining_turns 减 1
 * 移除所有 remaining_turns <= 0 的思绪
 */
export function processBackgroundThreads(
  threads: BackgroundThread[],
): { drawn: BackgroundThread[]; updated: BackgroundThread[] } {
  if (threads.length === 0) {
    return { drawn: [], updated: [] };
  }

  // 随机抽 1~2 条
  const drawCount = Math.min(threads.length, Math.floor(Math.random() * 2) + 1);
  const shuffled = [...threads].sort(() => Math.random() - 0.5);
  const drawn = shuffled.slice(0, drawCount);

  // 更新 remaining_turns，移除过期的
  const drawnSet = new Set(drawn.map((t) => t.content));
  const updated = threads
    .map((t) => {
      if (drawnSet.has(t.content)) {
        return { ...t, remaining_turns: t.remaining_turns - 1 };
      }
      return t;
    })
    .filter((t) => t.remaining_turns > 0);

  return { drawn, updated };
}

/**
 * 步骤4：记忆锚点检查
 * 遍历 memory.anchors，检查用户输入是否包含 trigger 关键词
 * 命中的锚点：emotion_shift * weight 叠加到当前情绪向量
 * 命中的锚点 reaction 文本收集起来
 */
export function checkMemoryAnchors(
  userInput: string,
  anchors: MemoryAnchor[],
): { anchors: MemoryAnchor[]; emotionDelta: Partial<EmotionVector>; reactions: string[] } {
  const hitAnchors: MemoryAnchor[] = [];
  const emotionDelta: Partial<EmotionVector> = {};
  const reactions: string[] = [];
  const keys: (keyof EmotionVector)[] = ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'];

  anchors.forEach((anchor) => {
    if (userInput.includes(anchor.trigger)) {
      hitAnchors.push(anchor);
      reactions.push(anchor.reaction);

      const scaled = scaleEmotion(anchor.emotion_shift, anchor.weight);
      keys.forEach((k) => {
        const v = scaled[k];
        if (v !== undefined) {
          emotionDelta[k] = (emotionDelta[k] ?? 0) + v;
        }
      });
    }
  });

  return { anchors: hitAnchors, emotionDelta, reactions };
}

/**
 * 步骤5：组装结构化提示词
 */
export function buildPrompt(
  character: ICharacter,
  emotion: EmotionVector,
  drawnThreads: BackgroundThread[],
  memoryReactions: string[],
  recentMessages: ChatMessage[],
  userInput: string,
  memeMatches: MemeMatch[] = [],
): string {
  const { core, action_tendency } = character;

  const lines: string[] = [];

  lines.push('[系统人格]');
  lines.push(`名字：${character.name}`);
  lines.push(`核心价值观：${core.values.join('、')}`);
  lines.push(`本能基线：${INSTINCT_DESCRIPTIONS[core.instinct_base]}`);
  lines.push(`表达风格：${SPEECH_FILTER_DESCRIPTIONS[core.speech_filter]}`);
  lines.push('');

  lines.push('[当前情绪状态]');
  lines.push(
    `愤怒：${emotion.anger.toFixed(2)}，恐惧：${emotion.fear.toFixed(2)}，喜悦：${emotion.joy.toFixed(2)}，悲伤：${emotion.sadness.toFixed(2)}，欲望：${emotion.desire.toFixed(2)}，温情：${emotion.warmth.toFixed(2)}`,
  );
  lines.push(describeEmotion(emotion));
  lines.push('');

  lines.push('[网络梗识别]');
  if (memeMatches.length > 0) {
    lines.push(`用户使用了 ${memeMatches.length} 个网络梗：`);
    memeMatches.forEach((m) => {
      const cats: Record<string, string> = {
        sad: '丧',
        happy: '开心',
        mock: '调侃',
        flirt: '撩',
        anger: '挑衅',
        chill: '摆烂',
        confuse: '困惑',
      };
      lines.push(`- 《${m.entry.name}》（关键词：${m.hitKeyword}，类型：${cats[m.entry.category]}）`);
    });
    lines.push('提示：用户在用梗互动，回应应识别梗并带点梗味，不要无视。');
  } else {
    lines.push('（用户未使用已知网络梗）');
  }
  lines.push('');

  lines.push('[后台思绪]');
  if (drawnThreads.length > 0) {
    drawnThreads.forEach((t) => lines.push(`- ${t.content}`));
  } else {
    lines.push('- （没有特别的思绪）');
  }
  lines.push('');

  lines.push('[记忆唤起]');
  if (memoryReactions.length > 0) {
    memoryReactions.forEach((r) => lines.push(r));
  } else {
    lines.push('（没有特别的记忆被唤起）');
  }
  lines.push('');

  lines.push('[对话历史]');
  if (recentMessages.length > 0) {
    recentMessages.forEach((m) => {
      const speaker = m.role === 'user' ? '用户' : character.name;
      lines.push(`${speaker}：${m.content}`);
    });
  } else {
    lines.push('（这是第一次对话）');
  }
  lines.push('');

  lines.push('[用户输入]');
  lines.push(userInput);
  lines.push('');

  lines.push('[硬性输出格式约束]');
  lines.push('1. 必须使用第一人称"我"，禁止第三人称');
  lines.push('2. 禁止使用情绪状语（如"冷静地"、"温柔地"、"愤怒地"）');
  lines.push('3. 动作用*包裹，心理活动用()包裹，其余为言语');
  lines.push('4. 回复中必须同时包含至少一个控制类动作和至少一个触碰类温情动作');
  lines.push(`5. 控制类动作参考：${action_tendency.control_actions.slice(0, 5).join('、')}`);
  lines.push(`6. 触碰类动作参考：${action_tendency.touch_actions.slice(0, 5).join('、')}`);
  lines.push('7. 回复不要太长，3-5句话以内，符合口语习惯');

  return lines.join('\n');
}

/**
 * 完整预处理管道
 */
export function runPreprocessor(
  userInput: string,
  character: ICharacter,
  allMessages: ChatMessage[],
): PreprocessorResult {
  // 步骤1：trigger 匹配
  const triggerDelta = matchTriggers(userInput, character.emotion.triggers);

  // 步骤1.5：网络梗识别（本地词典匹配，不依赖 LLM）
  const memeMatches = matchMemes(userInput);
  const memeDelta = mergeMemeEmotionDelta(memeMatches);

  // 把梗的 delta 合并到 trigger delta，一起进入情绪惯性更新
  const keys: (keyof EmotionVector)[] = ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'];
  const combinedDelta: Partial<EmotionVector> = { ...triggerDelta };
  for (const k of keys) {
    const v = memeDelta[k];
    if (v !== undefined) {
      combinedDelta[k] = (combinedDelta[k] ?? 0) + v;
    }
  }

  // 步骤2：情绪惯性更新（先应用 trigger+梗 delta 到 target）
  let newEmotion = updateEmotionWithInertia(
    character.emotion.current,
    character.emotion.baseline,
    character.emotion.inertia,
    combinedDelta,
  );

  // 步骤3：后台思绪处理
  const { drawn: drawnThreads, updated: updatedThreads } = processBackgroundThreads(
    character.background_threads.active,
  );

  // 步骤4：记忆锚点检查
  const {
    anchors: triggeredAnchors,
    emotionDelta: memoryDelta,
    reactions: memoryReactions,
  } = checkMemoryAnchors(userInput, character.memory.anchors);

  // 将记忆锚点的情绪偏移叠加
  newEmotion = addEmotion(newEmotion, memoryDelta);

  // 获取最近3轮对话（用户+角色各算一条，取最近6条中的对话摘要）
  const recentMessages = allMessages.slice(-6);

  // 步骤5：组装提示词
  const prompt = buildPrompt(
    character,
    newEmotion,
    drawnThreads,
    memoryReactions,
    recentMessages,
    userInput,
    memeMatches,
  );

  return {
    newEmotion,
    triggerDelta,
    memeMatches,
    drawnThreads,
    updatedThreads,
    triggeredAnchors,
    memoryReactions,
    prompt,
  };
}
