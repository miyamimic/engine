// EXPORTS: MockLLM, RealLLM, createLLM, generateMockReply, type ILLM, type LLMConfig
import type { ICharacter, EmotionVector } from '../data/types';
import { runPostprocessor } from './postprocessor';
import {
  matchMemes,
  pickMemeReaction,
  pickMemeEcho,
  type MemeMatch,
} from '../data/memeDict';

/**
 * 统一 LLM 接口 —— Mock 与真实 API 实现同一接口，上层无需感知
 */
export interface ILLM {
  generate(
    character: ICharacter,
    emotion: EmotionVector,
    threads: string[],
    memories: string[],
    userInput: string,
    prompt?: string,
  ): Promise<string>;
}

/**
 * LLM 配置（与 TopBar 中的 LLMConfig 保持一致）
 */
export interface LLMConfig {
  mode: 'mock' | 'api';
  endpoint: string;
  apiKey: string;
  model: string;
}

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
 *
 * 关键：如果用户输入命中网络梗，优先用梗词典里的针对性反应台词，
 * 而不是从通用情绪模板随机抽——这样回复"针对梗"，不是机器板式。
 */
export function generateMockReply(
  character: ICharacter,
  emotion: EmotionVector,
  threads: string[],
  memories: string[],
  userInput: string,
): string {
  // === 网络梗识别（本地） ===
  const memeMatches: MemeMatch[] = matchMemes(userInput);
  const memeReaction = pickMemeReaction(memeMatches, character.core.speech_filter);
  const memeEcho = pickMemeEcho(memeMatches);

  // 生成言语部分：命中梗时用梗反应台词，否则走情绪模板
  let mainSpeech: string;
  let secondSpeech: string | null = null;
  if (memeReaction) {
    mainSpeech = memeReaction;
    // 接梗心理活动作为第二句
    if (memeEcho) {
      secondSpeech = memeEcho;
    }
  } else {
    const speechLines = getSpeechTemplate(character, emotion);
    mainSpeech = speechLines[0] || '……嗯。';
    secondSpeech = speechLines[1] || null;
  }

  // 生成控制动作
  const controlAction = generateControlAction(character, emotion);

  // 生成触碰动作
  const touchAction = generateTouchAction(character, emotion);

  // 生成心理活动（命中梗时给一句"识梗"心理活动，增强梗味）
  let thought: string;
  if (memeMatches.length > 0) {
    const memeThoughts = [
      `（这小家伙……居然还会用"${memeMatches[0].entry.name}"这种梗）`,
      `（"${memeMatches[0].entry.name}"……啧，时代真是变了）`,
      `（识破了。这梗我接得住。）`,
      `（玩梗？行，陪你玩。）`,
    ];
    thought = pickRandom(memeThoughts);
  } else {
    thought = generateThought(character, emotion, threads, memories);
  }

  // 组装回复 - 混合三种格式
  // 结构大致：动作 + 言语 + 心理活动 + 动作 + 言语
  const patterns = [
    // pattern 1: 动作开头，言语中间，心理结尾
    () => `*${controlAction}*\n${mainSpeech}\n${thought}`,
    // pattern 2: 言语开头，动作中间，触碰结尾
    () => `${mainSpeech}\n*${touchAction}*\n${thought}`,
    // pattern 3: 心理开头，两个动作，言语
    () => `${thought}\n*${controlAction}*\n*${touchAction}*\n${secondSpeech || mainSpeech}`,
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

export class MockLLM implements ILLM {
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
    _prompt?: string,
  ): Promise<string> {
    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, this.delayMs + Math.random() * 500));
    return generateMockReply(character, emotion, threads, memories, userInput);
  }
}

/**
 * RealLLM - 调用 OpenAI 兼容的真实 LLM 接口
 * 把预处理管道组装好的结构化提示词发给模型，模型能识别用户输入语义（含网络梗），
 * 而不是从模板随机抽取。失败时抛出错误，由上层决定是否回退 Mock。
 */
export class RealLLM implements ILLM {
  private endpoint: string;
  private apiKey: string;
  private model: string;
  private delayMs: number;

  constructor(config: LLMConfig, delayMs = 300) {
    this.endpoint = config.endpoint.trim();
    this.apiKey = config.apiKey.trim();
    this.model = config.model.trim();
    this.delayMs = delayMs;
  }

  async generate(
    _character: ICharacter,
    _emotion: EmotionVector,
    _threads: string[],
    _memories: string[],
    userInput: string,
    prompt?: string,
  ): Promise<string> {
    if (!this.endpoint || !this.apiKey || !this.model) {
      throw new Error('LLM 配置不完整：请填写 endpoint、apiKey、model');
    }

    // 提示词由预处理管道 buildPrompt 生成，已包含人格/情绪/思绪/记忆/对话历史/用户输入/格式约束
    const finalPrompt = prompt ?? userInput;

    const body = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            '你是一个角色扮演叙事引擎的文本生成模块。严格依据用户给出的结构化提示词生成角色回复，' +
            '只输出角色本人在当前情境下会说的话与动作，不要解释、不要复述提示词、不要扮演用户。' +
            '动作用 *包裹*，心理活动用 (括号) 包裹，其余为言语。第一人称"我"。',
        },
        { role: 'user', content: finalPrompt },
      ],
      temperature: 0.85,
      max_tokens: 400,
      stream: false,
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LLM 接口返回 ${res.status}：${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) {
      throw new Error('LLM 返回内容为空');
    }

    // 给网络一点缓冲感，与打字动画节奏对齐
    await new Promise((r) => setTimeout(r, this.delayMs));
    return content.trim();
  }
}

/**
 * 根据配置创建对应的 LLM 实例
 */
export function createLLM(config: LLMConfig): ILLM {
  if (config.mode === 'api' && config.endpoint && config.apiKey && config.model) {
    return new RealLLM(config);
  }
  return new MockLLM(800);
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
