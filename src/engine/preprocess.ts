import type { CharacterRuntime, ChatMessage, PromptAssembly } from '@/types/character'
import { stepEmotion, emotionToDescription } from './emotionEngine'
import {
  sampleAndDecayThreads,
  matchAnchors,
  applyAnchorEmotionShift
} from './memoryEngine'

// ========== 文档B：预处理管道（调用LLM前） ==========

export interface PreprocessResult {
  // 提示词分段组装
  prompt: PromptAssembly
  // 原始情绪（debug/UI 显示）
  emotionAfterInertia: ReturnType<typeof stepEmotion>
  anchorResult: ReturnType<typeof matchAnchors>
  threadsPicked: string[]
}

// 本能基线到自然语言映射
const INSTINCT_MAP: Record<string, string> = {
  attack: '攻击',
  avoid: '回避',
  freeze: '冻结',
  appease: '讨好',
  observe: '观察'
}

const SPEECH_FILTER_MAP: Record<string, string> = {
  raw: '直白，不加修饰',
  refined: '克制、文雅',
  poetic: '略带诗意和隐喻',
  coarse: '粗犷，带粗口'
}

/**
 * 最近3轮对话摘要
 */
function summarizeHistory(messages: ChatMessage[]): string {
  const recent = messages.slice(-6) // 取最近的 6 条（用户+角色最多各 3 条）
  const lines: string[] = []
  for (const m of recent) {
    if (m.role === 'user') {
      const content = [...m.speech, ...m.actions.map(a => `*${a}*`), ...m.thoughts.map(t => `(${t})`)].join(' ')
      lines.push(`用户：${content}`)
    } else {
      const content = [...m.speech, ...m.actions.map(a => `*${a}*`), ...m.thoughts.map(t => `(${t})`)].join(' ')
      lines.push(`你：${content}`)
    }
  }
  if (lines.length === 0) return '（对话刚刚开始，没有历史记录）'
  return lines.join('\n')
}

/**
 * 完整预处理管道：执行文档B的全部5+1步骤
 */
export function preprocess(
  runtime: CharacterRuntime,
  userInputRaw: string,
  history: ChatMessage[]
): PreprocessResult {
  const userInput = userInputRaw.trim()

  // 步骤1：解析用户输入，匹配 triggers（在 stepEmotion 内完成）
  // 步骤2：对六维情绪分别应用惯性公式
  const emotionStep = stepEmotion(runtime, userInput)

  // 步骤3：从 background_threads 中随机抽取 1~2 条，衰减并移除归零
  const threadsPicked = sampleAndDecayThreads(runtime)

  // 步骤4：检查 anchors，命中则叠加情绪偏移 + 记入唤起文本
  const anchorResult = matchAnchors(runtime, userInput)
  applyAnchorEmotionShift(runtime, anchorResult.totalShift)

  // 步骤5：组装多段式提示词（严格分段）
  // --- [系统人格] ---
  const valuesStr = runtime.core.values.join('；')
  const instinctZH = INSTINCT_MAP[runtime.core.instinct_base] ?? runtime.core.instinct_base
  const filterZH = SPEECH_FILTER_MAP[runtime.core.speech_filter] ?? runtime.core.speech_filter
  const systemPersonality =
    `[系统人格]\n` +
    `你的名字是"${runtime.name}"。\n` +
    `核心价值观：${valuesStr}。\n` +
    `面对压力你的本能是${instinctZH}，除非你主动选择压制。\n` +
    `言语风格：${filterZH}。` +
    (runtime.speech.catchphrases.length
      ? `\n口头禅/惯用尾韵：${runtime.speech.catchphrases.join('、')}。`
      : '') +
    (runtime.speech.forbidden_phrases.length
      ? `\n绝对不能说的话：${runtime.speech.forbidden_phrases.join('、')}。`
      : '')

  // --- [当前情绪状态] ---
  const cur = runtime.emotion.current
  const numStr =
    `愤怒${cur.anger.toFixed(2)}，恐惧${cur.fear.toFixed(2)}，喜悦${cur.joy.toFixed(2)}，` +
    `悲伤${cur.sadness.toFixed(2)}，欲望${cur.desire.toFixed(2)}，温情${cur.warmth.toFixed(2)}。`
  const desc = emotionToDescription(cur)
  const threadsStr = threadsPicked.length ? `\n此刻你后台的思绪：${threadsPicked.join('；')}。` : ''
  const currentEmotion =
    `[当前情绪状态]\n` +
    `六维数值：${numStr}\n${desc}${threadsStr}`

  // --- [记忆唤起] ---
  const recallLines = anchorResult.recallTexts.length
    ? anchorResult.recallTexts.join('\n')
    : '（没有被唤起的特殊记忆）'
  const memoryRecall = `[记忆唤起]\n${recallLines}`

  // --- [对话历史] ---
  const dialogHistory = `[对话历史]\n${summarizeHistory(history)}`

  // --- [用户输入] ---
  const userInputSection = `[用户输入]\n${userInput || '（空）'}`

  // --- [硬性输出格式约束] ---
  const formatConstraints =
    `[硬性输出格式约束]\n` +
    `1) 必须用第一人称"我"叙述，绝不允许出现"他"、"她"、"它"等第三人称指代你自己。\n` +
    `2) 禁止使用情绪状语（如"冷静地"、"温柔地"、"愤怒地"）；如果想要表达情绪，用具体动作来体现。\n` +
    `3) 输出必须包含三部分，且使用以下精确标记：\n` +
    `   - 对话/言语：不加任何标记，直接写（例：操，别哭。）\n` +
    `   - 动作/行为：用一对 "*" 包裹（例：*把烟掐灭，转过身*）\n` +
    `   - 心理活动：用一对 "(" 和 ")" 包裹（例：（心里骂了一句，但手还是伸过去了））\n` +
    `4) 内容必须同时满足：\n` +
    `   - 至少一个控制类动作（命令、指定姿势、要求暴露等，从你的动作库中抽取合适的表达）\n` +
    `   - 至少一个触碰类温情动作（亲吻特定部位、抚摸、额头相抵等，从你的动作库中抽取合适的表达）\n` +
    `   二者缺一不可。缺少任何一方都算不合格输出。\n` +
    `5) 你的回应是针对用户的"本真存在"而不是表演配合；承认对方的情绪，承接它，再选择你的反应。\n` +
    `6) 禁止回避身体接触。`

  return {
    prompt: {
      systemPersonality,
      currentEmotion,
      memoryRecall,
      dialogHistory,
      userInput: userInputSection,
      formatConstraints
    },
    emotionAfterInertia: emotionStep,
    anchorResult,
    threadsPicked
  }
}

/**
 * 方便调用：把分段 prompt 拼成最终字符串发给 LLM
 */
export function promptToString(assembly: PromptAssembly): string {
  return [
    assembly.systemPersonality,
    assembly.currentEmotion,
    assembly.memoryRecall,
    assembly.dialogHistory,
    assembly.userInput,
    assembly.formatConstraints
  ].join('\n\n')
}
