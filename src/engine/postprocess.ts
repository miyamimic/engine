import type { CharacterRuntime, ChatMessage } from '@/types/character'
import { genId } from './utils'

// ========== 文档C：后处理管道（LLM 返回后） ==========

// 禁止情绪状语列表（中英文常见）
const FORBIDDEN_ADVERBS = [
  '冷静地', '冷冷地', '温柔地', '轻轻地', '淡淡地', '平静地', '愤怒地', '生气地',
  '开心地', '高兴地', '悲伤地', '难过地', '紧张地', '不安地', '凶狠地', '残暴地',
  '深情地', '宠溺地', '漠然地', '不耐烦地', '厌恶地', '惊讶地', '震惊地',
  'calmly', 'coldly', 'gently', 'softly', 'lightly', 'angrily', 'sadly', 'happily',
  'tenderly', 'quietly', 'silently', 'violently', 'cruelly', 'lovingly'
]

/**
 * 步骤1：代词清洗
 * 把指代角色的第三人称（他/她/它）保守替换成第一人称"我"或删除
 * 策略：只做稳妥的整句开头/标点后紧接的第三人称替换，避免误伤指代用户的"他"
 */
export function cleansePronouns(raw: string): string {
  let result = raw
  // 段首/行首的"他/她"
  result = result.replace(/(^|\n|\r\n|\r)他/g, '$1我')
  result = result.replace(/(^|\n|\r\n|\r)她/g, '$1我')
  // 中文标点或空格后的"他/她"
  result = result.replace(/([，。！？；：、,.!?;:\s])他/g, '$1我')
  result = result.replace(/([，。！？；：、,.!?;:\s])她/g, '$1我')
  // 保守清理 "他(无后续停顿)" 的残留（仅当周围符号环境强烈暗示）
  result = result.replace(/他自己/g, '我自己')
  result = result.replace(/她自己/g, '我自己')
  return result
}

/**
 * 步骤2：状语清洗
 * 扫描禁止状语列表，删除匹配项，并在该位置后插入一个从 touch_actions 随机抽取的动作短语
 * 为了不破坏通顺，插入为 "*动作*" 形式的片段（调用方后会再解析）
 */
