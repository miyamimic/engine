import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage, CharacterConfig, EmotionVector } from './types/character'
import { NarrativeSession } from './engine/session'
import { CHARACTER_LIBRARY, kaworuStyle } from './data/characters'

// ========== 背景粒子组件（CSS 动画，不占 CPU） ==========
function ParticleField({ count = 26, layer = 1 }: { count?: number; layer?: 1 | 2 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const left = Math.random() * 100
      const size = 2 + Math.random() * 5
      const dur = 18 + Math.random() * 30
      const delay = -Math.random() * dur
      const op = 0.35 + Math.random() * 0.55
      return { i, left, size, dur, delay, op }
    })
  }, [count])
  return (
    <div className={layer === 1 ? 'particles-layer' : 'particles-layer-2'}>
      {particles.map(p => (
        <div
          key={`${layer}-${p.i}`}
          className="particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            opacity: p.op,
          }}
        />
      ))}
    </div>
  )
}

// ========== 情绪条 ==========
const EMO_ORDER: Array<[keyof EmotionVector, string, string]> = [
  ['anger', '愤怒', 'linear-gradient(90deg,#ff6a6a,#ff3860)'],
  ['fear', '恐惧', 'linear-gradient(90deg,#c9a0ff,#7a4bff)'],
  ['joy', '喜悦', 'linear-gradient(90deg,#ffe08a,#ffb347)'],
  ['sadness', '悲伤', 'linear-gradient(90deg,#7ab8ff,#3d6bff)'],
  ['desire', '欲望', 'linear-gradient(90deg,#ff8bc7,#ff4fa2)'],
  ['warmth', '温情', 'linear-gradient(90deg,#b48bff,#ff8bce)'],
]

