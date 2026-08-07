// 后端 API 客户端 —— 所有角色引擎逻辑已迁移到 Python 后端
import type {
  EmotionVector,
  BackgroundThread,
  TriggeredAnchor,
  ChatMessage,
  MessageSegment,
} from '../data/types';

const API_BASE = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE) || 'http://localhost:8000';

export interface IntentAnalysis {
  intent: string;
  intentLabel: string;
  emotionDelta: Partial<EmotionVector>;
  entities: string[];
  sentiment: string;
  confidence: number;
  notes: string;
}

export interface CharacterBrief {
  characterId: string;
  name: string;
  instinctBase: string;
  speechFilter: string;
}

export interface ChatResponse {
  sessionId: string;
  characterId: string;
  characterName: string;
  reply: ChatMessage;
  emotion: EmotionVector;
  backgroundThreads: BackgroundThread[];
  triggeredAnchors: TriggeredAnchor[];
  intent: IntentAnalysis;
  fallback: boolean;
}

export interface SessionResponse {
  sessionId: string;
  characterId: string;
  characterName: string;
  emotion: EmotionVector;
  backgroundThreads: BackgroundThread[];
  triggeredAnchors: TriggeredAnchor[];
  messages: ChatMessage[];
}

export interface LLMConfigView {
  mode: 'mock' | 'api';
  endpoint: string;
  apiKey: string; // 脱敏
  model: string;
  hasKey: boolean;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${res.status} ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${res.status} ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => getJson<{ ok: boolean; llm_mode: string }>('/api/health'),
  listCharacters: () => getJson<CharacterBrief[]>('/api/characters'),
  chat: (sessionId: string | null, characterId: string, userInput: string) =>
    postJson<ChatResponse>('/api/chat', { sessionId, characterId, userInput }),
  switchCharacter: (sessionId: string | null, characterId: string) =>
    postJson<SessionResponse>('/api/switch', { sessionId, characterId }),
  resetEmotion: (sessionId: string | null, characterId: string) =>
    postJson<SessionResponse>('/api/reset_emotion', { sessionId, characterId }),
  clearHistory: (sessionId: string | null, characterId: string) =>
    postJson<SessionResponse>('/api/clear_history', { sessionId, characterId }),
  getSession: (sessionId: string) => getJson<SessionResponse>(`/api/session/${sessionId}`),
  getLLMConfig: () => getJson<LLMConfigView>('/api/llm_config'),
  updateLLMConfig: (cfg: Partial<LLMConfigView>) => postJson<{ ok: boolean; llm_mode: string }>('/api/llm_config', cfg),
};

export type { EmotionVector, BackgroundThread, TriggeredAnchor, ChatMessage, MessageSegment };
