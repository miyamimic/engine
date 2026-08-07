// 六维情绪向量：愤怒、恐惧、喜悦、悲伤、欲望、温情
export type EmotionDimension = 'anger' | 'fear' | 'joy' | 'sadness' | 'desire' | 'warmth'

export interface EmotionVector {
  anger: number    // 愤怒 0.0~1.0
  fear: number     // 恐惧 0.0~1.0
  joy: number      // 喜悦 0.0~1.0
  sadness: number  // 悲伤 0.0~1.0
  desire: number   // 欲望 0.0~1.0
  warmth: number   // 温情 0.0~1.0
}

// 本能基线枚举
export type InstinctBase = 'attack' | 'avoid' | 'freeze' | 'appease' | 'observe'

// 言语过滤枚举
export type SpeechFilter = 'raw' | 'refined' | 'poetic' | 'coarse'

// 角色核心设定
export interface CharacterCore {
  values: string[]           // 核心价值观
  instinct_base: InstinctBase // 本能基线
  speech_filter: SpeechFilter // 言语过滤方式
}

// 情绪触发偏移量
export interface EmotionTrigger {
  keywords: string[]         // 触发关键词
  offset: Partial<EmotionVector> // 触发时的偏移量
}

// 情绪配置
export interface EmotionConfig {
  current: EmotionVector     // 当前情绪值（运行时）
  baseline: EmotionVector    // 基线情绪值
  inertia: EmotionVector     // 各维度独立惯性系数 0~1
  triggers: EmotionTrigger[] // 关键词触发偏移
}

// 后台思绪条目
export interface BackgroundThread {
  id: string
  content: string            // 思绪内容
  remaining_rounds: number   // 剩余影响轮数
}

// 后台思绪池
export interface BackgroundThreads {
  active: BackgroundThread[]
}

// 记忆锚点
export interface MemoryAnchor {
  id: string
  trigger: string            // 触发词（支持简单匹配）
  emotion_shift: Partial<EmotionVector> // 情绪波动
  reaction: string           // 历史反应描述
  weight: number             // 权重系数 0~1
}

// 记忆配置
export interface MemoryConfig {
  anchors: MemoryAnchor[]
}

// 动作倾向
export interface ActionTendency {
  control_actions: string[]  // 控制类动作关键词库
  touch_actions: string[]    // 触碰类温情动作关键词库
  forbidden_actions: string[] // 禁止动作
  control_affinity: number   // 控制倾向 0~1
  touch_affinity: number     // 触碰倾向 0~1
}

// 言语风格
export interface SpeechStyle {
  catchphrases: string[]     // 口头禅
  forbidden_phrases: string[] // 禁语
}

// 完整角色配置 Schema
export interface CharacterConfig {
  character_id: string
  name: string
  core: CharacterCore
  emotion: EmotionConfig
  background_threads: BackgroundThreads
  memory: MemoryConfig
  action_tendency: ActionTendency
  speech: SpeechStyle
}

// 运行时角色状态（深拷贝自 config，避免修改原配置）
export type CharacterRuntime = CharacterConfig

// 对话消息
export interface ChatMessage {
  id: string
  role: 'user' | 'character'
  timestamp: number
  // 已解析的三种格式内容
  speech: string[]    // 对话/言语
  actions: string[]   // 动作/行为
  thoughts: string[]  // 心理活动
  rawText?: string    // LLM 原始输出（调试用）
}

// 预处理后的组装提示词结构
export interface PromptAssembly {
  systemPersonality: string
  currentEmotion: string
  memoryRecall: string
  dialogHistory: string
  userInput: string
  formatConstraints: string
}