function EmotionStrip({ vec }: { vec: EmotionVector }) {
  return (
    <div className="emotion-strip">
      {EMO_ORDER.map(([key, label, bg]) => (
        <div className="emo-cell" key={key}>
          <div className="emo-name">
            <span>{label}</span>
            <span>{(vec[key] * 100).toFixed(0)}</span>
          </div>
          <div className="emo-bar">
            <div className="emo-fill" style={{ width: `${Math.min(100, vec[key] * 100)}%`, background: bg }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ========== 主 App ==========
export default function App() {
  const [session, setSession] = useState<NarrativeSession>(() => new NarrativeSession(kaworuStyle))
  const [currentId, setCurrentId] = useState<string>(kaworuStyle.character_id)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [debugText, setDebugText] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 每次消息变化自动滚到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending])

  // 角色切换
  function onSwitchChar(id: string) {
    const cfg: CharacterConfig | undefined = CHARACTER_LIBRARY[id]
    if (!cfg) return
    const newSession = new NarrativeSession(cfg)
    setSession(newSession)
    setCurrentId(id)
    setMessages([])
    setDebugText(`已切换角色：${cfg.name}（${cfg.character_id}）\n` +
                 `本能基线：${cfg.core.instinct_base}；言语风格：${cfg.core.speech_filter}\n` +
                 `锚点数量：${cfg.memory.anchors.length}；活跃思绪：${cfg.background_threads.active.length} 条`)
  }

  // 自动调节 textarea 高度
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [input])

  // 发送消息
  async function onSend() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')

    try {
      const r = await session.sendUserMessage(text)
      setMessages([...session.history])

      // 调试信息拼接
      const emo = r.preDebug.emotionAfterInertia
      const anchor = r.preDebug.anchorResult
      const thr = r.preDebug.threadsPicked
      const post = r.postDebug
      setDebugText(
        `【预处理】\n` +
        `  Trigger 偏移: ${JSON.stringify(emo.triggerOffsets)}\n` +
        `  命中锚点 ${anchor.hits.length} 个: ${anchor.recallTexts.join(' / ') || '(无)'}\n` +
        `  抽取思绪 ${thr.length} 条: ${thr.join('；') || '(无)'}\n` +
        `  情绪值: ${Object.entries(session.runtime.emotion.current).map(([k,v]) => `${k}=${v.toFixed(2)}`).join('  ')}\n\n` +
        `【后处理】\n` +
        `  重试次数: ${post.retryCount}；强制兜底: ${post.forcedFallback ? '是' : '否'}\n` +
        `  动作数: ${r.characterMessage.actions.length}；心理数: ${r.characterMessage.thoughts.length}\n` +
        `  提取到的控制动作: ${r.characterMessage.actions.filter(a => session.runtime.action_tendency.control_actions.some(k => a.includes(k))).join(' / ') || '(无)'}\n` +
        `  提取到的触碰动作: ${r.characterMessage.actions.filter(a => session.runtime.action_tendency.touch_actions.some(k => a.includes(k))).join(' / ') || '(无)'}\n\n` +
        `【LLM 原始输出】\n${post.finalRaw}\n\n` +
        `【组装给 LLM 的 Prompt 预览】\n${r.preDebug.prompt.systemPersonality}\n\n${r.preDebug.prompt.currentEmotion}\n\n${r.preDebug.prompt.formatConstraints.slice(0, 400)}...`
      )
    } catch (e) {
      console.error(e)
      setDebugText(`发送失败：${String(e)}`)
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  // 当前角色头像字
  const charInitial = session.runtime.name.charAt(0) || '薰'
  // 把 Avatar 组件重新映射
  const renderAvatar = (isUser: boolean) => (
    <div className={`avatar ${isUser ? 'user' : 'char'}`}>
      {isUser ? '你' : charInitial}
    </div>
  )
  // 重新包一层消息显示（改 avatar 字）
  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === 'user'
    return (
      <div className={`msg-row ${isUser ? 'user' : ''}`} key={msg.id}>
        {renderAvatar(isUser)}
        <div className={`bubble ${isUser ? 'user' : 'char'}`}>
          {msg.speech.map((s, i) => <div className="speech" key={`s-${i}`}>{s}</div>)}
          {msg.actions.map((a, i) => (
            <div className="action" key={`a-${i}`}><span>*</span>{a}<span>*</span></div>
          ))}
          {msg.thoughts.map((t, i) => (
            <div className="thought" key={`t-${i}`}>（{t}）</div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="halo" />
      <ParticleField count={26} layer={1} />
      <ParticleField count={18} layer={2} />

      <div className="app-inner">
        <button className="debug-toggle" onClick={() => setShowDebug(s => !s)}>
          {showDebug ? '隐藏调试' : '调试面板'}
        </button>

        {/* 顶部栏 */}
        <div className="topbar">
          <div className="char-name">{session.runtime.name}</div>
          <div className="char-select">
            <label htmlFor="charSel">切换角色</label>
            <select id="charSel" value={currentId} onChange={e => onSwitchChar(e.target.value)}>
              {Object.values(CHARACTER_LIBRARY).map(c => (
                <option key={c.character_id} value={c.character_id}>
                  {c.name}（{c.character_id}）
                </option>
              ))}
            </select>
          </div>
          <EmotionStrip vec={session.runtime.emotion.current} />
        </div>

        {/* 对话窗口 */}
        <div className="chat-scroll" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="msg-row">
              <div className="avatar char">{charInitial}</div>
              <div className="bubble char">
                <div className="thought">今天酒吧里很安静，杯子擦到第三轮了。</div>
                <div className="action"><span>*</span>抬抬下巴示意你坐下<span>*</span></div>
                <div className="speech">……来都来了，说点什么？哪怕是废话也行。</div>
              </div>
            </div>
          )}
          {messages.map(renderMessage)}
          {sending && (
            <div className="msg-row">
              <div className="avatar char">{charInitial}</div>
              <div className="bubble char">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
          {showDebug && debugText && (
            <details className="debug-panel" open>
              <summary>Engine Debug</summary>
              {debugText}
            </details>
          )}
        </div>

        {/* 输入框 */}
        <div className="inputbar">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={"对他说点什么吧……（Enter 发送，Shift+Enter 换行）"}
            rows={1}
          />
          <button onClick={onSend} disabled={sending || !input.trim()}>
            {sending ? '思考中…' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}
