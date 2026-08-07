"""数据模型（pydantic）—— 与前端对齐。

所有模型继承 CamelModel：Python 字段用 snake_case，序列化输出 camelCase，
前端直接消费无需转换。
"""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


EmotionKey = Literal["anger", "fear", "joy", "sadness", "desire", "warmth"]


class EmotionVector(CamelModel):
    anger: float = 0.0
    fear: float = 0.0
    joy: float = 0.0
    sadness: float = 0.0
    desire: float = 0.0
    warmth: float = 0.0


class EmotionTrigger(CamelModel):
    keywords: list[str] = Field(default_factory=list)
    delta: dict[str, float] = Field(default_factory=dict)


class BackgroundThread(CamelModel):
    content: str
    remaining_turns: int


class MemoryAnchor(CamelModel):
    trigger: str
    emotion_shift: dict[str, float] = Field(default_factory=dict)
    reaction: str
    weight: float = 1.0


class TriggeredAnchor(CamelModel):
    anchor: MemoryAnchor
    triggered_at: int  # ms timestamp


class ActionTendency(CamelModel):
    control_actions: list[str] = Field(default_factory=list)
    touch_actions: list[str] = Field(default_factory=list)
    forbidden_actions: list[str] = Field(default_factory=list)
    control_affinity: float = 0.5
    touch_affinity: float = 0.5


class SpeechStyle(CamelModel):
    catchphrases: list[str] = Field(default_factory=list)
    forbidden_phrases: list[str] = Field(default_factory=list)


class CharacterCore(CamelModel):
    values: list[str] = Field(default_factory=list)
    instinct_base: Literal["attack", "avoid", "freeze", "fawn", "observe"] = "observe"
    speech_filter: Literal["rough", "gentle", "formal", "casual"] = "casual"


class Character(CamelModel):
    character_id: str
    name: str
    core: CharacterCore
    emotion: dict[str, object]  # current/baseline/inertia/triggers
    background_threads: dict[str, list[BackgroundThread]]
    memory: dict[str, list[MemoryAnchor]]
    action_tendency: ActionTendency
    speech: SpeechStyle


# ---- 消息 ----

SegmentType = Literal["speech", "action", "thought"]


class MessageSegment(CamelModel):
    type: SegmentType
    text: str


class ChatMessage(CamelModel):
    id: str
    role: Literal["user", "character"]
    content: str
    segments: list[MessageSegment] = Field(default_factory=list)
    timestamp: int
    character_id: Optional[str] = None


# ---- NLP 意图分析结果 ----

class IntentAnalysis(CamelModel):
    """NLP 理解层输出：意图 + 六维情绪增量 + 命中实体 + 情感倾向。"""
    intent: str = ""
    intent_label: str = ""
    emotion_delta: dict[str, float] = Field(default_factory=dict)
    entities: list[str] = Field(default_factory=list)
    sentiment: str = "neutral"
    confidence: float = 0.0
    notes: str = ""


# ---- API 请求/响应 ----

class ChatRequest(CamelModel):
    session_id: Optional[str] = None
    character_id: Optional[str] = None
    user_input: str


class ChatResponse(CamelModel):
    session_id: str
    character_id: str
    character_name: str
    reply: ChatMessage
    emotion: EmotionVector
    background_threads: list[BackgroundThread]
    triggered_anchors: list[TriggeredAnchor]
    intent: IntentAnalysis
    fallback: bool = False


class SwitchRequest(CamelModel):
    session_id: Optional[str] = None
    character_id: str


class SessionResponse(CamelModel):
    session_id: str
    character_id: str
    character_name: str
    emotion: EmotionVector
    background_threads: list[BackgroundThread]
    triggered_anchors: list[TriggeredAnchor]
    messages: list[ChatMessage]


class CharacterBrief(CamelModel):
    character_id: str
    name: str
    instinct_base: str
    speech_filter: str
