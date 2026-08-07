// EXPORTS: CharacterEngine
import type {
  ICharacter,
  ChatMessage,
  EmotionVector,
  BackgroundThread,
  MemoryAnchor,
  TriggeredAnchor,
  MessageSegment,
} from '../data/types';
import { runPreprocessor } from './preprocessor';
import { runPostprocessor } from './postprocessor';
import { MockLLM, generateMockReply } from './mockLLM';
import { getCharacterById, MOCK_CHARACTERS } from '../data/characters';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';

const HISTORY_KEY = 'rp_engine_chat_history';

interface EngineState {
  currentCharacter: ICharacter;
  emotion: EmotionVector;
  backgroundThreads: BackgroundThread[];
  triggeredAnchors: TriggeredAnchor[];
  messages: ChatMessage[];
}

export class CharacterEngine {
  private state: EngineState;
  private llm: MockLLM;
  private listeners: Set<() => void> = new Set();

  constructor(initialCharacterId: string = 'char_001') {
    const char = getCharacterById(initialCharacterId) ?? MOCK_CHARACTERS[0];
    this.state = {
      currentCharacter: this.cloneCharacter(char),
      emotion: { ...char.emotion.current },
      backgroundThreads: char.background_threads.active.map((t) => ({ ...t })),
      triggeredAnchors: [],
      messages: this.loadHistory(),
    };
    this.llm = new MockLLM(800);
  }

  private cloneCharacter(char: ICharacter): ICharacter {
    return JSON.parse(JSON.stringify(char));
  }

  private loadHistory(): ChatMessage[] {
    try {
      const raw = scopedStorage.getItem(HISTORY_KEY);
      if (raw) {
        return JSON.parse(raw) as ChatMessage[];
      }
    } catch {
      // ignore
    }
    return [];
  }

  private saveHistory(): void {
    try {
      scopedStorage.setItem(HISTORY_KEY, JSON.stringify(this.state.messages));
    } catch {
      // ignore
    }
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---- 状态获取 ----

  getCharacter(): ICharacter {
    return this.state.currentCharacter;
  }

  getEmotion(): EmotionVector {
    return { ...this.state.emotion };
  }

  getBackgroundThreads(): BackgroundThread[] {
    return this.state.backgroundThreads.map((t) => ({ ...t }));
  }

  getTriggeredAnchors(): TriggeredAnchor[] {
    return [...this.state.triggeredAnchors];
  }

  getMessages(): ChatMessage[] {
    return [...this.state.messages];
  }

  getAvailableCharacters(): ICharacter[] {
    return MOCK_CHARACTERS;
  }

  // ---- 角色切换 ----

  switchCharacter(characterId: string): boolean {
    const char = getCharacterById(characterId);
    if (!char) return false;

    const freshChar = this.cloneCharacter(char);
    this.state.currentCharacter = freshChar;
    this.state.emotion = { ...char.emotion.baseline };
    this.state.backgroundThreads = char.background_threads.active.map((t) => ({ ...t }));
    this.state.triggeredAnchors = [];
    // 保留对话历史（不重置 messages）

    // 添加系统提示消息
    this.state.messages.push({
      id: `sys-${Date.now()}`,
      role: 'character',
      content: `（已切换到角色：${char.name}）`,
      segments: [{ type: 'thought', text: `已切换到角色：${char.name}` }],
      timestamp: Date.now(),
      characterId: char.character_id,
    });

    this.saveHistory();
    this.notify();
    return true;
  }

  // ---- 发送消息（完整管道） ----

  async sendMessage(userInput: string): Promise<void> {
    const trimmed = userInput.trim();
    if (!trimmed) return;

    const char = this.state.currentCharacter;

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      segments: [{ type: 'speech', text: trimmed }],
      timestamp: Date.now(),
    };
    this.state.messages.push(userMsg);
    this.saveHistory();
    this.notify();

    // 预处理管道
    const preResult = runPreprocessor(trimmed, char, this.state.messages.slice(0, -1));

    // 更新状态
    this.state.emotion = preResult.newEmotion;
    this.state.backgroundThreads = preResult.updatedThreads;

    // 记录触发的锚点
    preResult.triggeredAnchors.forEach((anchor) => {
      this.state.triggeredAnchors.push({
        anchor,
        triggeredAt: Date.now(),
      });
    });

    // 更新角色 current emotion（供下一轮使用）
    this.state.currentCharacter.emotion.current = { ...preResult.newEmotion };
    this.state.currentCharacter.background_threads.active = [...preResult.updatedThreads];

    this.notify();

    // LLM 生成
    const rawReply = await this.llm.generate(
      char,
      preResult.newEmotion,
      preResult.drawnThreads.map((t) => t.content),
      preResult.memoryReactions,
      trimmed,
    );

    // 后处理管道
    const { segments, cleanedText } = runPostprocessor(rawReply, char);

    // 添加角色消息
    const charMsg: ChatMessage = {
      id: `char-${Date.now()}`,
      role: 'character',
      content: cleanedText,
      segments,
      timestamp: Date.now(),
      characterId: char.character_id,
    };
    this.state.messages.push(charMsg);
    this.saveHistory();
    this.notify();
  }

  // ---- 重置 ----

  resetEmotion(): void {
    const char = this.state.currentCharacter;
    this.state.emotion = { ...char.emotion.baseline };
    this.state.currentCharacter.emotion.current = { ...char.emotion.baseline };
    this.notify();
  }

  clearHistory(): void {
    this.state.messages = [];
    this.saveHistory();
    this.notify();
  }
}
