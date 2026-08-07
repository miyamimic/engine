// EXPORTS: MockLLM, generateMockReply
import type { ICharacter, EmotionVector } from '../data/types';
import { runPostprocessor } from './postprocessor';

/**
 * MockLLM - 基于规则和模板的模拟 LLM，用于演示
 * 根据情绪状态、思绪、记忆生成合理的角色扮演回复
 */

interface MockContext {
  emotion: EmotionVector;
  threads: string[];
  memories: string[];
  userInput: string;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * 根据情绪强度选择语气模板
 */
function getSpeechTemplate(
  character: ICharacter,
  emotion: EmotionVector,
): string[] {
  const { speech, core } = character;

  // 基于主导情绪选择不同的开场白
  const templates: string[] = [];

  // 愤怒高
  if (emotion.anger > 0.5) {
    if (core.speech_filter === 'rough') {
      templates.push('啧，你他妈再说一遍？');
      templates.push('行啊你，胆子不小。');
      templates.push('你是不是找事？');
    } else {
      templates.push('……你再说一次。');
      templates.push('嗯？你确定？');
      templates.push('啧，别挑战我的耐心。');
    }
  }

  // 温情高
  if (emotion.warmth > 0.5) {
    if (core.speech_filter === 'gentle') {
      templates.push('傻孩子，过来。');
      templates.push('乖，让我抱抱。');
    } else {
      templates.push('……过来。');
      templates.push('乖，别闹。');
      templates.push('行了，在这待着。');
    }
  }

  // 欲望高
  if (emotion.desire > 0.5) {
    templates.push('你知道你在说什么吗？');
    templates.push('你最好想清楚。');
    templates.push('……别后悔。');
  }

  // 喜悦高
  if (emotion.joy > 0.5) {
    templates.push('哼，算你有点良心。');
    templates.push('哦？这还差不多。');
    templates.push('行，听你的。');
  }

  // 恐惧或悲伤高
  if (emotion.fear > 0.4 || emotion.sadness > 0.4) {
    templates.push('……别说了。');
    templates.push('闭嘴。');
  }

  // 如果没有特别的，加一句口头禅
  if (templates.length === 0) {
    templates.push(pickRandom(speech.catchphrases));
    templates.push('……怎么了？');
    templates.push('嗯？');
  }

  return pickRandomN(templates, 2);
}

/**
 * 生成控制类动作描述
 */
function generateControlAction(character: ICharacter, emotion: EmotionVector): string {
  const { control_actions } = character.action_tendency;
  const base = pickRandom(control_actions);

  // 根据情绪加一点变化
  if (emotion.anger > 0.6) {
    return `${base}，力道有点重`;
  }
  if (emotion.desire > 0.6) {
    return `${base}，指尖微微用力`;
  }
  if (emotion.warmth > 0.5) {
    return `${base}，动作却放轻了`;
  }
  return base;
}

/**
 * 生成触碰类动作描述
 */
function generateTouchAction(character: ICharacter, emotion: EmotionVector): string {
  const { touch_actions } = character.action_tendency;
  const base = pickRandom(touch_actions);

  if (emotion.warmth > 0.6) {
    return `${base}，动作很轻`;
  }
  if (emotion.desire > 0.5) {
    return `${base}，带着一点试探`;
  }
  if (emotion.joy > 0.5) {
    return `${base}，带着点笑意`;
  }
  return base;
}

/**
 * 生成心理活动描述
 */
function generateThought(
  character: ICharacter,
  emotion: EmotionVector,
  threads: string[],
  memories: string[],
): string {
  const thoughts: string[] = [];

  // 从思绪中选
  if (threads.length > 0 && Math.random() > 0.4) {
    const t = pickRandom(threads);
    thoughts.push(`（${t}……）`);
  }

  // 基于情绪
  if (emotion.anger > 0.5 && emotion.desire > 0.5) {
    thoughts.push('（气归气，但居然更想要了……）');
  }
  if (emotion.warmth > 0.6) {
    thoughts.push('（……居然有点舍不得放开）');
  }
  if (emotion.desire > 0.6) {
    thoughts.push('（不行，得忍一忍……但真的很想）');
  }
  if (emotion.joy > 0.5 && emotion.warmth > 0.4) {
    thoughts.push('（……嘴角要压不住了）');
  }
  if (emotion.sadness > 0.4) {
    thoughts.push('（别想了，想也没用）');
  }

  if (thoughts.length === 0) {
    thoughts.push('（沉默了一会儿）');
  }

  return pickRandom(thoughts);
}

/**
 * MockLLM 核心生成函数
 */
export function generateMockReply(
  character: ICharacter,
  emotion: EmotionVector,
  threads: string[],
  memories: string[],
  userInput: string,
): string {
  const context: MockContext = { emotion, threads, memories, userInput };

  // 生成言语部分
  const speechLines = getSpeechTemplate(character, emotion);
  const mainSpeech = speechLines[0] || '……嗯。';

  // 生成控制动作
  const controlAction = generateControlAction(character, emotion);

  // 生成触碰动作
  const touchAction = generateTouchAction(character, emotion);

  // 生成心理活动
  const thought = generateThought(character, emotion, threads, memories);

  // 组装回复 - 混合三种格式
  // 结构大致：动作 + 言语 + 心理活动 + 动作 + 言语
  const patterns = [
    // pattern 1: 动作开头，言语中间，心理结尾
    () => `*${controlAction}*\n${mainSpeech}\n${thought}`,
    // pattern 2: 言语开头，动作中间，触碰结尾
    () => `${mainSpeech}\n*${touchAction}*\n${thought}`,
    // pattern 3: 心理开头，两个动作，言语
    () => `${thought}\n*${controlAction}*\n*${touchAction}*\n${speechLines[1] || mainSpeech}`,
    // pattern 4: 动作+触碰一起，言语，心理
    () => `*${controlAction}*\n*${touchAction}*\n${mainSpeech}\n${thought}`,
    // pattern 5: 短回复
    () => `*${controlAction}*\n${mainSpeech} *${touchAction}*`,
  ];

  const pattern = pickRandom(patterns);
  let reply = pattern();

  // 确保不包含禁止词汇
  character.speech.forbidden_phrases.forEach((phrase) => {
    if (reply.includes(phrase)) {
      reply = reply.replace(phrase, pickRandom(character.speech.catchphrases));
    }
  });

  return reply;
}

export class MockLLM {
  private delayMs: number;

  constructor(delayMs = 800) {
    this.delayMs = delayMs;
  }

  async generate(
    character: ICharacter,
    emotion: EmotionVector,
    threads: string[],
    memories: string[],
    userInput: string,
  ): Promise<string> {
    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, this.delayMs + Math.random() * 500));
    return generateMockReply(character, emotion, threads, memories, userInput);
  }
}

// 同时提供后处理包装
export async function generateAndPostprocess(
  character: ICharacter,
  emotion: EmotionVector,
  threads: string[],
  memories: string[],
  userInput: string,
): Promise<{ raw: string; segments: ReturnType<typeof runPostprocessor>['segments'] }> {
  const llm = new MockLLM();
  const raw = await llm.generate(character, emotion, threads, memories, userInput);
  const { segments } = runPostprocessor(raw, character);
  return { raw, segments };
}
