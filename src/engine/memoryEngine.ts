import type {
  CharacterRuntime,
  BackgroundThread,
  MemoryAnchor,
  EmotionVector
} from '@/types/character'
import { genId, mergeEmotion } from './utils'

// ========== 机制二：后台思绪（未完成思绪池） ==========

/**
 * 从 active 列表中随机抽取 1~2 条活跃思绪
 * 并将剩余轮数 -1，移除归零项
 */
export function sampleAndDecayThreads(runtime: CharacterRuntime): string[] {
  const active = runtime.background_threads.active
  if (active.length === 0) return []

  // 抽取 1~2 条
  const shuffled = [...active].sort(() => Math.random() - 0.5)
  const n = Math.min(shuffled.length, Math.random() < 0.5 ? 1 : 2)
  const picked = shuffled.slice(0, n)

  // 衰减 & 清理
  const remaining: BackgroundThread[] = []
  for (const t of active) {
    const newRounds = t.remaining_rounds - 1
    if (newRounds > 0) {
      remaining.push({ ...t, remaining_rounds: newRounds })
    }
  }
  runtime.background_threads.active = remaining

  return picked.map(p => p.content)
}

/**
 * 向思绪池中注入新思绪（简单关键词触发规则）
 */
export function tryInjectNewThreads(runtime: CharacterRuntime, userInput: string, llmReply: string) {
  const combined = (userInput + ' ' + llmReply).toLowerCase()
  const injectIf = (kw: string, content: string, rounds = 2) => {
    if (combined.includes(kw)) {
      runtime.background_threads.active.push({
        id: genId('thr'),
        content,
        remaining_rounds: rounds
      })
    }
  }
  // 示例触发规则（角色无关的通用规则，可根据角色进一步定制）
  injectIf('睡', '昨晚没睡好，头有点昏。', 3)
  injectIf('酒', '酒香让我放松了一些。', 2)
  injectIf('想', '有点想这个人了。', 2)
  injectIf('哭', '他的眼泪让我心头一紧。', 3)
  injectIf('疼', '他的表情让我想起了过去。', 3)
}

// ========== 机制三：记忆锚点 ==========

export interface AnchorHit {
  anchor: MemoryAnchor
  recallText: string
  emotionShift: Partial<EmotionVector>
  weight: number
}

/**
 * 检查当前输入命中哪些锚点
 * 返回命中的锚点列表、记忆唤起文本、情绪叠加向量
 */
export function matchAnchors(
  runtime: CharacterRuntime,
  userInput: string
): { hits: AnchorHit[]; recallTexts: string[]; totalShift: Partial<EmotionVector> } {
  const hits: AnchorHit[] = []
  const lower = userInput.toLowerCase()

  for (const a of runtime.memory.anchors) {
    if (lower.includes(a.trigger.toLowerCase())) {
      hits.push({
        anchor: a,
        recallText: `刚才的话让你想起之前用户说“${a.trigger}”时，${a.reaction}。`,
        emotionShift: a.emotion_shift,
        weight: a.weight
      })
    }
  }

  const recallTexts = hits.map(h => h.recallText)
  let totalShift: Partial<EmotionVector> = {}
  for (const h of hits) {
    const dims: (keyof EmotionVector)[] = ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth']
    for (const dim of dims) {
      const v = h.emotionShift[dim]
      if (typeof v === 'number') {
        totalShift[dim] = (totalShift[dim] ?? 0) + v * h.weight
      }
    }
  }

  return { hits, recallTexts, totalShift }
}

/**
 * 将锚点命中的情绪偏移叠加到当前情绪（钳制到 0~1）
 * 步骤：先完成惯性更新 emotion.current，再叠加此偏移
 */
export function applyAnchorEmotionShift(
  runtime: CharacterRuntime,
  totalShift: Partial<EmotionVector>
): EmotionVector {
  const after = mergeEmotion(runtime.emotion.current, totalShift, 1)
  runtime.emotion.current = after
  return after
}
