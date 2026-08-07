"""编排层 / 角色内核——会话状态 + 预处理 + NLP + 情绪更新 + 思绪 + 记忆 + LLM 生成 + 后处理。

每个 session 独立持有：当前角色、情绪向量、后台思绪、已触发锚点、对话历史。
"""
from __future__ import annotations

import logging
import random
import time
import uuid
from typing import Optional

from .characters import get_character_or_default, MOCK_CHARACTERS
from .emotion import (
    EMOTION_KEYS,
    add_emotion,
    describe_emotion,
    dict_to_emotion,
    emotion_to_dict,
    scale_emotion,
    update_emotion_with_inertia,
    INSTINCT_DESCRIPTIONS,
    SPEECH_FILTER_DESCRIPTIONS,
)
from .llm import LLMCaller, make_llm_caller
from .models import (
    BackgroundThread,
    Character,
    ChatMessage,
    EmotionVector,
    IntentAnalysis,
    MemoryAnchor,
    TriggeredAnchor,
)
from .nlp import analyze as nlp_analyze
from .postprocess import run_postprocessor

logger = logging.getLogger("rp.engine")


class Session:
    """单个会话的完整状态。"""

    def __init__(self, character: Character, llm_caller: LLMCaller, llm_mode: str):
        self.session_id = f"sess-{uuid.uuid4().hex[:12]}"
        self.character: Character = character
        self.llm_caller: LLMCaller = llm_caller
        self.llm_mode: str = llm_mode

        self.emotion: EmotionVector = dict_to_emotion(character.emotion["baseline"])  # type: ignore[arg-type]
        self.background_threads: list[BackgroundThread] = [
            t.model_copy(deep=True) for t in character.background_threads["active"]
        ]
        self.triggered_anchors: list[TriggeredAnchor] = []
        self.messages: list[ChatMessage] = []

    # ---- 工具 ----
    def _now_ms(self) -> int:
        return int(time.time() * 1000)

    def _emotion_field(self, name: str) -> dict[str, float]:
        return character_emotion_field(self.character, name)

    def switch_character(self, character: Character) -> None:
        self.character = character
        self.emotion = dict_to_emotion(character.emotion["baseline"])  # type: ignore[arg-type]
        self.background_threads = [t.model_copy(deep=True) for t in character.background_threads["active"]]
        self.triggered_anchors = []
        # 保留对话历史（不重置 messages）
        self.messages.append(ChatMessage(
            id=f"sys-{self._now_ms()}",
            role="character",
            content=f"（已切换到角色：{character.name}）",
            segments=[],
            timestamp=self._now_ms(),
            character_id=character.character_id,
        ))

    def reset_emotion(self) -> None:
        self.emotion = dict_to_emotion(self.character.emotion["baseline"])  # type: ignore[arg-type]

    def clear_history(self) -> None:
        self.messages = []
        self.triggered_anchors = []

    # ---- 后台思绪处理 ----
    def _process_threads(self) -> tuple[list[BackgroundThread], list[BackgroundThread]]:
        if not self.background_threads:
            return [], list(self.background_threads)
        draw_count = min(len(self.background_threads), random.randint(1, 2))
        pool = self.background_threads[:]
        random.shuffle(pool)
        drawn = pool[:draw_count]
        drawn_set = {t.content for t in drawn}
        updated = []
        for t in self.background_threads:
            if t.content in drawn_set:
                nt = t.model_copy(deep=True)
                nt.remaining_turns -= 1
                if nt.remaining_turns > 0:
                    updated.append(nt)
            else:
                updated.append(t.model_copy(deep=True))
        self.background_threads = updated
        return drawn, updated

    # ---- 记忆锚点检查 ----
    def _check_memory_anchors(self, user_input: str, intent: IntentAnalysis) -> tuple[list[MemoryAnchor], dict[str, float], list[str]]:
        hit: list[MemoryAnchor] = []
        delta: dict[str, float] = {}
        reactions: list[str] = []
        anchors: list[MemoryAnchor] = self.character.memory["anchors"]
        for anchor in anchors:
            # 命中条件：用户输入包含 trigger，或 NLP 识别到的实体/意图与之相关
            triggered = anchor.trigger in user_input
            if not triggered and intent.intent in ("affection", "confess") and "想你" in anchor.trigger:
                triggered = "想你" in user_input or "affection" == intent.intent and any("想" in e for e in intent.entities)
            if not triggered and intent.intent == "refuse" and "不行" in anchor.trigger:
                triggered = intent.intent == "refuse"
            if triggered:
                hit.append(anchor)
                reactions.append(anchor.reaction)
                scaled = scale_emotion(anchor.emotion_shift, anchor.weight)
                for k, v in scaled.items():
                    delta[k] = round(delta.get(k, 0.0) + v, 4)
                self.triggered_anchors.append(TriggeredAnchor(
                    anchor=anchor, triggered_at=self._now_ms()
                ))
        return hit, delta, reactions

    # ---- 预处理：组装提示词 ----
    def _build_prompt(
        self,
        emotion: EmotionVector,
        drawn_threads: list[BackgroundThread],
        memory_reactions: list[str],
        recent_messages: list[ChatMessage],
        user_input: str,
        intent: IntentAnalysis,
    ) -> str:
        char = self.character
        core = char.core
        at = char.action_tendency
        lines: list[str] = []

        lines.append("[系统人格]")
        lines.append(f"名字：{char.name}")
        lines.append(f"核心价值观：{'、'.join(core.values)}")
        lines.append(f"本能基线：{INSTINCT_DESCRIPTIONS[core.instinct_base]}")
        lines.append(f"表达风格：{SPEECH_FILTER_DESCRIPTIONS[core.speech_filter]}")
        lines.append("")

        lines.append("[当前情绪状态]")
        lines.append("，".join(f"{EMOTION_KEYS_MAP[k]}：{getattr(emotion, k):.2f}" for k in EMOTION_KEYS))
        lines.append(describe_emotion(emotion))
        lines.append("")

        lines.append("[NLP 意图分析]")
        lines.append(f"意图：{intent.intent_label}（{intent.intent}）；情感：{intent.sentiment}；实体：{', '.join(intent.entities) or '无'}")
        lines.append(f"备注：{intent.notes}")
        lines.append("")

        lines.append("[后台思绪]")
        if drawn_threads:
            for t in drawn_threads:
                lines.append(f"- {t.content}")
        else:
            lines.append("- （没有特别的思绪）")
        lines.append("")

        lines.append("[记忆唤起]")
        if memory_reactions:
            for r in memory_reactions:
                lines.append(r)
        else:
            lines.append("（没有特别的记忆被唤起）")
        lines.append("")

        lines.append("[对话历史]")
        if recent_messages:
            for m in recent_messages:
                speaker = "用户" if m.role == "user" else char.name
                lines.append(f"{speaker}：{m.content}")
        else:
            lines.append("（这是第一次对话）")
        lines.append("")

        lines.append("[用户输入]")
        lines.append(user_input)
        lines.append("")

        lines.append("[硬性输出格式约束]")
        lines.append('1. 必须使用第一人称"我"，禁止第三人称')
        lines.append('2. 禁止使用情绪状语（如"冷静地"、"温柔地"、"愤怒地"）')
        lines.append("3. 动作用*包裹，心理活动用()包裹，其余为言语")
        lines.append("4. 回复中必须同时包含至少一个控制类动作和至少一个触碰类温情动作")
        lines.append(f"5. 控制类动作参考：{'、'.join(at.control_actions[:5])}")
        lines.append(f"6. 触碰类动作参考：{'、'.join(at.touch_actions[:5])}")
        lines.append("7. 回复不要太长，3-5句话以内，符合口语习惯")
        lines.append("8. 回应要贴合用户输入的真实意图与情绪，可自然接住网络梗/玩梗，但保持角色人设不崩")

        return "\n".join(lines)

    # ---- 主流程：发送消息 ----
    async def send(self, user_input: str) -> tuple[ChatMessage, IntentAnalysis, bool]:
        trimmed = user_input.strip()
        if not trimmed:
            raise ValueError("输入为空")

        # 1. 用户消息入列
        user_msg = ChatMessage(
            id=f"user-{self._now_ms()}",
            role="user",
            content=trimmed,
            segments=[],
            timestamp=self._now_ms(),
        )
        self.messages.append(user_msg)

        # 2. NLP 理解层：意图 + 情绪增量（泛化，不死板）
        intent = await nlp_analyze(trimmed, self.llm_caller)
        trigger_delta = dict(intent.emotion_delta)

        # 3. 六维情绪惯性更新
        baseline = dict_to_emotion(self._emotion_field("baseline"))
        inertia = dict_to_emotion(self._emotion_field("inertia"))
        new_emotion = update_emotion_with_inertia(self.emotion, baseline, inertia, trigger_delta)

        # 4. 后台思绪处理
        drawn_threads, _ = self._process_threads()

        # 5. 记忆锚点检查（叠加情绪偏移）
        _, memory_delta, memory_reactions = self._check_memory_anchors(trimmed, intent)
        if memory_delta:
            new_emotion = add_emotion(new_emotion, memory_delta)

        self.emotion = new_emotion
        recent = self.messages[:-1][-6:]

        # 6. 组装提示词
        prompt = self._build_prompt(new_emotion, drawn_threads, memory_reactions, recent, trimmed, intent)

        # 7. LLM 生成（带重试 + Mock 兜底）
        raw_reply, fallback = await self._generate_with_fallback(prompt)

        # 8. 后处理
        post = run_postprocessor(raw_reply, self.character)

        char_msg = ChatMessage(
            id=f"char-{self._now_ms()}",
            role="character",
            content=post["cleaned_text"],
            segments=post["segments"],
            timestamp=self._now_ms(),
            character_id=self.character.character_id,
        )
        self.messages.append(char_msg)
        return char_msg, intent, fallback

    async def _generate_with_fallback(self, prompt: str) -> tuple[str, bool]:
        system = (
            "你是一个角色扮演叙事引擎的文本生成模块。严格依据用户给出的结构化提示词生成角色回复，"
            "只输出角色本人在当前情境下会说的话与动作，不要解释、不要复述提示词、不要扮演用户。"
            '动作用 *包裹*，心理活动用 (括号) 包裹，其余为言语。第一人称"我"。'
        )
        try:
            reply = await self.llm_caller(system, prompt, 0.85)
            return reply, False
        except Exception as e:  # noqa: BLE001
            logger.warning("LLM 生成失败，回退 Mock：%s", e)
            # Mock 兜底：本地生成，保证对话不中断
            from .llm import MockLLM
            mock = MockLLM()
            reply = await mock.chat(system, prompt, 0.85)
            return reply, True


