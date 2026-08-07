import type { CharacterConfig, CharacterRuntime, ChatMessage } from '@/types/character'
import { cloneForRuntime, genId } from './utils'
import { preprocess, promptToString } from './preprocess'
import { postprocess, type LLMCall } from './postprocess'
import { tryInjectNewThreads } from './memoryEngine'

// ========== 会话主控：把预处理 + LLM + 后处理串起来 ==========

/**
 * 简易 mock LLM（无真实 API 时的占位，同时让项目可跑起来做 demo）
 * 它会基于预处理 prompt 中的几个片段拼接一个合理的演示输出，
 * 但格式会故意留下几个"坏点"，用来测试后处理的清洗/校验/补全功能。
 */
export const mockLLM: LLMCall = async (fullPrompt: string, extraHint?: string) => {
  // 简单从 prompt 中抽几个片段
  const nameMatch = fullPrompt.match(/你的名字是"([^"]+)"/)
  const name = nameMatch?.[1] ?? '他'
  const userMatch = fullPrompt.match(/\[用户输入\]\n([\s\S]*?)(?:\n\n\[|$)/)
  const userText = (userMatch?.[1] ?? '...').trim().replace(/\n/g, ' ')

  // 构造一个"有点问题"的回复来测试后处理
  // 故意包含：第三人称"他"、情绪状语"冷冷地"、缺少控制或触碰动作（随机）
  const rand = Math.random()
  const missingControl = rand < 0.33
  const missingTouch = rand > 0.66

  const parts: string[] = []
  // 故意用第三人称开个头 + 情绪状语
  parts.push(`他冷冷地抬起头，看向面前的人。`)
  parts.push(`（又在闹了，真是麻烦。但没由来的心软了一下。）`)
  if (!missingControl) {
    parts.push(`*伸手捏住他的下巴，迫使他抬头看我*`)
  }
  parts.push(`"${name}"。重复一次你刚才说的话。'${userText.slice(0, 20)}' 是你该讲的语气吗？`)
  if (!missingTouch) {
    parts.push(`*拇指蹭过他下唇，动作带着刻意的轻柔*`)
  }
  parts.push(`（...为什么看到他眼睛发红，我心里会揪一下。）`)
  parts.push(`别哭。再哭我就不帮你了。`)

  let out = parts.join(' ')
  if (extraHint) {
    // 如果有修正提示，就相应地补一下
    if (extraHint.includes('控制类动作')) {
      out += ' *手指勾起他的裤腰，把他往这边一带*'
    }
    if (extraHint.includes('触碰类')) {
      out += ' *额头抵着他的额头，呼吸落在他脸上*'
    }
  }
  // 模拟网络延迟
  await new Promise(r => setTimeout(r, 300 + Math.random() * 500))
  return out
}

export interface SessionOptions {
  llm?: LLMCall
}

/**
 * 会话：把一个角色的 runtime + 历史消息 + 一次 round-trip 封装起来
 */
export class NarrativeSession {
  runtime: CharacterRuntime
  history: ChatMessage[] = []
  llm: LLMCall

  constructor(config: CharacterConfig, opts: SessionOptions = {}) {
    this.runtime = cloneForRuntime(config)
    this.llm = opts.llm ?? mockLLM
  }

  /** 切换角色（保留会话类，换 runtime） */
  swapCharacter(config: CharacterConfig) {
    this.runtime = cloneForRuntime(config)
  }

  /** 用户发送消息，返回角色回复消息 */
  async sendUserMessage(userText: string): Promise<{
    userMessage: ChatMessage
    characterMessage: ChatMessage
    preDebug: ReturnType<typeof preprocess>
    postDebug: Awaited<ReturnType<typeof postprocess>>
  }> {
    // 1. 构造用户消息对象
    const userMessage: ChatMessage = {
      id: genId('msg'),
      role: 'user',
      timestamp: Date.now(),
      speech: [userText],
      actions: [],
      thoughts: []
    }

    // 2. 预处理
    const preDebug = preprocess(this.runtime, userText, this.history)
    const promptStr = promptToString(preDebug.prompt)

    // 3. 调 LLM
    const llmRaw = await this.llm(promptStr)

    // 4. 后处理
    const postDebug = await postprocess(llmRaw, {
      llmCall: this.llm,
      assemblyPrompt: promptStr,
      runtime: this.runtime,
      maxRetries: 2
    })

    // 5. 注入新思绪（基于本轮用户输入 + 角色回复文本）
    const replyRaw = postDebug.finalRaw
    tryInjectNewThreads(this.runtime, userText, replyRaw)

    // 6. 入历史
    this.history.push(userMessage)
    this.history.push(postDebug.message)

    return {
      userMessage,
      characterMessage: postDebug.message,
      preDebug,
      postDebug
    }
  }
}
