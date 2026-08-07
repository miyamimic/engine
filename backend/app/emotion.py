"""六维情绪引擎——迁移自前端 emotion.ts，公式逐行对齐。

核心公式（每维独立 inertia）：
    target  = clamp(baseline + triggerDelta)
    newValue = clamp(current * inertia + target * (1 - inertia))
"""
from __future__ import annotations

from typing import Iterable

from .models import EmotionVector

EMOTION_KEYS: tuple[str, ...] = ("anger", "fear", "joy", "sadness", "desire", "warmth")

EMOTION_NAMES = {
    "anger": "愤怒",
    "fear": "恐惧",
    "joy": "喜悦",
    "sadness": "悲伤",
    "desire": "欲望",
    "warmth": "温情",
}

INSTINCT_DESCRIPTIONS = {
    "attack": "面对压力时你的本能是主动出击，除非你主动选择压制",
    "avoid": "面对压力时你的本能是回避和逃离，除非你主动选择面对",
    "freeze": "面对压力时你的本能是僵住和沉默，除非你主动选择反应",
    "fawn": "面对压力时你的本能是讨好和迎合，除非你主动选择坚持",
    "observe": "面对压力时你的本能是先观察再行动，除非你主动选择介入",
}

SPEECH_FILTER_DESCRIPTIONS = {
    "rough": "说话粗糙、直接，不喜欢绕弯子，偶尔带脏字",
    "gentle": "说话温柔、低沉，语速慢，喜欢用柔和的词",
    "formal": "说话正式、克制，用词讲究，不带多余情绪",
    "casual": "说话慵懒、随意，常用单字和短句，带点漫不经心",
}


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def add_emotion(base: EmotionVector, delta: dict[str, float]) -> EmotionVector:
    result = base.model_copy()
    for k, d in delta.items():
        if k in EMOTION_KEYS and d is not None:
            setattr(result, k, clamp(getattr(result, k) + d))
    return result


def scale_emotion(delta: dict[str, float], scale: float) -> dict[str, float]:
    return {k: v * scale for k, v in delta.items() if k in EMOTION_KEYS and v is not None}


def update_emotion_with_inertia(
    current: EmotionVector,
    baseline: EmotionVector,
    inertia: EmotionVector,
    trigger_delta: dict[str, float],
) -> EmotionVector:
    """六维情绪惯性更新（核心公式），每维独立 inertia。"""
    result = current.model_copy()
    for k in EMOTION_KEYS:
        d = trigger_delta.get(k, 0.0) or 0.0
        target = clamp(getattr(baseline, k) + d)
        cur = getattr(current, k)
        ine = getattr(inertia, k)
        setattr(result, k, clamp(cur * ine + target * (1 - ine)))
    return result


def dominant_emotions(emotion: EmotionVector, count: int = 2) -> list[tuple[str, float]]:
    items = [(k, getattr(emotion, k)) for k in EMOTION_KEYS]
    items.sort(key=lambda x: x[1], reverse=True)
    return [(k, v) for k, v in items[:count] if v > 0.2]


def describe_emotion(emotion: EmotionVector) -> str:
    """根据当前情绪值生成自然语言描述。"""
    dom = dominant_emotions(emotion, 2)
    parts: list[str] = []
    for k, v in dom:
        name = EMOTION_NAMES[k]
        if v >= 0.8:
            level = "非常强烈的"
        elif v >= 0.6:
            level = "明显的"
        elif v >= 0.4:
            level = "一些"
        else:
            level = "淡淡的"
        parts.append(f"{level}{name}")

    if not parts:
        return "你现在心情很平静，几乎没有明显的情绪波动。"
    if len(parts) == 1:
        return f"你现在感受到{parts[0]}。"

    if emotion.desire > 0.5 and emotion.warmth > 0.5:
        return "你现在心里又暖又痒，欲望和温情交织在一起，有点说不清的感觉。"
    if emotion.anger > 0.5 and emotion.desire > 0.5:
        return "你现在有点烦躁，但欲望也在升腾，两种情绪搅在一起让你更想做点什么。"
    if emotion.joy > 0.5 and emotion.warmth > 0.5:
        return "你现在心里软乎乎的，带着笑意，整个人都放松下来了。"

    return f"你现在主要感受到{'和'.join(parts)}。"


def emotion_to_dict(vec: EmotionVector) -> dict[str, float]:
    return {k: getattr(vec, k) for k in EMOTION_KEYS}


def dict_to_emotion(d: dict[str, float]) -> EmotionVector:
    return EmotionVector(**{k: float(d.get(k, 0.0)) for k in EMOTION_KEYS})
