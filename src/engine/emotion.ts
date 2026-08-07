// EXPORTS: clampEmotion, addEmotion, scaleEmotion, lerpEmotion, updateEmotionWithInertia, describeEmotion, INSTINCT_DESCRIPTIONS, SPEECH_FILTER_DESCRIPTIONS
import type { EmotionVector } from '../data/types';

export const INSTINCT_DESCRIPTIONS: Record<string, string> = {
  attack: '面对压力时你的本能是主动出击，除非你主动选择压制',
  avoid: '面对压力时你的本能是回避和逃离，除非你主动选择面对',
  freeze: '面对压力时你的本能是僵住和沉默，除非你主动选择反应',
  fawn: '面对压力时你的本能是讨好和迎合，除非你主动选择坚持',
  observe: '面对压力时你的本能是先观察再行动，除非你主动选择介入',
};

export const SPEECH_FILTER_DESCRIPTIONS: Record<string, string> = {
  rough: '说话粗糙、直接，不喜欢绕弯子，偶尔带脏字',
  gentle: '说话温柔、低沉，语速慢，喜欢用柔和的词',
  formal: '说话正式、克制，用词讲究，不带多余情绪',
  casual: '说话慵懒、随意，常用单字和短句，带点漫不经心',
};

const EMOTION_NAMES: Record<keyof EmotionVector, string> = {
  anger: '愤怒',
  fear: '恐惧',
  joy: '喜悦',
  sadness: '悲伤',
  desire: '欲望',
  warmth: '温情',
};

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function clampEmotion(vec: Partial<EmotionVector>): Partial<EmotionVector> {
  const result: Partial<EmotionVector> = {};
  (Object.keys(vec) as (keyof EmotionVector)[]).forEach((key) => {
    const v = vec[key];
    if (v !== undefined) {
      result[key] = clamp(v);
    }
  });
  return result;
}

export function addEmotion(
  base: EmotionVector,
  delta: Partial<EmotionVector>,
): EmotionVector {
  const result: EmotionVector = { ...base };
  (Object.keys(delta) as (keyof EmotionVector)[]).forEach((key) => {
    const d = delta[key];
    if (d !== undefined) {
      result[key] = clamp(result[key] + d);
    }
  });
  return result;
}

export function scaleEmotion(
  delta: Partial<EmotionVector>,
  scale: number,
): Partial<EmotionVector> {
  const result: Partial<EmotionVector> = {};
  (Object.keys(delta) as (keyof EmotionVector)[]).forEach((key) => {
    const v = delta[key];
    if (v !== undefined) {
      result[key] = v * scale;
    }
  });
  return result;
}

export function lerpEmotion(
  from: EmotionVector,
  to: EmotionVector,
  t: number,
): EmotionVector {
  const result: EmotionVector = { ...from };
  (Object.keys(result) as (keyof EmotionVector)[]).forEach((key) => {
    result[key] = clamp(from[key] + (to[key] - from[key]) * t);
  });
  return result;
}

/**
 * 六维情绪惯性更新（核心公式）
 * newValue = oldValue * inertia + target * (1 - inertia)
 * 每个维度使用独立的 inertia 系数
 * target = baseline + triggerDelta
 */
export function updateEmotionWithInertia(
  current: EmotionVector,
  baseline: EmotionVector,
  inertia: EmotionVector,
  triggerDelta: Partial<EmotionVector>,
): EmotionVector {
  const result: EmotionVector = { ...current };
  (Object.keys(result) as (keyof EmotionVector)[]).forEach((key) => {
    const delta = triggerDelta[key] ?? 0;
    const target = clamp(baseline[key] + delta);
    result[key] = clamp(current[key] * inertia[key] + target * (1 - inertia[key]));
  });
  return result;
}

/**
 * 根据当前情绪值生成自然语言描述
 */
export function describeEmotion(emotion: EmotionVector): string {
  const parts: string[] = [];
  const dominant = getDominantEmotions(emotion, 2);

  dominant.forEach(({ key, value }) => {
    const name = EMOTION_NAMES[key];
    let level = '';
    if (value >= 0.8) level = '非常强烈的';
    else if (value >= 0.6) level = '明显的';
    else if (value >= 0.4) level = '一些';
    else level = '淡淡的';
    parts.push(`${level}${name}`);
  });

  if (parts.length === 0) return '你现在心情很平静，几乎没有明显的情绪波动。';
  if (parts.length === 1) return `你现在感受到${parts[0]}。`;

  // 特殊组合描述
  if (emotion.desire > 0.5 && emotion.warmth > 0.5) {
    return '你现在心里又暖又痒，欲望和温情交织在一起，有点说不清的感觉。';
  }
  if (emotion.anger > 0.5 && emotion.desire > 0.5) {
    return '你现在有点烦躁，但欲望也在升腾，两种情绪搅在一起让你更想做点什么。';
  }
  if (emotion.joy > 0.5 && emotion.warmth > 0.5) {
    return '你现在心里软乎乎的，带着笑意，整个人都放松下来了。';
  }

  return `你现在主要感受到${parts.join('和')}。`;
}

function getDominantEmotions(
  emotion: EmotionVector,
  count: number,
): { key: keyof EmotionVector; value: number }[] {
  return (Object.keys(emotion) as (keyof EmotionVector)[])
    .map((key) => ({ key, value: emotion[key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .filter((e) => e.value > 0.2);
}
