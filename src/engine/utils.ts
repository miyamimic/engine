import type { CharacterConfig, CharacterRuntime, EmotionVector } from '@/types/character'

// 深拷贝角色配置为运行时状态
export function cloneForRuntime(config: CharacterConfig): CharacterRuntime {
  return JSON.parse(JSON.stringify(config))
}

// 初始化默认空情绪向量
export function emptyEmotion(): EmotionVector {
  return { anger: 0, fear: 0, joy: 0, sadness: 0, desire: 0, warmth: 0 }
}

// 钳制数值到 0~1
export function clamp01(v: number): number {
  if (isNaN(v)) return 0
  return Math.max(0, Math.min(1, v))
}

// 将向量各维度钳制到 0~1
export function clampEmotion(vec: EmotionVector): EmotionVector {
  return {
    anger: clamp01(vec.anger),
    fear: clamp01(vec.fear),
    joy: clamp01(vec.joy),
    sadness: clamp01(vec.sadness),
    desire: clamp01(vec.desire),
    warmth: clamp01(vec.warmth)
  }
}

// 合并两个情绪向量（相加后钳制）
export function mergeEmotion(a: EmotionVector, b: Partial<EmotionVector>, weight = 1): EmotionVector {
  return clampEmotion({
    anger: a.anger + (b.anger ?? 0) * weight,
    fear: a.fear + (b.fear ?? 0) * weight,
    joy: a.joy + (b.joy ?? 0) * weight,
    sadness: a.sadness + (b.sadness ?? 0) * weight,
    desire: a.desire + (b.desire ?? 0) * weight,
    warmth: a.warmth + (b.warmth ?? 0) * weight
  })
}

// 从角色ID/名称生成唯一ID
let _msgSeq = 0
export function genId(prefix = 'id'): string {
  _msgSeq++
  return `${prefix}_${Date.now().toString(36)}_${_msgSeq.toString(36)}`
}
