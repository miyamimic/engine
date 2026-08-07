"""NLP 理解层——让程序先"读懂"用户输入，再决定情绪增量，而不是死板的关键词匹配。

混合方案（对应你贴的方案精神）：
  1. spaCy + EntityRuler：工业级库，基于可配置规则精确抽取实体/短语（如"胸肌""瓶子"），
     并做情感极性启发式判断。这是确定性、可解释的一层。
  2. LLM 意图/情绪分析（主力）：调用 OpenAI 兼容接口，让模型对用户输入做结构化分析，
     输出 {intent, emotion_delta, sentiment, notes}。泛化能力强——能识别网络梗、隐喻、
     反讽、撒娇等任意自然语言，不再受"十个梗十个模板"的限制。
  3. 融合：spaCy 抽取的实体喂给 LLM 作为上下文；LLM 失败时退化为 spaCy 规则 + 启发式，
     保证零网络下也能跑。

输出 IntentAnalysis，供情绪引擎消费 emotion_delta。
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from .config import NLP_USE_LLM
from .models import IntentAnalysis
from .emotion import EMOTION_KEYS

logger = logging.getLogger("rp.nlp")

# ---- spaCy 单例（blank 中文管道 + EntityRuler，免下载大模型） ----
_NLP = None
_NLP_LOAD_ERROR: Optional[str] = None


def _get_spacy():
    """惰性加载 spaCy blank 中文管道 + EntityRuler。失败返回 None，不影响主流程。"""
    global _NLP, _NLP_LOAD_ERROR
    if _NLP is not None or _NLP_LOAD_ERROR is not None:
        return _NLP
    try:
        import spacy
        from spacy.language import Language

        # blank 中文管道：无统计模型，仅 tokenizer + 我们注入的 EntityRuler
        nlp = spacy.blank("zh")
        ruler = nlp.add_pipe("entity_ruler")

        # 实体规则：身体部位、动作对象、情绪相关短语、网络梗常见词
        # 这些是可扩展的"领域词典"，对应方案里 spaCy EntityRuler 的精确提取
        patterns = [
            {"label": "BODY", "pattern": w}
            for w in ["胸肌", "肩膀", "手腕", "下巴", "头发", "后颈", "后脑", "耳朵", "脸颊", "腰", "手背", "后背"]
        ]
        patterns += [
            {"label": "OBJECT", "pattern": w}
            for w in ["瓶子", "酒杯", "威士忌", "糖", "门", "墙", "吧台", "杯子"]
        ]
        patterns += [
            {"label": "REFUSE", "pattern": w}
            for w in ["不行", "不要", "不能", "做不到", "走开", "别", "滚开"]
        ]
        patterns += [
            {"label": "AFFECTION", "pattern": w}
            for w in ["想你", "爱你", "喜欢你", "乖", "听话", "宝宝", "抱抱", "亲"]
        ]
        patterns += [
            {"label": "HURT", "pattern": w}
            for w in ["疼", "痛", "难受", "累", "委屈", "哭"]
        ]
        patterns += [
            {"label": "PROVOKE", "pattern": w}
            for w in ["挑衅", "讨厌", "滚", "闭嘴", "烦", "你管", "凭什么"]
        ]
        # 常见网络梗/流行语（可扩展）—— LLM 会进一步泛化，这里只是给 spaCy 一个起点
        patterns += [
            {"label": "MEME", "pattern": w}
            for w in ["emo", "破防", "上头", "下头", "甜到", "搞快点", "我不理解", "离谱", "绝绝子", "栓Q", "蚌埠住"]
        ]
        ruler.add_patterns(patterns)
        _NLP = nlp
        logger.info("spaCy blank(zh) + EntityRuler 已加载，规则 %d 条", len(patterns))
        return _NLP
    except Exception as e:  # noqa: BLE001
        _NLP_LOAD_ERROR = str(e)
        logger.warning("spaCy 加载失败，NLP 层将退化为启发式 + LLM：%s", e)
        return None


def spacy_extract(text: str) -> tuple[list[str], list[str]]:
    """返回 (entities, labels)。spaCy 不可用时返回 ([], [])。"""
    nlp = _get_spacy()
    if nlp is None:
        return [], []
    doc = nlp(text)
    ents = [(ent.text, ent.label_) for ent in doc.ents]
    # 去重保序
    seen: set[str] = set()
    entities: list[str] = []
    labels: list[str] = []
    for t, lab in ents:
        if t not in seen:
            seen.add(t)
            entities.append(t)
            labels.append(lab)
    return entities, labels


# ---- 启发式意图/情绪增量（spaCy 规则 + 关键词，零网络兜底） ----
_HEURISTIC_RULES: list[tuple[list[str], str, str, dict[str, float]]] = [
    # (labels/keywords, intent, intent_label, emotion_delta)
    (["REFUSE", "不行", "不要", "不能", "做不到", "走开"], "refuse", "拒绝",
     {"anger": 0.5, "desire": 0.2}),
    (["AFFECTION", "想你", "爱你", "喜欢你", "乖", "抱抱"], "affection", "示爱/亲昵",
     {"joy": 0.3, "warmth": 0.4, "desire": 0.2}),
    (["HURT", "疼", "痛", "难受", "委屈", "哭"], "hurt", "示弱/求助",
     {"warmth": 0.5, "fear": 0.2, "sadness": 0.2}),
    (["PROVOKE", "挑衅", "讨厌", "滚", "闭嘴", "烦"], "provoke", "挑衅/对抗",
     {"anger": 0.5, "sadness": 0.2}),
    (["MEME", "emo", "破防", "上头", "下头"], "meme", "玩梗",
     {"joy": 0.2, "warmth": 0.1}),
]


def heuristic_analyze(text: str, entities: list[str], labels: list[str]) -> IntentAnalysis:
    """零网络兜底：基于 spaCy 实体 label + 关键词的规则分析。"""
    delta: dict[str, float] = {}
    intent = "neutral"
    intent_label = "中性/闲聊"
    matched_notes: list[str] = []

    pool = list(zip(entities, labels)) if labels else []
    for keywords, it, label, d in _HEURISTIC_RULES:
        hit = False
        # 命中实体 label
        if any(k in labels for k in keywords if k.isupper()):
            hit = True
        # 命中关键词
        if not hit and any(k in text for k in keywords if not k.isupper()):
            hit = True
        if hit:
            intent = it
            intent_label = label
            for k, v in d.items():
                delta[k] = round(delta.get(k, 0.0) + v, 3)
            matched_notes.append(label)

    # 情感极性启发式
    sentiment = "neutral"
    if any(w in text for w in ["讨厌", "滚", "烦", "难受", "哭", "疼"]):
        sentiment = "negative"
    elif any(w in text for w in ["想你", "爱你", "喜欢", "乖", "开心", "好"]):
        sentiment = "positive"

    notes = "启发式规则匹配"
    if matched_notes:
        notes += "，命中：" + "/".join(matched_notes)

    return IntentAnalysis(
        intent=intent,
        intent_label=intent_label,
        emotion_delta=delta,
        entities=entities,
        sentiment=sentiment,
        confidence=0.4 if delta else 0.2,
        notes=notes,
    )


# ---- LLM 意图分析（主力，泛化） ----
_LLM_INTENT_SYSTEM = (
    "你是角色扮演叙事引擎的 NLP 理解层。给定用户输入和已抽取的实体，"
    "判断用户意图，以及这句话对**角色内心**造成的情绪变化，输出严格的 JSON。\n\n"
    "【核心原则】emotion_delta 永远是\"角色面对这句话时，自己内心产生的情绪变化\"，"
    "不是镜像用户的情绪。用户表达什么情绪 ≠ 角色应该产生相同情绪。\n"
    "用户愤怒时，角色可能愤怒（被挑衅时）、可能担忧（warmth 上升）、可能困惑 — "
    "取决于愤怒是指向角色本人还是别的事情。\n\n"
    "六维情绪取值：anger/fear/joy/sadness/desire/warmth，每个 delta 为 -0.3~0.5 的浮点，"
    "无影响则不输出该键或给 0。\n\n"
    "【六维变化逻辑】\n"
    "- anger ↑：用户挑衅角色本人、贬低角色人格、拒绝角色的善意、威胁角色在意的人\n"
    "- anger 不变/↓：用户自己生气（非指向角色时角色不愤怒，可能困惑或担忧）；用户示弱/道歉\n"
    "- fear ↑：用户威胁要离开/消失、用户表现出危险倾向、角色失去掌控感\n"
    "- fear ↓：用户主动靠近、给角色安全感\n"
    "- joy ↑：用户表达想念/喜欢、配合角色的主动、说让角色开心的话\n"
    "- joy ↓：用户疏远、否定两人的关系\n"
    "- sadness ↑：用户说要走/结束、提到已失去的美好回忆、角色被忽视\n"
    "- sadness 不变：用户发脾气（角色不悲伤，可能愤怒或困惑）\n"
    "- desire ↑：用户挑逗/暧昧、主动靠近身体、示爱但带试探\n"
    "- desire ↓：用户明确拒绝、转移话题到冷淡方向\n"
    "- warmth ↑：用户示弱求助、说想你了、受伤求助、笨拙地表达关心\n"
    "- warmth ↓：用户冷暴力、说\"别碰我\"\n\n"
    "要求：\n"
    "1. intent 用英文标签（refuse/affection/hurt/provoke/meme/tease/seek_help/confess/neutral 等），"
    "intent_label 用中文。\n"
    "2. 能识别网络梗、反讽、隐喻、撒娇等，不要只看字面关键词。\n"
    "3. sentiment ∈ positive/negative/neutral。\n"
    '4. 只输出 JSON，形如 {"intent":"...","intent_label":"...","emotion_delta":{...},"sentiment":"...","notes":"..."}，不要任何多余文字。'
)


def _extract_json(text: str) -> Optional[dict]:
    """从 LLM 输出里抠出 JSON 对象（容错：可能带 ```json 包裹或前后文字）。"""
    if not text:
        return None
    # 去掉代码块
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE)
    # 找第一个 { ... } 块
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:  # noqa: BLE001
        return None


async def llm_analyze(
    text: str,
    entities: list[str],
    llm_caller,
) -> Optional[IntentAnalysis]:
    """调用 LLM 做意图/情绪增量分析。llm_caller: async (system, user, temperature) -> str。"""
    user_prompt = (
        f"用户输入：{text}\n"
        f"已抽取实体：{', '.join(entities) if entities else '（无）'}\n"
        "请输出 JSON。"
    )
    try:
        raw = await llm_caller(_LLM_INTENT_SYSTEM, user_prompt, 0.3)
    except Exception as e:  # noqa: BLE001
        logger.warning("LLM 意图分析失败：%s", e)
        return None

    data = _extract_json(raw)
    if not data:
        logger.warning("LLM 意图分析返回无法解析：%s", (raw or "")[:200])
        return None

    delta_raw = data.get("emotion_delta") or {}
    delta = {}
    for k in EMOTION_KEYS:
        v = delta_raw.get(k)
        if v is not None:
            try:
                # 限制范围，避免 LLM 给离谱值
                delta[k] = max(-0.3, min(0.5, float(v)))
            except (TypeError, ValueError):
                continue

    return IntentAnalysis(
        intent=str(data.get("intent") or "neutral"),
        intent_label=str(data.get("intent_label") or "中性/闲聊"),
        emotion_delta=delta,
        entities=entities,
        sentiment=str(data.get("sentiment") or "neutral"),
        confidence=0.8,
        notes=str(data.get("notes") or "LLM 分析"),
    )


async def analyze(text: str, llm_caller=None) -> IntentAnalysis:
    """NLP 理解层入口：spaCy 抽实体 →（可选）LLM 意图分析 → 启发式兜底。"""
    entities, labels = spacy_extract(text)

    # 主力：LLM 意图分析（泛化，能识别网络梗）
    if NLP_USE_LLM and llm_caller is not None:
        result = await llm_analyze(text, entities, llm_caller)
        if result is not None:
            return result

    # 兜底：spaCy 规则 + 启发式
    return heuristic_analyze(text, entities, labels)
