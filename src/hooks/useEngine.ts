import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  ICharacter,
  EmotionVector,
  BackgroundThread,
  TriggeredAnchor,
  ChatMessage,
} from '../data/types';
import { MOCK_CHARACTERS, getCharacterById } from '../data/characters';
import { api, type IntentAnalysis } from '../lib/api';

const SESSION_KEY = '__rp_engine_session_id';

function loadSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function saveSessionId(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/**
 * useEngine —— 前端控制器，调用 Python 后端 API。
 * 六维情绪/思绪/记忆锚点/NLP 意图层/LLM 生成全部在后端，
 * 前端只负责 UI 状态管理。保留与旧本地引擎同名的方法， minimize 调用方改动。
 */
export function useEngine() {
  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  const stateRef = useRef({
    sessionId: loadSessionId(),
    characterId: MOCK_CHARACTERS[0].character_id,
    characterName: MOCK_CHARACTERS[0].name,
    emotion: { ...MOCK_CHARACTERS[0].emotion.baseline } as EmotionVector,
    previousEmotion: null as EmotionVector | null,
    emotionConfirmed: true,
    backgroundThreads: [] as BackgroundThread[],
    triggeredAnchors: [] as TriggeredAnchor[],
    messages: [] as ChatMessage[],
    lastIntent: null as IntentAnalysis | null,
    lastFallback: false,
    ready: false,
  });

  // 初始化：恢复会话或创建新会话
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sid = stateRef.current.sessionId;
        if (sid) {
          const sess = await api.getSession(sid);
          if (!mounted) return;
          const s = stateRef.current;
          s.sessionId = sess.sessionId;
          s.characterId = sess.characterId;
          s.characterName = sess.characterName;
          s.emotion = sess.emotion;
          s.backgroundThreads = sess.backgroundThreads;
          s.triggeredAnchors = sess.triggeredAnchors;
          s.messages = sess.messages;
          s.ready = true;
          rerender();
          return;
        }
        // 无会话：用首个角色，初始化情绪为基线
        const s = stateRef.current;
        s.emotion = { ...MOCK_CHARACTERS[0].emotion.baseline };
        s.backgroundThreads = MOCK_CHARACTERS[0].background_threads.active.map((t) => ({ ...t }));
        s.ready = true;
        rerender();
      } catch {
        // 会话恢复失败：本地兜底初始化
        const s = stateRef.current;
        s.sessionId = null;
        s.emotion = { ...MOCK_CHARACTERS[0].emotion.baseline };
        s.backgroundThreads = MOCK_CHARACTERS[0].background_threads.active.map((t) => ({ ...t }));
        s.ready = true;
        rerender();
      }
    })();
    return () => {
      mounted = false;
    };
  }, [rerender]);

  // ---- 异步操作 ----

  const sendMessage = useCallback(async (userInput: string) => {
    const s = stateRef.current;
    // 保存旧情绪（用于对比），标记为未确认
    s.previousEmotion = { ...s.emotion };
    s.emotionConfirmed = false;
    rerender();

    // 乐观插入用户消息
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
      segments: [{ type: 'speech', text: userInput }],
      timestamp: Date.now(),
    };
    s.messages = [...s.messages, userMsg];
    rerender();

    const res = await api.chat(s.sessionId, s.characterId, userInput);
    s.sessionId = res.sessionId;
    saveSessionId(res.sessionId);
    s.characterId = res.characterId;
    s.characterName = res.characterName;
    s.emotion = res.emotion;
    s.backgroundThreads = res.backgroundThreads;
    s.triggeredAnchors = res.triggeredAnchors;
    s.messages = [...s.messages, res.reply];
    s.lastIntent = res.intent;
    s.lastFallback = res.fallback;
    // 情绪已更新但未确认，等用户点确认
    rerender();
  }, [rerender]);

  const switchCharacter = useCallback(async (characterId: string) => {
    const s = stateRef.current;
    const res = await api.switchCharacter(s.sessionId, characterId);
    s.sessionId = res.sessionId;
    saveSessionId(res.sessionId);
    s.characterId = res.characterId;
    s.characterName = res.characterName;
    s.emotion = res.emotion;
    s.previousEmotion = null;
    s.emotionConfirmed = true;
    s.backgroundThreads = res.backgroundThreads;
    s.triggeredAnchors = res.triggeredAnchors;
    s.messages = res.messages;
    s.lastIntent = null;
    rerender();
  }, [rerender]);

  const clearHistory = useCallback(async () => {
    const s = stateRef.current;
    const res = await api.clearHistory(s.sessionId, s.characterId);
    s.sessionId = res.sessionId;
    saveSessionId(res.sessionId);
    s.messages = res.messages;
    s.triggeredAnchors = res.triggeredAnchors;
    s.previousEmotion = null;
    s.emotionConfirmed = true;
    rerender();
  }, [rerender]);

  const resetEmotion = useCallback(async () => {
    const s = stateRef.current;
    const res = await api.resetEmotion(s.sessionId, s.characterId);
    s.sessionId = res.sessionId;
    saveSessionId(res.sessionId);
    s.emotion = res.emotion;
    s.previousEmotion = null;
    s.emotionConfirmed = true;
    rerender();
  }, [rerender]);

  const confirmEmotion = useCallback(() => {
    const s = stateRef.current;
    s.emotionConfirmed = true;
    rerender();
  }, [rerender]);

  // ---- 兼容旧接口的 getter ----

  const controller = {
    ready: stateRef.current.ready,
    getCharacter: (): ICharacter => getCharacterById(stateRef.current.characterId) ?? MOCK_CHARACTERS[0],
    getEmotion: (): EmotionVector => ({ ...stateRef.current.emotion }),
    getPreviousEmotion: (): EmotionVector | null =>
      stateRef.current.previousEmotion ? { ...stateRef.current.previousEmotion } : null,
    getEmotionConfirmed: (): boolean => stateRef.current.emotionConfirmed,
    getBackgroundThreads: (): BackgroundThread[] => stateRef.current.backgroundThreads.map((t) => ({ ...t })),
    getTriggeredAnchors: (): TriggeredAnchor[] => [...stateRef.current.triggeredAnchors],
    getMessages: (): ChatMessage[] => [...stateRef.current.messages],
    getAvailableCharacters: (): ICharacter[] => MOCK_CHARACTERS,
    getLastIntent: (): IntentAnalysis | null => stateRef.current.lastIntent,
    getLastFallback: (): boolean => stateRef.current.lastFallback,
    sendMessage,
    switchCharacter,
    clearHistory,
    resetEmotion,
    confirmEmotion,
  };

  return controller;
}

export type EngineController = ReturnType<typeof useEngine>;
