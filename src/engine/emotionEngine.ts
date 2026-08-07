import type { EmotionVector, EmotionTrigger, CharacterRuntime } from '@/types/character'
import { clampEmotion, emptyEmotion, mergeEmotion } from './utils'

// ========== 机制一：六维情绪状态与情绪惯性 ==========

/**
 * 对单个维度应用惯性公式：
 * New = Old * Inertia + Target * (1 - Inertia)
 * Target = Baseline + TriggerDelta
 * 每个维度独立计算
 */
export function applyEmotionInertia(
  oldVec: EmotionVector,
  baseline: EmotionVector,
  inertia: EmotionVector,
  triggerDelta: Partial<EmotionVector> = {}
): EmotionVector {
  const result: EmotionVector = emptyEmotion()
  const dims: (keyof EmotionVector)[] = ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth']

  for (const dim of dims) {
    const oldVal = oldVec[dim]
    const base = baseline[dim]
    const iner = inertia[dim]
    const delta = triggerDelta[dim] ?? 0
    const target = base + delta
    result[dim] = oldVal * iner + target * (1 - iner)
  }

  return clampEmotion(result)
}

/**
 * 从用户输入匹配所有 triggers，累加偏移量
 */
export function computeTriggerOffsets(
  triggers: EmotionTrigger[],
  userInput: string
): Partial<EmotionVector> {
  const total: Partial<EmotionVector> = {}
  const lower = userInput.toLowerCase()

  for (const t of triggers) {
    let hit = false
    for (const kw of t.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        hit = true
        break
      }
    }
    if (!hit) continue

    const dims: (keyof EmotionVector)[] = ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth']
    for (const dim of dims) {
      const v = t.offset[dim]
      if (typeof v === 'number') {
        total[dim] = (total[dim] ?? 0) + v
      }
    }
  }
  return total
}

/**
 * 情绪向量 → 自然语言描述
 */
export function emotionToDescription(vec: EmotionVector): string {
  const parts: string[] = []
  if (vec.anger >= 0.4) parts.push(`愤怒在积累(${vec.anger.toFixed(2)})`)
  else if (vec.anger >= 0.2) parts.push(`有点烦躁(${vec.anger.toFixed(2)})`)

  if (vec.fear >= 0.4) parts.push(`感到不安(${vec.fear.toFixed(2)})`)
  else if (vec.fear >= 0.2) parts.push(`有一丝紧张(${vec.fear.toFixed(2)})`)

  if (vec.joy >= 0.4) parts.push(`真心愉悦(${vec.joy.toFixed(2)})`)
  else if (vec.joy >= 0.2) parts.push(`心情不错(${vec.joy.toFixed(2)})`)

  if (vec.sadness >= 0.4) parts.push(`被悲伤笼罩(${vec.sadness.toFixed(2)})`)
  else if (vec.sadness >= 0.2) parts.push(`有点难过(${vec.sadness.toFixed(2)})`)

  if (vec.desire >= 0.4) parts.push(`欲望在升腾(${vec.desire.toFixed(2)})`)
  else if (vec.desire >= 0.2) parts.push(`有些悸动(${vec.desire.toFixed(2)})`)

  if (vec.warmth >= 0.4) parts.push(`满是温情(${vec.warmth.toFixed(2)})`)
  else if (vec.warmth >= 0.2) parts.push(`有些心软(${vec.warmth.toFixed(2)})`)

  if (parts.length === 0) return '你内心平静，情绪没有太大波动。'
  return '你现在的状态：' + parts.join('，') + '。'
}

/**
 * 在角色运行时上执行完整情绪更新步骤
 * 步骤：计算 trigger 偏移 → 应用惯性公式 → 更新 runtime.emotion.current
 */
export function stepEmotion(runtime: CharacterRuntime, userInput: string): {
  newEmotion: EmotionVector
  triggerOffsets: Partial<EmotionVector>
} {
  const offsets = computeTriggerOffsets(runtime.emotion.triggers, userInput)
  const newEmotion = applyEmotionInertia(
    runtime.emotion.current,
    runtime.emotion.baseline,
    runtime.emotion.inertia,
    offsets
  )
  runtime.emotion.current = newEmotion
  return { newEmotion, triggerOffsets: offsets }
}

// 便于外部访问的类型辅助
export { mergeEmotion }
