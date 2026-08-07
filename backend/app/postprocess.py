"""后处理管道——迁移自前端 postprocessor.ts。

步骤1 代词清洗 → 步骤2 状语清洗 → 步骤3 格式解析 → 步骤4 动作完整性校验
"""
from __future__ import annotations

import random
import re

from .models import Character, MessageSegment

FORBIDDEN_ADVERBS = [
    "冷静地", "温柔地", "愤怒地", "冷冷地", "淡淡地", "轻声地", "大声地",
    "不悦地", "开心地", "悲伤地", "默默地", "缓缓地", "慢慢地", "快速地",
    "突然地", "淡淡地说", "冷冷地说", "温柔地说", "愤怒地说",
    "低声", "沉声", "冷声", "柔声",
]

# 代词清洗规则（保守，仅在明确指代角色时替换）
_PRONOUN_PATTERNS: list[tuple[str, str]] = [
    (r"他说", "我说"),
    (r"她说", "我说"),
    (r"他想", "我想"),
    (r"她想", "我想"),
    (r"他的手", "我的手"),
    (r"她的手", "我的手"),
    (r"他的", "我的"),
    (r"她的", "我的"),
    (r"(?m)^他", "我"),
    (r"(?m)^她", "我"),
]


def clean_pronouns(text: str) -> str:
    result = text
    for pat, rep in _PRONOUN_PATTERNS:
        result = re.sub(pat, rep, result)
    return result


def clean_adverbs(text: str, touch_actions: list[str]) -> str:
    if not touch_actions:
        return text
    result = text
    for adverb in FORBIDDEN_ADVERBS:
        if adverb in result:
            touch = random.choice(touch_actions)
            result = re.sub(re.escape(adverb) + r"[，,]?", f"*{touch}*，", result)
    result = re.sub(r"，，+", "，", result)
    result = re.sub(r"\*，", "*，", result)
    return result


_SEGMENT_REGEX = re.compile(r"(\*[^*]+\*)|(\([^)]+\))|(（[^）]+）)")


def parse_segments(raw_text: str) -> list[MessageSegment]:
    segments: list[MessageSegment] = []
    text = raw_text.strip()
    if not text:
        return segments

    last_index = 0
    for m in _SEGMENT_REGEX.finditer(text):
        if m.start() > last_index:
            speech = text[last_index:m.start()].strip()
            if speech:
                segments.append(MessageSegment(type="speech", text=speech))
        matched = m.group(0)
        if matched.startswith("*"):
            inner = matched[1:-1].strip()
            if inner:
                segments.append(MessageSegment(type="action", text=inner))
        else:
            inner = matched[1:-1].strip()
            if inner:
                segments.append(MessageSegment(type="thought", text=inner))
        last_index = m.end()

    if last_index < len(text):
        speech = text[last_index:].strip()
        if speech:
            segments.append(MessageSegment(type="speech", text=speech))

    if not segments:
        segments.append(MessageSegment(type="speech", text=text))
    return segments


def _contains_any(text: str, keywords: list[str]) -> bool:
    return any(k in text for k in keywords)


def validate_actions(segments: list[MessageSegment], character: Character):
    action_texts = [s.text for s in segments if s.type == "action"]
    full_text = " ".join(action_texts)
    at = character.action_tendency
    control_matched = [a for a in at.control_actions if _contains_any(full_text, [a])]
    touch_matched = [a for a in at.touch_actions if _contains_any(full_text, [a])]
    return {
        "has_control": len(control_matched) > 0,
        "has_touch": len(touch_matched) > 0,
        "control_matched": control_matched,
        "touch_matched": touch_matched,
    }


def append_missing_actions(segments: list[MessageSegment], character: Character) -> list[MessageSegment]:
    result = list(segments)
    v = validate_actions(result, character)
    if not v["has_control"]:
        result.append(MessageSegment(type="action", text="按住你的肩膀"))
    if not v["has_touch"]:
        result.append(MessageSegment(type="action", text="指尖蹭过你的手背"))
    return result


def segments_to_text(segments: list[MessageSegment]) -> str:
    out = []
    for s in segments:
        if s.type == "action":
            out.append(f"*{s.text}*")
        elif s.type == "thought":
            out.append(f"（{s.text}）")
        else:
            out.append(s.text)
    return "".join(out)


def run_postprocessor(raw_text: str, character: Character):
    text = clean_pronouns(raw_text)
    text = clean_adverbs(text, character.action_tendency.touch_actions)
    segments = parse_segments(text)

    v = validate_actions(segments, character)
    if not v["has_control"] or not v["has_touch"]:
        segments = append_missing_actions(segments, character)

    cleaned = segments_to_text(segments)
    return {
        "segments": segments,
        "cleaned_text": cleaned,
        "action_valid": v["has_control"] and v["has_touch"],
    }