EMOTION_KEYS_MAP = {
    "anger": "愤怒", "fear": "恐惧", "joy": "喜悦",
    "sadness": "悲伤", "desire": "欲望", "warmth": "温情",
}


def character_emotion_field(character: Character, name: str) -> dict[str, float]:
    """从角色 emotion 字典里取 current/baseline/inertia，返回纯 dict。"""
    field = character.emotion.get(name)
    if not isinstance(field, dict):
        return {k: 0.0 for k in EMOTION_KEYS}
    return {k: float(field.get(k, 0.0)) for k in EMOTION_KEYS}


class Engine:
    """全局引擎：管理所有会话 + LLM caller。"""

    def __init__(self):
        self.sessions: dict[str, Session] = {}
        self.llm_caller, self.llm_mode = make_llm_caller()
        logger.info("Engine 初始化，LLM 模式：%s", self.llm_mode)

    def reload_llm(self) -> str:
        self.llm_caller, self.llm_mode = make_llm_caller()
        # 已有会话也切换 caller
        for s in self.sessions.values():
            s.llm_caller = self.llm_caller
            s.llm_mode = self.llm_mode
        return self.llm_mode

    def get_or_create_session(self, session_id: Optional[str], character_id: Optional[str]) -> Session:
        if session_id and session_id in self.sessions:
            return self.sessions[session_id]
        char = get_character_or_default(character_id)
        sess = Session(char, self.llm_caller, self.llm_mode)
        self.sessions[sess.session_id] = sess
        return sess

    def list_characters(self):
        return [
            {
                "character_id": c.character_id,
                "name": c.name,
                "instinct_base": c.core.instinct_base,
                "speech_filter": c.core.speech_filter,
            }
            for c in MOCK_CHARACTERS
        ]


# 全局单例
_engine: Optional[Engine] = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = Engine()
    return _engine
