// EXPORTS: parseSegments, cleanPronouns, cleanAdverbs, validateActions, runPostprocessor
import type { ICharacter, MessageSegment, MessageSegmentType } from '../data/types';

/**
 * 禁止状语列表
 */
export const FORBIDDEN_ADVERBS = [
  '冷静地',
  '温柔地',
  '愤怒地',
  '冷冷地',
  '淡淡地',
  '轻声地',
  '大声地',
  '不悦地',
  '开心地',
  '悲伤地',
  '默默地',
  '缓缓地',
  '慢慢地',
  '快速地',
  '突然地',
  '淡淡地说',
  '冷冷地说',
  '温柔地说',
  '愤怒地说',
  '低声',
  '沉声',
  '冷声',
  '柔声',
];

/**
 * 步骤1：代词清洗
 * 替换指向角色的第三人称代词为第一人称"我"
 */
export function cleanPronouns(text: string): string {
  // 替换第三人称主语（指向角色的）
  let result = text;
  // "他/她/它"在句首或特定语境下替换为"我"
  // 为避免误改，仅替换出现在动作/言语开头的第三人称，以及明显指代角色的
  // 这里采用保守策略：只在动作段和心理活动段内做替换
  // 先处理常见模式
  const patterns = [
    { pattern: /他说/g, replacement: '我说' },
    { pattern: /她说/g, replacement: '我说' },
    { pattern: /他想/g, replacement: '我想' },
    { pattern: /她想/g, replacement: '我想' },
    { pattern: /他的手/g, replacement: '我的手' },
    { pattern: /她的手/g, replacement: '我的手' },
    { pattern: /他的/g, replacement: '我的' },
    { pattern: /她的/g, replacement: '我的' },
    { pattern: /^他/gm, replacement: '我' },
    { pattern: /^她/gm, replacement: '我' },
  ];

  patterns.forEach(({ pattern, replacement }) => {
    result = result.replace(pattern, replacement);
  });

  return result;
}

/**
 * 步骤2：状语清洗
 * 扫描并删除禁止状语，在附近插入随机 touch 动作
 */
export function cleanAdverbs(text: string, touchActions: string[]): string {
  let result = text;

  FORBIDDEN_ADVERBS.forEach((adverb) => {
    if (result.includes(adverb)) {
      // 找到状语位置，替换为空，并在附近插入一个触碰动作
      const randomTouch = touchActions[Math.floor(Math.random() * touchActions.length)];
      // 替换状语 + 后面的"，"或"地"
      const regex = new RegExp(adverb + '[，,]?', 'g');
      result = result.replace(regex, `*${randomTouch}*，`);
    }
  });

  // 清理可能产生的重复标点
  result = result.replace(/，，+/g, '，');
  result = result.replace(/\*，/g, '*，');

  return result;
}

/**
 * 步骤3：格式解析
 * 提取所有 *...* 内容作为动作段
 * 提取所有 (...) 和（...）内容作为心理活动段
 * 其余为言语段
 * 按原文顺序排列
 */
export function parseSegments(rawText: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let text = rawText.trim();
  if (!text) return segments;

  // 使用正则逐段切分
  // 匹配 *动作* 或 (心理活动/（心理活动）
  const regex = /(\*[^*]+\*)|(\([^)]+\))|(（[^）]+）)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // 匹配之前的言语段
    if (match.index > lastIndex) {
      const speech = text.slice(lastIndex, match.index).trim();
      if (speech) {
        segments.push({ type: 'speech', text: speech });
      }
    }

    const matchedText = match[0];
    if (matchedText.startsWith('*')) {
      // 动作段
      const actionText = matchedText.slice(1, -1).trim();
      if (actionText) {
        segments.push({ type: 'action', text: actionText });
      }
    } else {
      // 心理活动段
      const thoughtText = matchedText.slice(1, -1).trim();
      if (thoughtText) {
        segments.push({ type: 'thought', text: thoughtText });
      }
    }

    lastIndex = regex.lastIndex;
  }

  // 最后剩余的言语段
  if (lastIndex < text.length) {
    const speech = text.slice(lastIndex).trim();
    if (speech) {
      segments.push({ type: 'speech', text: speech });
    }
  }

  // 如果没有解析出任何段，把整个文本作为言语段
  if (segments.length === 0) {
    segments.push({ type: 'speech', text });
  }

  return segments;
}

/**
 * 检查文本中是否包含至少一个匹配列表的关键词
 */
export function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

/**
 * 步骤4：动作完整性校验
 * 检查是否至少有一个 control 动作和一个 touch 动作
 * 返回 { hasControl, hasTouch, controlMatched, touchMatched }
 */
export function validateActions(
  segments: MessageSegment[],
  character: ICharacter,
): { hasControl: boolean; hasTouch: boolean; controlMatched: string[]; touchMatched: string[] } {
  const actionTexts = segments.filter((s) => s.type === 'action').map((s) => s.text);
  const fullText = actionTexts.join(' ');

  const controlMatched = character.action_tendency.control_actions.filter((a) =>
    containsAny(fullText, [a]),
  );
  const touchMatched = character.action_tendency.touch_actions.filter((a) =>
    containsAny(fullText, [a]),
  );

  return {
    hasControl: controlMatched.length > 0,
    hasTouch: touchMatched.length > 0,
    controlMatched,
    touchMatched,
  };
}

/**
 * 强制追加缺失的动作
 */
export function appendMissingActions(
  segments: MessageSegment[],
  character: ICharacter,
): MessageSegment[] {
  const result = [...segments];
  const { hasControl, hasTouch } = validateActions(result, character);

  if (!hasControl) {
    const defaultControl = '按住你的肩膀';
    result.push({ type: 'action', text: defaultControl });
  }

  if (!hasTouch) {
    const defaultTouch = '指尖蹭过你的手背';
    result.push({ type: 'action', text: defaultTouch });
  }

  return result;
}

/**
 * 从 segments 重建原始文本
 */
export function segmentsToText(segments: MessageSegment[]): string {
  return segments
    .map((s) => {
      if (s.type === 'action') return `*${s.text}*`;
      if (s.type === 'thought') return `（${s.text}）`;
      return s.text;
    })
    .join('');
}

/**
 * 完整后处理管道
 */
export function runPostprocessor(
  rawText: string,
  character: ICharacter,
): { segments: MessageSegment[]; cleanedText: string; actionValid: boolean } {
  // 步骤1：代词清洗
  let text = cleanPronouns(rawText);

  // 步骤2：状语清洗
  text = cleanAdverbs(text, character.action_tendency.touch_actions);

  // 步骤3：格式解析
  let segments = parseSegments(text);

  // 步骤4：动作完整性校验，不满足则强制追加
  const { hasControl, hasTouch } = validateActions(segments, character);
  if (!hasControl || !hasTouch) {
    segments = appendMissingActions(segments, character);
  }

  const cleanedText = segmentsToText(segments);

  return {
    segments,
    cleanedText,
    actionValid: hasControl && hasTouch,
  };
}