export function cleanseAdverbs(raw: string, runtime: CharacterRuntime): {
  cleaned: string
  insertedActions: string[]
} {
  const touches = runtime.action_tendency.touch_actions
  const inserted: string[] = []
  let out = raw
  // 按长度从长到短排序，避免先匹配了短的子串
  const sorted = [...FORBIDDEN_ADVERBS].sort((a, b) => b.length - a.length)
  for (const adv of sorted) {
    const re = new RegExp(adv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    out = out.replace(re, () => {
      const act = touches[Math.floor(Math.random() * touches.length)] ?? '指尖轻轻滑过'
      inserted.push(act)
      // 在状语位置插入一个动作标记，保证语义不空洞
      return `*${act}*`
    })
  }
  return { cleaned: out, insertedActions: inserted }
}

/**
 * 步骤3：格式解析
 * 提取 *...* 作为动作列表, (...) 作为心理活动列表, 其余（去掉空片段）作为言语
 */
export interface ParsedOutput {
  speech: string[]   // 对话/言语
  actions: string[]  // 动作/行为
  thoughts: string[] // 心理活动
}

export function parseFormats(text: string): ParsedOutput {
  const result: ParsedOutput = { speech: [], actions: [], thoughts: [] }
  // 临时替换保护已有段
  let remaining = text
  // 先匹配最外层的心理活动 (...)
  const thoughtRegex = /\(([^()]*)\)/g
  let m: RegExpExecArray | null
  const thoughtRanges: Array<[number, number, string]> = []
  while ((m = thoughtRegex.exec(remaining)) !== null) {
    thoughtRanges.push([m.index, m.index + m[0].length, m[1].trim()])
  }
  // 匹配动作 *...*（不在括号内的）
  const actionRegex = /\*([^*\n]+)\*/g
  const actionRanges: Array<[number, number, string]> = []
  while ((m = actionRegex.exec(remaining)) !== null) {
    // 跳过被括号完全包裹的
    const inThought = thoughtRanges.some(([ts, te]) => ts <= m!.index && m!.index + m![0].length <= te)
    if (!inThought) actionRanges.push([m.index, m.index + m[0].length, m[1].trim()])
  }
  // 合并所有非言语区间
  const allRanges = [...thoughtRanges.map(r => ({ ...r, type: 't' as const })), ...actionRanges.map(r => ({ ...r, type: 'a' as const }))]
  allRanges.sort((a, b) => a[0] - b[0])

  let cursor = 0
  for (const r of allRanges) {
    // cursor 到 r[0] 之间是言语
    const speechSeg = remaining.slice(cursor, r[0]).trim()
    if (speechSeg) {
      // 用常见标点把言语拆成句子
      result.speech.push(...speechSeg.split(/(?<=[。！？!?\.])/).map(s => s.trim()).filter(Boolean))
    }
    if (r.type === 't') result.thoughts.push(r[2])
    else result.actions.push(r[2])
    cursor = r[1]
  }
  // 尾部言语
  const tail = remaining.slice(cursor).trim()
  if (tail) {
    result.speech.push(...tail.split(/(?<=[。！？!?\.])/).map(s => s.trim()).filter(Boolean))
  }
  return result
}

/**
 * 步骤4：完整性校验
 * 检查动作中是否同时包含 control_actions 和 touch_actions 关键词
 * 返回缺失情况；如需修正由上层调用定向修正接口
 */
export function checkActionCompleteness(
  actions: string[],
  runtime: CharacterRuntime
): { hasControl: boolean; hasTouch: boolean; missing: Array<'control' | 'touch'> } {
  const lower = actions.join(' ').toLowerCase()
  const hasControl = runtime.action_tendency.control_actions.some(kw => lower.includes(kw.toLowerCase()))
  const hasTouch = runtime.action_tendency.touch_actions.some(kw => lower.includes(kw.toLowerCase()))
  const missing: Array<'control' | 'touch'> = []
  if (!hasControl) missing.push('control')
  if (!hasTouch) missing.push('touch')
  return { hasControl, hasTouch, missing }
}

/**
 * 强制补写默认动作（最终兜底）
 */
export function appendFallbackActions(
  parsed: ParsedOutput,
  runtime: CharacterRuntime,
  missing: Array<'control' | 'touch'>
): ParsedOutput {
  const clone = { speech: [...parsed.speech], actions: [...parsed.actions], thoughts: [...parsed.thoughts] }
  if (missing.includes('control')) {
    const pool = runtime.action_tendency.control_actions
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? '抬头，眼神示意他过来'
    clone.actions.push(pick)
  }
  if (missing.includes('touch')) {
    const pool = runtime.action_tendency.touch_actions
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? '指尖蹭过他的手背'
    clone.actions.push(pick)
  }
  return clone
}

// ========== 对外：完整后处理流水线 ==========

// LLM 适配层：允许用户注入真实调用（默认是 mock）
export type LLMCall = (fullPrompt: string, extraHint?: string) => Promise<string>

export interface PostprocessOptions {
  llmCall: LLMCall
  maxRetries?: number // 默认 2
  assemblyPrompt: string // 预处理的完整 prompt，用于重试时喂给 LLM
  runtime: CharacterRuntime
}

export async function postprocess(
  llmRaw: string,
  opts: PostprocessOptions
): Promise<{
  message: ChatMessage
  retryCount: number
  finalRaw: string
  forcedFallback: boolean
}> {
  const maxRetries = opts.maxRetries ?? 2
  const { runtime } = opts

  let currentRaw = llmRaw
  let forcedFallback = false
  let retryCount = 0
  let parsed: ParsedOutput

  // 主流程：清洗 → 解析 → 校验 → (缺失则重试) → 兜底
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 清洗
    const step1 = cleansePronouns(currentRaw)
    const { cleaned: step2 } = cleanseAdverbs(step1, runtime)
    parsed = parseFormats(step2)
    const { missing } = checkActionCompleteness(parsed.actions, runtime)
    if (missing.length === 0) {
      currentRaw = step2
      break
    }
    if (attempt === maxRetries) {
      // 最后一次仍缺失：强制追加兜底动作
      parsed = appendFallbackActions(parsed, runtime, missing)
      forcedFallback = true
      currentRaw = step2
      break
    }
    // 重试：调用 LLM 仅补充缺失动作
    retryCount++
    const hint =
      `[定向修正提示]\n` +
      `你上一轮回复的动作中缺少：${missing.map(m => m === 'control' ? '控制类动作' : '触碰类温情动作').join('、')}。\n` +
      `请在不破坏原有情绪和场景的前提下，补写缺失的动作，仍然遵循：第一人称、禁止状语、*动作* (心理) 言语三格式。`
    currentRaw = await opts.llmCall(opts.assemblyPrompt, hint)
  }

  const message: ChatMessage = {
    id: genId('msg'),
    role: 'character',
    timestamp: Date.now(),
    speech: parsed!.speech,
    actions: parsed!.actions,
    thoughts: parsed!.thoughts,
    rawText: currentRaw
  }
  return { message, retryCount, finalRaw: currentRaw, forcedFallback }
}
