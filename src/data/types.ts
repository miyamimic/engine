// EXPORTS: EmotionVector, EmotionTrigger, BackgroundThread, MemoryAnchor, ActionTendency, SpeechStyle, CharacterCore, ICharacter, ChatMessage, MessageSegment, TriggeredAnchor

export interface EmotionVector {
  anger: number;
  fear: number;
  joy: number;
  sadness: number;
  desire: number;
  warmth: number;
}

export interface EmotionTrigger {
  keywords: string[];
  delta: Partial<EmotionVector>;
}

export interface BackgroundThread {
  content: string;
  remainingTurns: number;
}

export interface MemoryAnchor {
  trigger: string;
  emotion_shift: Partial<EmotionVector>;
  reaction: string;
  weight: number;
}

export interface TriggeredAnchor {
  anchor: MemoryAnchor;
  triggeredAt: number;
}

export interface ActionTendency {
  control_actions: string[];
  touch_actions: string[];
  forbidden_actions: string[];
  control_affinity: number;
  touch_affinity: number;
}

export interface SpeechStyle {
  catchphrases: string[];
  forbidden_phrases: string[];
}

export interface CharacterCore {
  values: string[];
  instinct_base: 'attack' | 'avoid' | 'freeze' | 'fawn' | 'observe';
  speech_filter: 'rough' | 'gentle' | 'formal' | 'casual';
}

export interface ICharacter {
  character_id: string;
  name: string;
  core: CharacterCore;
  emotion: {
    current: EmotionVector;
    baseline: EmotionVector;
    inertia: EmotionVector;
    triggers: EmotionTrigger[];
  };
  background_threads: {
    active: BackgroundThread[];
  };
  memory: {
    anchors: MemoryAnchor[];
  };
  action_tendency: ActionTendency;
  speech: SpeechStyle;
}

export type MessageSegmentType = 'speech' | 'action' | 'thought';

export interface MessageSegment {
  type: MessageSegmentType;
  text: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'character';
  content: string;
  segments: MessageSegment[];
  timestamp: number;
  characterId?: string;
}
